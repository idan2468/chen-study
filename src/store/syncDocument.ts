import { createSelector } from "@reduxjs/toolkit"
import type { SyncDocumentV2 } from "@/types/schemas/syncDocument"
import { SYNC_DOCUMENT_VERSION } from "@/types/schemas/syncDocument"
import type { RootState } from "./store"

export const selectSyncDocumentV2 = createSelector(
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
  ): SyncDocumentV2 => ({
    schemaVersion: SYNC_DOCUMENT_VERSION,
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
