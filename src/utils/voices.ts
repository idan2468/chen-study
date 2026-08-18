/**
 * Picking a *good* system voice.
 *
 * The original apps -- and this port until now -- only ever set
 * `utterance.lang`, which leaves the browser to pick the default voice for that
 * language. That default is frequently the oldest, lowest-quality voice
 * installed, so choosing explicitly is the single cheapest quality win
 * available: no dependency, no download, no network.
 */

/**
 * `getVoices()` is populated asynchronously; on a cold page it returns `[]` and
 * fills in later via `voiceschanged`. Callers that skip this get an empty list.
 */
export const loadVoices = async (): Promise<SpeechSynthesisVoice[]> => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return []
  }

  const existing = window.speechSynthesis.getVoices()
  if (existing.length > 0) {
    return existing
  }

  return new Promise(resolve => {
    // Some browsers never fire `voiceschanged` when there is nothing to add, so
    // this must not be the only way out.
    const timeout = window.setTimeout(() => {
      cleanup()
      resolve(window.speechSynthesis.getVoices())
    }, 1500)

    const cleanup = () => {
      window.clearTimeout(timeout)
      window.speechSynthesis.removeEventListener("voiceschanged", onChanged)
    }

    const onChanged = () => {
      cleanup()
      resolve(window.speechSynthesis.getVoices())
    }

    window.speechSynthesis.addEventListener("voiceschanged", onChanged)
  })
}

/**
 * macOS ships a set of joke/effect voices alongside the real ones, and
 * `getVoices()` returns them mixed in with no flag to tell them apart. On a
 * stock machine they are indistinguishable from genuine voices by every
 * available signal, so without this list a "best voice" heuristic can happily
 * select "Bad News" or "Boing" to read a passage aloud.
 */
const NOVELTY_VOICES = new Set([
  "albert",
  "bad news",
  "bahh",
  "bells",
  "boing",
  "bubbles",
  "cellos",
  "deranged",
  "good news",
  "hysterical",
  "jester",
  "organ",
  "pipe organ",
  "superstar",
  "trinoids",
  "whisper",
  "wobble",
  "zarvox",
])

const isNovelty = (voice: SpeechSynthesisVoice) =>
  NOVELTY_VOICES.has(voice.name.trim().toLowerCase())

/**
 * Android's speech engines (Google/Samsung TTS) don't give voices a readable
 * name at all -- `getVoices()` returns codes like `en-us-x-iol-local` or
 * `en-us-x-iol-network` (the separator is sometimes an underscore instead,
 * see the Samsung/Chrome discrepancy noted in `readium/speech`'s WebSpeech.md).
 * `-network` is the cloud-backed variant of the same voice and is consistently
 * reported as the better-sounding one; `-local` is the on-device fallback.
 */
const ANDROID_NETWORK_SUFFIX = /-network$/i
const ANDROID_LOCAL_SUFFIX = /-local$/i

/**
 * Higher is better. The families scored here are the modern neural voice sets;
 * the unscored remainder are the legacy formant voices that tend to be the
 * default.
 *
 * On macOS the Enhanced/Premium variants only appear at all once the user has
 * downloaded them in System Settings → Accessibility → Spoken Content — on a
 * machine without them, every voice scores near zero and the OS default wins,
 * which is the correct outcome. The same "score near zero, OS default wins"
 * fallback applies on Windows and Android when neither platform's own
 * higher-quality signal (below) is present.
 */
const qualityScore = (voice: SpeechSynthesisVoice) => {
  // Never a sensible choice for reading a lesson, whatever else it scores.
  if (isNovelty(voice)) {
    return -1
  }

  const name = voice.name.toLowerCase()
  let score = 0

  if (name.includes("premium")) {
    score += 100
  } else if (name.includes("enhanced")) {
    score += 90
  }

  // Covers both macOS's "Ava (Enhanced)"-style naming and Windows Edge/Chrome's
  // cloud voices, named e.g. "Microsoft Ava Online (Natural) - English (United
  // States)" -- the highest-quality tier Windows exposes.
  if (name.includes("natural") || name.includes("neural")) {
    score += 80
  }
  if (name.startsWith("google")) {
    score += 60
  }
  if (name.includes("microsoft")) {
    score += 40
  }
  // Android/Chrome TTS voices carry their quality signal in a `-network` /
  // `-local` suffix rather than a readable name (see the comment above) --
  // `-network` is the cloud-backed, better-sounding variant.
  if (ANDROID_NETWORK_SUFFIX.test(name)) {
    score += 30
  } else if (ANDROID_LOCAL_SUFFIX.test(name)) {
    score += 5
  }
  // Network-backed voices are generally the higher-quality ones. Distinct from
  // the Android-specific suffix check above: this is `localService`, the one
  // signal every platform reports consistently, so it still adds a small
  // signal even where a platform-specific naming convention already matched.
  if (!voice.localService) {
    score += 10
  }
  // Weighted well above the "no signal at all" case: when nothing scores -- a
  // stock install with no enhanced/natural/cloud voices -- the OS default is a
  // real, intelligible voice, and is a far better fallback than whichever name
  // happens to sort first.
  if (voice.default) {
    score += 20
  }

  return score
}

const matchesLanguage = (voice: SpeechSynthesisVoice, lang: string) => {
  const base = lang.split("-")[0]?.toLowerCase() ?? lang.toLowerCase()
  return voice.lang.toLowerCase().startsWith(base)
}

/**
 * Voices for a language, best first. Novelty voices are dropped entirely rather
 * than merely ranked low, so they never appear in the picker either.
 */
export const voicesForLanguage = (
  voices: readonly SpeechSynthesisVoice[],
  lang: string,
) =>
  voices
    .filter(voice => matchesLanguage(voice, lang) && !isNovelty(voice))
    .sort((a, b) => qualityScore(b) - qualityScore(a))

export const pickBestVoice = (
  voices: readonly SpeechSynthesisVoice[],
  lang: string,
) => voicesForLanguage(voices, lang)[0]

/**
 * Resolves the voice to speak with: the user's explicit choice when it is
 * available for this language, otherwise the best-ranked one.
 */
export const resolveVoice = (
  voices: readonly SpeechSynthesisVoice[],
  lang: string,
  preferredUri: string | null,
) => {
  if (preferredUri !== null) {
    const chosen = voices.find(voice => voice.voiceURI === preferredUri)
    if (chosen && matchesLanguage(chosen, lang)) {
      return chosen
    }
  }
  return pickBestVoice(voices, lang)
}
