/**
 * Picking a *good* system voice, instead of just setting `utterance.lang` and
 * letting the browser default to whatever voice (often the oldest,
 * lowest-quality one) it likes.
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
 * macOS mixes joke/effect voices into `getVoices()` with no flag to tell them
 * apart, so a "best voice" heuristic can otherwise pick "Bad News" or "Boing".
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
 * Android TTS voices have no readable name, just codes like
 * `en-us-x-iol-network` / `en-us-x-iol-local`. `-network` is the cloud-backed,
 * better-sounding variant; `-local` is the on-device fallback.
 */
const ANDROID_NETWORK_SUFFIX = /-network$/i
const ANDROID_LOCAL_SUFFIX = /-local$/i

/**
 * Higher is better. Scores the modern neural/cloud voice families; legacy
 * formant voices (the typical default) score near zero, so on a machine with
 * no enhanced voices installed the OS default correctly wins.
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

  // Windows Edge/Chrome cloud voices, e.g. "Microsoft Ava Online (Natural)".
  if (name.includes("natural") || name.includes("neural")) {
    score += 80
  }
  if (name.startsWith("google")) {
    score += 60
  }
  if (name.includes("microsoft")) {
    score += 40
  }
  if (ANDROID_NETWORK_SUFFIX.test(name)) {
    score += 30
  } else if (ANDROID_LOCAL_SUFFIX.test(name)) {
    score += 5
  }
  // `localService`: on-device vs. network-backed, the one quality signal
  // every platform reports consistently, so it stacks with the checks above.
  if (!voice.localService) {
    score += 10
  }
  // Weighted above "no signal at all" so a stock install with nothing fancy
  // still gets a real, intelligible voice instead of whichever sorts first.
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
