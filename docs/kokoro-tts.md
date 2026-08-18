# How the neural text-to-speech (kokoro-js) is wired up

> **⚠️ Removed.** The audio quality was judged unusable in real use, even after
> the precision bug below was fixed and the sub-second latency budget was met.
> See [`remove-neural-tts.md`](./remove-neural-tts.md) for what was removed, why,
> and the verification log confirming it landed cleanly.
>
> This document is kept deliberately, as a post-mortem. The measurements in it are
> the reason not to re-attempt this blindly: `q8` is broken on WebGPU's int8
> kernels, `fp16` is the only sane GPU precision, first inference costs ~2.1 s of
> shader compilation, and even correctly configured the output was rejected. The
> integration itself worked — the model was the problem.

Optional, opt-in, English-only speech that runs entirely in the browser. This note
explains what was chosen, why, and where each piece lives — including the numbers
that were **measured** rather than assumed, because two of them changed the design.

---

## Why kokoro-js

The app teaches English reading, so speech quality matters. The default
`window.speechSynthesis` voice is often the oldest voice installed on the device.

| Option | License / cost | Hebrew | Verdict |
|---|---|---|---|
| **kokoro-js** (Kokoro 82M via Transformers.js) | Apache-2.0, free, runs locally | ✗ | **Chosen** |
| Piper | No Hebrew voice; its own issue notes the only open Hebrew model (`mms-tts-heb`) is poor quality. Original repo archived Oct 2025 | ✗ | Rejected |
| Google / Azure / ElevenLabs | Best quality *and* Hebrew, but needs an API key — unsafe to embed in a static client app — and "free" means a monthly quota | ✓ | Rejected |

Hebrew was the sticking point until the user confirmed **English-only is fine**,
which is what unblocked kokoro-js.

