import { createListenerMiddleware } from "@reduxjs/toolkit"
import type { AppDispatch, RootState } from "./store"
import { writeString } from "./storage"
import { StorageKeys } from "@/utils/sync/legacy/legacyStorage"
import {
  selectPersistedState,
  writeLocalPersistedState,
} from "./persistedState"
import { setSystemVoiceUri } from "./slices/settingsSlice"
import { SpeechLang } from "@/types/speech"

/**
 * Writes state through to localStorage: the persisted state as one document,
 * plus the device-local system voices it deliberately leaves out.
 */
export const listenerMiddleware = createListenerMiddleware()

const startListening = listenerMiddleware.startListening.withTypes<
  RootState,
  AppDispatch
>()

const SYSTEM_VOICE_KEYS: Record<SpeechLang, string> = {
  [SpeechLang.English]: StorageKeys.systemVoice,
  [SpeechLang.Hebrew]: StorageKeys.systemVoiceHe,
}

startListening({
  actionCreator: setSystemVoiceUri,
  effect: ({ payload }) => {
    // An empty string means "best available", so the key round-trips.
    writeString(SYSTEM_VOICE_KEYS[payload.lang], payload.uri ?? "")
  },
})

startListening({
  predicate: (_action, current, previous) =>
    selectPersistedState(current) !== selectPersistedState(previous),
  effect: (_action, api) => {
    writeLocalPersistedState(selectPersistedState(api.getState()))
  },
})
