/** The two languages speech settings are tracked for -- distinct from
 *  `i18n`'s `Locale`, which is the UI chrome language. */
export enum SpeechLang {
  English = "en",
  Hebrew = "he",
}

/** `speechSynthesis` rates the app allows; the persisted-state schema enforces them. */
export const MIN_SPEECH_RATE = 0.1
export const MAX_SPEECH_RATE = 1
export const DEFAULT_SPEECH_RATE = 0.5
