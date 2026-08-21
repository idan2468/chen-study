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
export type SettingsState = {
  dyslexiaFont: boolean
  /** `speechSynthesis` utterance rate, 0.1 - 1.0. */
  speechRate: number
  /** `voiceURI` of the preferred system voice, or `null` for "best available". */
  systemVoiceUri: string | null
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

  return {
    dyslexiaFont: readFlag(StorageKeys.dyslexiaFont, false),
    speechRate: clampRate(
      Number.parseFloat(readString(StorageKeys.speechRate, "")),
    ),
    systemVoiceUri: storedSystemVoice === "" ? null : storedSystemVoice,
  }
}

export const settingsSlice = createAppSlice({
  name: "settings",
  // Lazy initializer: localStorage is read when the store is created, not when
  // this module is imported, so `importSyncFromUrl()` can run first.
  initialState: loadFromStorage,
  reducers: create => ({
    toggleDyslexiaFont: create.reducer(state => {
      state.dyslexiaFont = !state.dyslexiaFont
    }),
    setDyslexiaFont: create.reducer((state, action: PayloadAction<boolean>) => {
      state.dyslexiaFont = action.payload
    }),
    setSpeechRate: create.reducer((state, action: PayloadAction<number>) => {
      state.speechRate = clampRate(action.payload)
    }),
    setSystemVoiceUri: create.reducer(
      (state, action: PayloadAction<string | null>) => {
        state.systemVoiceUri = action.payload
      },
    ),
    reloadFromStorage: create.reducer(() => loadFromStorage()),
  }),
  selectors: {
    selectDyslexiaFont: settings => settings.dyslexiaFont,
    selectSpeechRate: settings => settings.speechRate,
    selectSystemVoiceUri: settings => settings.systemVoiceUri,
  },
})

export const {
  toggleDyslexiaFont,
  setDyslexiaFont,
  setSpeechRate,
  setSystemVoiceUri,
  reloadFromStorage,
} = settingsSlice.actions

export const { selectDyslexiaFont, selectSpeechRate, selectSystemVoiceUri } =
  settingsSlice.selectors
