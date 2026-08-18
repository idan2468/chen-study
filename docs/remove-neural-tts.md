# Plan: remove the neural (kokoro-js) text-to-speech

**Status: executed.** This plan has been applied in full; kept as a record of what
was removed and why. See the [verification log](#verification-log) at the bottom for
what was actually checked.

## Why

The neural engine sounded bad in real use. The measured metrics improved when the
weight precision was fixed (`q8` → `fp16` on WebGPU: 4× faster, zero-crossing rate
down 28%), and the latency budget was met — flashcard word 236 ms, paragraph 938 ms,
against a 1 s requirement — but **none of that fixed the actual complaint**. The
output was still not good enough to learn English from, which is the entire point of
the feature.

So the cost/benefit collapses:

| Cost | |
|---|---|
| Download | 156 MB (WebGPU) / 88 MB (WASM) per user |
| Bundle | +2.2 MB lazy JS chunk, +21 MB WASM emitted into `dist/` |
| Runtime | Third-party CDN (jsDelivr) in the speech path |
| Code | 2 modules, ~400 lines, an engine branch through the speech queue, 11 translation keys × 2 locales |
| Benefit | Audio quality the user judged unusable |

Not worth carrying. Remove it.

## What is *kept*

**The voice-selection work (Step 8a) stays.** It is independent of kokoro, needs no
download, and fixed a real bug: `utterance.voice` was never set, so the browser
always used its own default. Also kept:

- `utils/voices.ts` and its 11 tests — ranking, the macOS novelty-voice deny-list
  (which stopped "Bad News" and "Boing" being eligible to read a lesson aloud), and
  the OS-default fallback.
- The system-voice picker in the settings modal.
- `utterance.lang` following the resolved voice's locale.
- The cold-start fix where the resolver re-reads `getVoices()` synchronously.

After this removal the app has exactly one speech engine — `window.speechSynthesis`
— using the best voice available on the device.

---

## Step 1 — Delete

| Path | Note |
|---|---|
| `src/utils/neuralSpeech.ts` | model loading, warm-up, cache, prefetch |
| `src/hooks/useNeuralPreload.ts` | preload-on-mount hook |

```bash
npm uninstall kokoro-js
```

That also drops `@huggingface/transformers` and `phonemizer`, which came in only as
its transitive deps. Confirm nothing else pulls them: `npm ls @huggingface/transformers`.

## Step 2 — Simplify `src/utils/speech.ts`

This is the only structurally interesting edit; the rest is deletion.

Remove:
- the `prefetchSynthesis` / `synthesize` imports and the `NeuralVoice` type import
- `export type SpeechEngine`
- `engine` and `neuralVoice` from `SpeakQueueOptions`
- `speakWithNeural` (the whole function)
- `playAudioUrl` (only the neural path used an `<audio>` element)
- `isEnglish` — check first: currently used *only* by `speakWithNeural` (lines 181,
  214). If nothing else references it after the edit, delete it too.
- the `stopActive` hook in `cancelSpeech`, which existed to pause that `<audio>`
  element. `window.speechSynthesis.cancel()` alone is then sufficient.
- the engine branch in `speakQueue`, which collapses to a direct `speakWithSystem` call

Keep `runToken`. It still guards the system path against a queued utterance
resuming after the user switched controls — that was its original purpose, inherited
from the `currentSpeechBtn !== btn` checks in the source HTML.

Also delete the speed-mapping line (`rate + 0.5` clamped to 0.5–1.5) — it existed
solely to reconcile Kokoro's pacing with the `speechSynthesis` slider.

## Step 3 — Settings state

`src/store/slices/settingsSlice.ts` (12 references — the heaviest file):
- drop `ttsEngine` and `neuralVoice` from `SettingsState`, `readInitialState`, the
  reducers, and the selectors
- drop the `isNeuralVoice` guard and the `NEURAL_VOICES` / `DEFAULT_NEURAL_VOICE`
  imports
- **keep** `systemVoiceUri` in full

`src/store/listenerMiddleware.ts`: remove the `setTtsEngine` / `setNeuralVoice`
entries from the `isAnyOf` matcher and their two write blocks. Keep the
`systemVoiceUri` write.

`src/utils/storageKeys.ts`: remove `ttsEngine` and `neuralVoice`. Keep `systemVoice`.

### Leftover user data

Anyone who opted in already has `english_tts_engine: "neural"` and
`english_neural_voice` in localStorage. After removal these are simply never read,
so behaviour is correct with no migration — the app falls back to the only engine
there is.

Two loose ends worth a decision:
- `isSyncableKey` matches `english_*`, so the dead keys still travel in sync links.
  Harmless (the receiving app ignores them), but a one-line cleanup in
  `readInitialState` (`removeKey(...)` for both) keeps storage tidy.
- The browser has up to 156 MB of cached model weights in the Cache API. It cannot
  be cleared from our code without knowing transformers.js's cache name; the browser
  will evict it under pressure. Mention it in the release note rather than trying to
  script it.

## Step 4 — UI and translations

`src/components/SpeechSettingsModal/SpeechSettingsModal.tsx` — **keep the file**,
reduce it to the system-voice picker plus the sample button. Remove: the
`SegmentedControl`, `handleEngineChange`, the `Progress` bar, the download-failed
`Alert`, the `noWebGpu` `Alert`, the Kokoro voice `Select`, the three `useState`
hooks (`downloadPercent`, `downloading`, `failed`), and the `neuralSpeech` imports.

What remains is small enough that the surrounding `engine === "neural" ? … : …`
conditional disappears and the voice `Select` renders unconditionally.

`src/App.tsx` — remove the `useNeuralPreload()` call and its import.

`src/i18n/{he,en}.ts` — delete from the `speech` section: `engineLabel`,
`engineSystem`, `engineNeural`, `engineSystemHint`, `engineNeuralHint`,
`downloading`, `downloadFailed`, `neuralVoiceLabel`, `noWebGpu` (9 keys × 2
locales). Keep `title`, `systemVoiceLabel`, `systemVoiceHint`, `bestAvailable`,
`test`.

Because `en.ts` is typed against `he.ts`, deleting a key from only one locale is a
compile error — the type system enforces that both are done.

## Step 5 — Docs

- `docs/kokoro-tts.md` → **rewrite as a short post-mortem, do not delete.** The
  measurements are the reason nobody should re-attempt this blindly: `q8` is broken
  on WebGPU's int8 kernels; `fp16` is the only sane GPU precision; warm-up costs
  2.1 s; and even correctly configured the quality was rejected. Deleting that
  throws away the expensive part.
- `docs/react-conversion-plan.md` → mark Step 8b as removed and why; leave 8a as
  delivered. Also drop the Step 10 follow-up about self-hosting the ONNX WASM, since
  it no longer applies.

---

## Verification

```bash
npm run type-check   # the typed i18n catalogues catch a half-finished key removal
npm run lint
npm run dupes
npm run test         # expect 75 → 75; no test covers the neural path
npm run build
```

Then confirm the removal actually landed:

- `grep -rn "kokoro\|neural\|Neural" src/` returns nothing.
- `dist/assets/` no longer contains a `kokoro-*.js` chunk or
  `ort-wasm-simd-threaded.jsep.wasm`. The main bundle should drop back to roughly
  its pre-kokoro size (~660 kB).
- No network request to `huggingface.co` or `cdn.jsdelivr.net` on any page.

Manual, with the browser devtools open:

- Every play button still speaks: passage, per-paragraph, tapped word, question and
  options, and both flashcard decks.
- The voice picker still lists real voices only (no "Bad News" / "Boing") and the
  chosen voice is still applied — check `utterance.voice` on the fired utterance.
- A Hebrew question title still speaks (it now takes the only path there is).
- Pressing a second play button mid-sentence still stops the first.
- A user who had opted in previously loads cleanly with no console errors.

---

## Where this leaves speech quality

Removing kokoro does not solve the original problem — it accepts it. The system
voice is as good as whatever is installed on the device. The remaining levers, in
order of effort:

1. **Free, and the most promising:** on macOS/iOS, download the Enhanced or Premium
   voices in System Settings → Accessibility → Spoken Content. They then appear in
   `getVoices()` and the existing ranking in `utils/voices.ts` will *already* select
   them ahead of the legacy defaults — no code change needed. This is the first thing
   to try.
2. **Cloud TTS** (Google / Azure / ElevenLabs) — genuinely better, and the only
   option that also covers Hebrew, but needs a key behind a small proxy, so the app
   stops being purely static. Free tiers are monthly quotas, not unconditional.
3. **Revisit local neural TTS later.** The blocker was model quality at this size,
   not the integration — which worked, met the latency budget, and is documented in
   the post-mortem if a better small model appears.


---

## Verification log

Executed and verified against this exact plan.

**Automated:**
```
type-check   clean
lint         clean
dupes        0 clones
test         75 → 75 passed
build        single 664 kB JS chunk, no kokoro-*.js, no .wasm
```
`npm uninstall kokoro-js` removed 46 packages total, confirming
`@huggingface/transformers` and `phonemizer` had no other consumer.

**`grep -rn "kokoro\|neural\|Neural" src/`** returns only explanatory comments
pointing at this document (in `speech.ts`, `SpeechSettingsModal.tsx`,
`settingsSlice.ts`) — no code, no imports, no dead types.

**Manual, in-browser:**
- A simulated previously-opted-in user (`english_tts_engine=neural` seeded before
  load) came up with **zero console errors**, and the two dead keys
  (`english_tts_engine`, `english_neural_voice`) were gone from localStorage after
  the first load — the inline cleanup in `readInitialState` fired as designed.
- Settings modal now shows only the voice `Select` and the sample button — no
  engine toggle, no progress bar, no WebGPU alert.
- Voice picker: 36 options, zero novelty voices, **Ava (Premium)** sorted first
  (once Chrome exposed the full system voice list — see below).
- Sample button, paragraph play, per-paragraph play, and a Modules flashcard word
  all correctly spoke with `voice: "Ava (Premium)"`.
- A Hebrew question title spoke with a Hebrew voice (`Carmit`, `he-IL`) while its
  English options spoke with `Ava (Premium)` (`en-US`) — per-item language
  detection still works with only one engine.
- `speechSynthesis.cancel()` fires exactly once per new play, including switching
  paragraph 1 → paragraph 2 mid-utterance, confirming "second click stops the
  first" survived the removal of the `stopActive` hook (which existed only for
  the neural engine's `<audio>` element).
- No network requests to `huggingface.co` or `cdn.jsdelivr.net` on any page.

**One incidental finding, unrelated to this removal:** Chrome's
`speechSynthesis.getVoices()` earlier in the project returned zero Enhanced/Premium
voices on this same machine, even though `say -v '?'` confirmed they were installed
at the OS level (Ava Enhanced, Ava Premium). During this verification pass Chrome
exposed the full list correctly. This looks like a Chrome voice-list refresh quirk
(see the earlier discussion in-session) rather than anything this app controls — if
a user reports "no voices" or a stale list, a full Chrome relaunch is the first
thing to try, not a code change.
