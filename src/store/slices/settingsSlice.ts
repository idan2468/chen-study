import type { PayloadAction } from "@reduxjs/toolkit"
import { createAppSlice } from "@/store/createAppSlice"
import { readFlag, readString } from "@/store/storage"
import { StorageKeys } from "@/utils/sync/storageKeys"

/**
 * Cross-page user preferences.
 *
 * The colour scheme is deliberately *not* here -- Mantine owns it via
 * `useMantineColorScheme` and the custom manager in `src/theme.ts`. Neither is
 * the UI language, which `react-i18next` owns; see `i18n/useLocale.ts`.
 */

/** The two languages speech settings are tracked for -- distinct from
 *  `i18n`'s `Locale`, which is the UI chrome language. */
export enum SpeechLang {
  English = "en",
  Hebrew = "he",
}

export type SettingsState = {
  dyslexiaFont: boolean
  shuffleUnseenAnswers: boolean
  /** `speechSynthesis` rate per language, 0.1 - 1.0. Independent per
   *  language so e.g. a Hebrew explanation can read slower than English. */
  speechRateByLang: Record<SpeechLang, number>
  /** Preferred system voice per language, or `null` for "best available". */
  systemVoiceUriByLang: Record<SpeechLang, string | null>
}

export const MIN_SPEECH_RATE = 0.1
export const MAX_SPEECH_RATE = 1
export const DEFAULT_SPEECH_RATE = 0.5

const clampRate = (value: number) => {
  if (!Number.isFinite(value)) {
    return DEFAULT_SPEECH_RATE
  }
  return Math.min(MAX_SPEECH_RATE, Math.max(MIN_SPEECH_RATE, value))
}

const loadFromStorage = (): SettingsState => {
  const storedSystemVoice = readString(StorageKeys.systemVoice, "")
  const storedSystemVoiceHe = readString(StorageKeys.systemVoiceHe, "")

  return {
    dyslexiaFont: readFlag(StorageKeys.dyslexiaFont, false),
    shuffleUnseenAnswers: readFlag(StorageKeys.shuffleUnseenAnswers, false),
    speechRateByLang: {
      [SpeechLang.English]: clampRate(
        Number.parseFloat(readString(StorageKeys.speechRate, "")),
      ),
      [SpeechLang.Hebrew]: clampRate(
        Number.parseFloat(readString(StorageKeys.speechRateHe, "")),
      ),
    },
    systemVoiceUriByLang: {
      [SpeechLang.English]: storedSystemVoice === "" ? null : storedSystemVoice,
      [SpeechLang.Hebrew]:
        storedSystemVoiceHe === "" ? null : storedSystemVoiceHe,
    },
  }
}

export const settingsSlice = createAppSlice({
  name: "settings",
  initialState: loadFromStorage,
  reducers: create => ({
    toggleDyslexiaFont: create.reducer(state => {
      state.dyslexiaFont = !state.dyslexiaFont
    }),
    setDyslexiaFont: create.reducer((state, action: PayloadAction<boolean>) => {
      state.dyslexiaFont = action.payload
    }),
    toggleShuffleUnseenAnswers: create.reducer(state => {
      state.shuffleUnseenAnswers = !state.shuffleUnseenAnswers
    }),
    setSpeechRate: create.reducer(
      (state, action: PayloadAction<{ lang: SpeechLang; rate: number }>) => {
        state.speechRateByLang[action.payload.lang] = clampRate(
          action.payload.rate,
        )
      },
    ),
    setSystemVoiceUri: create.reducer(
      (
        state,
        action: PayloadAction<{ lang: SpeechLang; uri: string | null }>,
      ) => {
        state.systemVoiceUriByLang[action.payload.lang] = action.payload.uri
      },
    ),
    reloadFromStorage: create.reducer(() => loadFromStorage()),
  }),
  selectors: {
    selectDyslexiaFont: settings => settings.dyslexiaFont,
    selectShuffleUnseenAnswers: settings => settings.shuffleUnseenAnswers,
    selectSpeechRate: (settings, lang: SpeechLang) =>
      settings.speechRateByLang[lang],
    selectSystemVoiceUri: (settings, lang: SpeechLang) =>
      settings.systemVoiceUriByLang[lang],
  },
})

export const {
  toggleDyslexiaFont,
  setDyslexiaFont,
  toggleShuffleUnseenAnswers,
  setSpeechRate,
  setSystemVoiceUri,
  reloadFromStorage,
} = settingsSlice.actions

export const {
  selectDyslexiaFont,
  selectShuffleUnseenAnswers,
  selectSpeechRate,
  selectSystemVoiceUri,
} = settingsSlice.selectors
