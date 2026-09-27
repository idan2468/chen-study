import { createAction, createSelector } from "@reduxjs/toolkit"
import { readJson, writeJson } from "@/store/storage"
import type { PersistedState } from "@/types/schemas/persistedState"
import {
  PERSISTED_STATE_VERSION,
  persistedStateSchema,
} from "@/types/schemas/persistedState"
import type { RootState } from "./store"

export const PERSISTED_STATE_KEY = "english_progress_v2"

/**
 * Every slice re-reads storage in one reducer pass. Separate per-slice reloads
 * would let the write-through save a half-reloaded state over local v2.
 */
export const reloadFromStorage = createAction(
  "persistedState/reloadFromStorage",
)

export const selectPersistedState = createSelector(
  [
    (state: RootState) => state.unseen.exercises,
    (state: RootState) => state.unseen.currentId,
    (state: RootState) => state.unseen.cardIndex,
    (state: RootState) => state.modules.modules,
    (state: RootState) => state.modules.progress,
    (state: RootState) => state.modules.currentModuleId,
    (state: RootState) => state.modules.cardIndex,
    (state: RootState) => state.settings.dyslexiaFont,
    (state: RootState) => state.settings.shuffleUnseenAnswers,
    (state: RootState) => state.settings.speechRateByLang,
  ],
  (
    exercises,
    currentId,
    unseenCardIndex,
    modules,
    progress,
    currentModuleId,
    moduleCardIndex,
    dyslexiaFont,
    shuffleUnseenAnswers,
    speechRateByLang,
  ): PersistedState => ({
    schemaVersion: PERSISTED_STATE_VERSION,
    unseen: { exercises, currentId, cardIndex: unseenCardIndex },
    modules: {
      modules,
      progress,
      currentModuleId,
      cardIndex: moduleCardIndex,
    },
    preferences: { dyslexiaFont, shuffleUnseenAnswers, speechRateByLang },
  }),
)

/** `null` when missing or invalid, so the caller falls back to legacy storage. */
export const readLocalPersistedState = (): PersistedState | null => {
  const stored = readJson<unknown>(PERSISTED_STATE_KEY, null)
  if (stored === null) {
    return null
  }
  const parsed = persistedStateSchema.safeParse(stored)
  if (!parsed.success) {
    console.warn(`Ignoring invalid "${PERSISTED_STATE_KEY}"`, parsed.error)
    return null
  }
  return parsed.data
}

export const writeLocalPersistedState = (state: PersistedState) => {
  writeJson(PERSISTED_STATE_KEY, state)
}
