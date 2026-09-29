import type { PayloadAction } from "@reduxjs/toolkit"
import { createAppSlice } from "@/store/createAppSlice"
import { DeviceStorageKeys } from "@/store/deviceStorageKeys"
import {
  readLocalPersistedState,
  reloadFromStorage,
} from "@/store/persistedState"
import { readString } from "@/store/storage"
import type { TimestampedAction } from "@/store/updatedAt"
import { withUpdatedAt, withUpdatedAtOnly } from "@/store/updatedAt"
import { speechRateSchema } from "@/types/schemas/persistedState"
import { DEFAULT_SPEECH_RATE, SpeechLang } from "@/types/speech"
import type { PersistedState } from "@/types/schemas/persistedState"
import type { VersionedValue } from "@/types/versionedValue"
import {
  setValueIfChanged,
  toVersionedValue,
} from "@/utils/sync/versionedValue"

/**
 * Cross-page user preferences.
 *
 * The colour scheme is deliberately *not* here -- Mantine owns it via
 * `useMantineColorScheme` and the custom manager in `src/theme.ts`. Neither is
 * the UI language, which `react-i18next` owns; see `i18n/useLocale.ts`.
 */

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

const defaultPreferences = (): PersistedState["preferences"] => ({
  dyslexiaFont: toVersionedValue(false),
  shuffleUnseenAnswers: toVersionedValue(false),
  speechRateByLang: {
    [SpeechLang.English]: toVersionedValue(DEFAULT_SPEECH_RATE),
    [SpeechLang.Hebrew]: toVersionedValue(DEFAULT_SPEECH_RATE),
  },
})

const loadFromStorage = (): SettingsState => {
  const { dyslexiaFont, shuffleUnseenAnswers, speechRateByLang } =
    readLocalPersistedState()?.preferences ?? defaultPreferences()
  const storedSystemVoice = readString(DeviceStorageKeys.systemVoice, "")
  const storedSystemVoiceHe = readString(DeviceStorageKeys.systemVoiceHe, "")

  return {
    dyslexiaFont,
    shuffleUnseenAnswers,
    speechRateByLang,
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
      withUpdatedAtOnly,
      (state, action: TimestampedAction) => {
        setValueIfChanged(
          state.dyslexiaFont,
          !state.dyslexiaFont.value,
          action.meta.updatedAt,
        )
      },
    ),
    setDyslexiaFont: create.preparedReducer(
      withUpdatedAt<boolean>,
      (state, action: TimestampedAction<boolean>) => {
        setValueIfChanged(
          state.dyslexiaFont,
          action.payload,
          action.meta.updatedAt,
        )
      },
    ),
    toggleShuffleUnseenAnswers: create.preparedReducer(
      withUpdatedAtOnly,
      (state, action: TimestampedAction) => {
        setValueIfChanged(
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
        setValueIfChanged(
          state.speechRateByLang[action.payload.lang],
          speechRateSchema
            .catch(DEFAULT_SPEECH_RATE)
            .parse(action.payload.rate),
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
  }),
  extraReducers: builder => {
    builder.addCase(reloadFromStorage, () => loadFromStorage())
  },
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
} = settingsSlice.actions

export const {
  selectDyslexiaFont,
  selectShuffleUnseenAnswers,
  selectSpeechRate,
  selectSystemVoiceUri,
} = settingsSlice.selectors
