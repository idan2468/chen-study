import type { PayloadAction } from "@reduxjs/toolkit"
import { createAppSlice } from "@/store/createAppSlice"
import { readFlag, readString } from "@/store/storage"
import type { TimestampedAction } from "@/store/updatedAt"
import { withUpdatedAt } from "@/store/updatedAt"
import type { VersionedValue } from "@/types/versionedValue"
import { StorageKeys } from "@/utils/sync/legacy/legacyStorage"
import {
  setVersionedValue,
  toVersionedValue,
} from "@/utils/sync/versionedValue"

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
  dyslexiaFont: VersionedValue<boolean>
  shuffleUnseenAnswers: VersionedValue<boolean>
  /** `speechSynthesis` rate per language, 0.1 - 1.0. Independent per
   *  language so e.g. a Hebrew explanation can read slower than English. */
  speechRateByLang: Record<SpeechLang, VersionedValue<number>>
  /** Preferred system voice per language, or `null` for "best available".
   *  Device-local, so not versioned. */
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
    dyslexiaFont: toVersionedValue(readFlag(StorageKeys.dyslexiaFont, false)),
    shuffleUnseenAnswers: toVersionedValue(
      readFlag(StorageKeys.shuffleUnseenAnswers, false),
    ),
    speechRateByLang: {
      [SpeechLang.English]: toVersionedValue(
        clampRate(Number.parseFloat(readString(StorageKeys.speechRate, ""))),
      ),
      [SpeechLang.Hebrew]: toVersionedValue(
        clampRate(Number.parseFloat(readString(StorageKeys.speechRateHe, ""))),
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
    toggleDyslexiaFont: create.preparedReducer(
      () => withUpdatedAt(undefined),
      (state, action: TimestampedAction) => {
        setVersionedValue(
          state.dyslexiaFont,
          !state.dyslexiaFont.value,
          action.meta.updatedAt,
        )
      },
    ),
    setDyslexiaFont: create.preparedReducer(
      withUpdatedAt<boolean>,
      (state, action: TimestampedAction<boolean>) => {
        setVersionedValue(
          state.dyslexiaFont,
          action.payload,
          action.meta.updatedAt,
        )
      },
    ),
    toggleShuffleUnseenAnswers: create.preparedReducer(
      () => withUpdatedAt(undefined),
      (state, action: TimestampedAction) => {
        setVersionedValue(
          state.shuffleUnseenAnswers,
          !state.shuffleUnseenAnswers.value,
          action.meta.updatedAt,
        )
      },
    ),
    setSpeechRate: create.preparedReducer(
      withUpdatedAt<{ lang: SpeechLang; rate: number }>,
      (
        state,
        action: TimestampedAction<{ lang: SpeechLang; rate: number }>,
      ) => {
        setVersionedValue(
          state.speechRateByLang[action.payload.lang],
          clampRate(action.payload.rate),
          action.meta.updatedAt,
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
    selectDyslexiaFont: settings => settings.dyslexiaFont.value,
    selectShuffleUnseenAnswers: settings => settings.shuffleUnseenAnswers.value,
    selectSpeechRate: (settings, lang: SpeechLang) =>
      settings.speechRateByLang[lang].value,
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