This matters less than it sounds: nearly everything the app speaks is already
English — the passage, tapped words, and both flashcard decks are all forced to
`en-US`. Hebrew is only spoken for question titles, and those still work (see
[Hebrew fallback](#hebrew-falls-back-per-item)).

---

## Install

```bash
npm install kokoro-js
```

That is the whole dependency footprint. `kokoro-js@1.2.1` pulls in
`@huggingface/transformers` (resolved 3.8.1) and `phonemizer` transitively — no
config, no build plugin, no server.

---

## The shape of it

Four layers, each with one job:

```
components/SpeechSettingsModal   engine toggle, voice picker, download progress
        │
store/slices/settingsSlice       ttsEngine: "system" | "neural", neuralVoice
        │
hooks/useSpeech                  the React seam every play button already used
        │
utils/speech.ts                  the queue: picks an engine, owns playback + cancel
        │
utils/neuralSpeech.ts            loads the model, synthesises one utterance
```

The important consequence: **no component changed to gain neural speech.** Every
`SpeakButton` in the app already went through `useSpeech`, so adding a second
engine behind that seam was invisible to the UI.

### `utils/neuralSpeech.ts` — model loading

```ts
const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX"

export const loadNeuralModel = (onProgress?) => {
  modelPromise ??= (async () => {
    const { KokoroTTS } = await import("kokoro-js")   // ← lazy
    const webgpu = isWebGpuAvailable()

    return KokoroTTS.from_pretrained(MODEL_ID, {
      device: webgpu ? "webgpu" : "wasm",
      dtype: dtypeFor(webgpu),   // fp16 on WebGPU, q8 on WASM — see below
      progress_callback: /* → percent for the progress bar */,
    })
  })()

  modelPromise.catch(() => { modelPromise = null })   // a failure must be retryable
  return modelPromise
}
```

Three deliberate details:

- **`modelPromise` caches the in-flight promise**, not just the result, so two
  rapid clicks can't start two 88MB downloads.
- **A rejected load is un-cached**, or the user could never retry after a flaky
  network.
- **`await import("kokoro-js")`** is what keeps the library and its ONNX runtime
  out of the initial bundle. Verified in the production build: `kokoro-*.js` is a
  separate 2.2MB chunk, and the network log confirms it is requested **only after**
  the user opts in.

`synthesize()` returns a blob URL and deliberately does **not** play it —
playback belongs to `speech.ts` so that one `cancelSpeech()` can stop either
engine.

### `utils/speech.ts` — one queue, two engines

Both engines share an abort token and a stop hook:

```ts
let runToken = 0
let stopActive: (() => void) | null = null

export const cancelSpeech = () => {
  runToken += 1          // invalidates any in-flight queue
  stopActive?.()         // stops the <audio> element, if the neural path is playing
  stopActive = null
  window.speechSynthesis.cancel()
}
```

`speakQueue()` branches on `options.engine`. The neural path is a plain `for`
loop that awaits synthesis then playback per item, re-checking `token !== runToken`
at every step — so switching controls mid-sentence stops the old one immediately
rather than letting a queued utterance surface later.

#### Hebrew falls back per item

Inside the neural loop, each item's language is checked individually:

```ts
if (!isEnglish(lang)) {
  await new Promise(resolve => speakWithSystem([item], options, { …, onDone: resolve }, token))
  continue
}
```

So with the neural engine selected, a Hebrew question title is still read aloud
by the system voice instead of being skipped. Same for any synthesis failure —
it logs and falls back rather than going silent.

#### Speed mapping

Kokoro treats `1` as natural pace; `speechSynthesis` treats `1` as already fast,
and the app's slider is calibrated for the latter (default `0.5`). The rate is
shifted so one setting sounds comparable on both engines:

```ts
Math.max(0.5, Math.min(1.5, options.rate + 0.5))
```

---

## GitHub Pages compatibility

Pages support was a hard requirement, and it constrains the config. Both facts
below were checked rather than assumed:

- **WebGPU requires a secure context (HTTPS) but *not* cross-origin isolation.**
  Pages serves HTTPS, so WebGPU is available there. This is the fast path.
- **Pages cannot set `COOP`/`COEP`**, so `SharedArrayBuffer` is unavailable and
  multi-threaded WASM **silently degrades to single-threaded** — slower, but it
  runs. The rule that follows: *nothing may depend on threading.* Hence
  `device: webgpu ? "webgpu" : "wasm"` with no thread configuration.

There is a known service-worker trick to inject `COOP`/`COEP` on static hosts. It
is deliberately **not** used — unnecessary once WebGPU is preferred, and not worth
the complexity.

The weights are fetched from the Hugging Face CDN at runtime, never committed:
Pages enforces a 100MB per-file hard limit, and the response carries
`access-control-allow-origin: *`, so the fetch works from any static origin.

> **Still verify on the deployed site.** `localhost` counts as a secure context
> regardless of HTTPS, so WebGPU working locally proves nothing about Pages.

---

## Latency: meeting the sub-second budget

Requirement: **under 1 second from clicking play to hearing audio.** Kokoro meets
it, but only with all four of the following. Measured on an Apple GPU:

| Action | Generate | Click → playable |
|---|---|---|
| Flashcard word (`delicate`) | 232 ms | **236 ms** |
| Same word again (cached) | 0 ms | **3 ms** |
| Full passage paragraph | 936 ms | **938 ms** |
| Flashcard press, through the real UI | — | **350 ms** |

**1. Warm-up.** The first inference on a freshly loaded model pays for shader
compilation and graph setup: **2.1 s**, versus **0.21 s** for the identical call
once warm. `loadNeuralModel()` therefore spends that cost immediately on a
throwaway `"ok"` utterance, so the user's first real click never pays it.

**2. Preload on page load, not on opt-in.** Originally the model was only loaded
when the user flipped the engine on — which meant it was warm for that session
only. On the *next* page load nothing happened until the first play, so a play
button sat silent for seconds with no explanation. `hooks/useNeuralPreload.ts`
now loads and warms it on mount whenever `neural` is the saved engine. Weights are
already in the browser cache by then, so this measures **0.82 s** in the
background.

**3. Prefetch the next item during playback.** `speakWithNeural` starts generating
item *n+1* while item *n* is still playing, so a multi-paragraph read has no gap
between paragraphs — every paragraph after the first resolves from cache in ~3 ms.

**4. Cache by `(voice, speed, text)`.** Flashcards replay the same word
constantly, so repeat presses are effectively instant. Bounded at 40 entries with
LRU-ish eviction, since each entry is a decoded WAV in memory.

---

## The dtype bug (this one was shipped and had to be fixed)

The first implementation used `dtype: "q8"` on both device paths, reasoning that
the kokoro-js README's suggestion to pair WebGPU with `fp32` was only about
download size. That was wrong, and the user reported the result as slow and
unintelligible. Measured, same sentence and voice:

| dtype | Size | Generate | Zero-crossings/s |
|---|---|---|---|
| `q8` | 88 MB | 8.7 s | 4094 |
| **`fp16`** | 156 MB | **2.1 s** | **2935** |

`q8` was **both four times slower and measurably noisier** — a zero-crossing rate
that high indicates noise rather than speech. The cause: **ONNX Runtime's WebGPU
backend has poor int8 kernel coverage**, so quantized weights are emulated there —
slow *and* lossy. The README's pairing was load-bearing advice, not a size hint.

The fix is device-dependent precision:

```ts
const dtypeFor = (webgpu: boolean): "fp16" | "q8" => (webgpu ? "fp16" : "q8")
```

- **WebGPU → `fp16`** (156 MB). GPUs want fp16 natively; `fp32` is 310 MB for no
  meaningful gain.
- **WASM → `q8`** (88 MB). CPU int8 kernels *are* well supported in ORT WASM, so
  this is a genuine saving with no quality cliff.

`estimatedDownloadMb()` reports the right figure per device, and the UI
interpolates it rather than hardcoding a number that is wrong half the time.

**The lesson worth keeping:** "it produced a WAV of plausible size" is not
evidence that TTS works. The original verification checked that synthesis returned
audio, not that the audio was intelligible — which is exactly the gap the user hit.
Zero-crossing rate turned out to be a cheap, automatable proxy for it.

### Available weights, for reference

| File | Size |
|---|---|
| `model.onnx` (fp32) | 310.5 MB |
| `model_fp16.onnx` | 155.7 MB |
| `model_q4f16.onnx` | 147.4 MB |
| `model_uint8f16.onnx` | 108.9 MB |
| `model_quantized.onnx` (q8) | 88.1 MB |
| `model_q8f16.onnx` | 82.0 MB |

---

## Settings and persistence

| Key | Value |
|---|---|
| `english_tts_engine` | `"system"` (default) or `"neural"` |
| `english_neural_voice` | Kokoro voice id, e.g. `af_heart` |
| `english_system_voice` | `voiceURI` of the chosen system voice, `""` = best available |

The `english_` prefix is not cosmetic — it is what makes these keys ride along
with the app's existing sync-link feature, so the preference follows the user to
another device.

Seven of Kokoro's 28 voices are exposed (`NEURAL_VOICES`), the top-graded US and
UK ones; the full list is mostly variations of the same quality tier.

Opting in starts the download **immediately** rather than on first play, and
`useNeuralPreload` re-warms it on every later page load, so the first press of a
play button isn't a silent wait. If the download fails, the engine reverts to
`system` and an alert explains why.

---

## How to try it

1. `npm run dev`
2. Top bar → **🎙️ הגדרות קול / Voice settings**
3. Switch the engine to **קול משופר (אנגלית) / Enhanced voice (English)** — the
   progress bar tracks the ~90MB download
4. Press the 🔊 next to **השמעת דוגמה / Play a sample**

Worth checking specifically:

- The `kokoro-js` chunk is requested only *after* opting in (Network tab).
- A Hebrew question title on the Unseen page still speaks while the neural engine
  is active.
- Pressing another play button mid-sentence stops the first one immediately.
- Reload keeps the engine and voice choice — and the model re-warms in the
  background, so the first click after a reload is still fast.
- Time a click to first audio. It should be ~0.2-0.4s for a word and under 1s for
  a paragraph. If it is seconds, the model is not warm — check that
  `useNeuralPreload` ran.

### Known console noise

ONNX Runtime logs two `VerifyEachNodeIsAssignedToAnEp` notices at *error* level on
WebGPU ("Some nodes were not assigned to the preferred execution providers"). They
are informational, come from the library rather than this app, and are expected.
