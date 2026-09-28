/** `speechSynthesis` rates the app allows; the persisted-state schema enforces the same range. */
export const MIN_SPEECH_RATE = 0.1
export const MAX_SPEECH_RATE = 1
export const DEFAULT_SPEECH_RATE = 0.5

/** Pulls a rate into range; a non-finite value (e.g. an unset legacy key) becomes the default. */
export const clampSpeechRate = (rate: number) =>
  Number.isFinite(rate)
    ? Math.min(MAX_SPEECH_RATE, Math.max(MIN_SPEECH_RATE, rate))
    : DEFAULT_SPEECH_RATE
