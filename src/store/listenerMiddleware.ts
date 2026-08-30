import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit"
import type { AppDispatch, RootState } from "./store"
import { removeKey, writeFlag, writeJson, writeString } from "./storage"
import { flashcardStatusKey, StorageKeys } from "@/utils/sync/storageKeys"
import type { SettingsState } from "./slices/settingsSlice"
import {
  setDyslexiaFont,
  setSpeechRate,
  setSystemVoiceUri,
  SpeechLang,
  toggleDyslexiaFont,
} from "./slices/settingsSlice"
import type { UnseenState } from "./slices/unseenSlice"
import {
  addExercise,
  answerQuestion,
  deleteExercise,
  markFlashcard,
  nextFlashcard,
  prevFlashcard,
  resetFlashcardProgress,
  setFlashcardIndex,
  switchExercise,
  toggleMarkedWord,
} from "./slices/unseenSlice"
import {
  addModules,
  deleteModule,
  markCard,
  nextCard,
  prevCard,
  resetCurrentModuleProgress,
  selectModule,
  setCardIndex,
  toggleFilterMissed,
  toggleMissedReview,
} from "./slices/modulesSlice"

/**
 * Writes state through to localStorage, keeping the exact keys the original
 * HTML apps used (see `src/utils/sync/storageKeys.ts` for why that matters).
 *
 * Because one slice maps to several keys, each effect compares
 * `getOriginalState()` with the new state and writes only what actually
 * changed -- so marking a single flashcard rewrites one
 * `flashcards_status_<id>` key rather than the whole library.
 */
export const listenerMiddleware = createListenerMiddleware()

const startListening = listenerMiddleware.startListening.withTypes<
  RootState,
  AppDispatch
>()

/* ----------------------------- settings ----------------------------- */

const persistDyslexiaFont = (previous: SettingsState, next: SettingsState) => {
  if (previous.dyslexiaFont !== next.dyslexiaFont) {
    writeFlag(StorageKeys.dyslexiaFont, next.dyslexiaFont)
  }
}

/** Rate and voice each have an English and a Hebrew key -- looping the pair
 *  keeps this from being four copies of the same three lines. */
const persistSpeechPreferences = (
  previous: SettingsState,
  next: SettingsState,
) => {
  const rateKeys: Record<SpeechLang, string> = {
    [SpeechLang.English]: StorageKeys.speechRate,
    [SpeechLang.Hebrew]: StorageKeys.speechRateHe,
  }
  for (const lang of Object.values(SpeechLang)) {
    if (previous.speechRateByLang[lang] !== next.speechRateByLang[lang]) {
      writeString(rateKeys[lang], String(next.speechRateByLang[lang]))
    }
  }

  const voiceKeys: Record<SpeechLang, string> = {
    [SpeechLang.English]: StorageKeys.systemVoice,
    [SpeechLang.Hebrew]: StorageKeys.systemVoiceHe,
  }
  for (const lang of Object.values(SpeechLang)) {
    if (
      previous.systemVoiceUriByLang[lang] !== next.systemVoiceUriByLang[lang]
    ) {
      // An empty string means "best available", so the key round-trips.
      writeString(voiceKeys[lang], next.systemVoiceUriByLang[lang] ?? "")
    }
  }
}

startListening({
  matcher: isAnyOf(
    toggleDyslexiaFont,
    setDyslexiaFont,
    setSpeechRate,
    setSystemVoiceUri,
  ),
  effect: (_action, api) => {
    const previous = api.getOriginalState().settings
    const next = api.getState().settings

    persistDyslexiaFont(previous, next)
    persistSpeechPreferences(previous, next)
  },
})

/* ------------------------------ unseen ------------------------------ */

/** The library itself, the active id, and the legacy single-exercise mirror. */
const persistLibrary = (previous: UnseenState, next: UnseenState) => {
  if (previous.library !== next.library) {
    writeJson(StorageKeys.exerciseLibrary, next.library)
  }

  if (previous.currentId !== next.currentId) {
    writeString(StorageKeys.currentExerciseId, next.currentId)
  }

  // Legacy mirror of the active exercise, still read by the original HTML.
  const currentExercise = next.library[next.currentId]
  if (
    currentExercise &&
    (previous.currentId !== next.currentId ||
      previous.library[next.currentId] !== currentExercise)
  ) {
    writeJson(StorageKeys.currentExerciseData, currentExercise)
  }
}

const persistMarkedWords = (previous: UnseenState, next: UnseenState) => {
  if (previous.markedWords !== next.markedWords) {
    writeJson(StorageKeys.markedWords, next.markedWords)
  }
}

/** Written unconditionally (not diffed per-exercise like `progress`) since
 *  the reducers already reset both on every exercise switch. */
const persistReadingProgress = (previous: UnseenState, next: UnseenState) => {
  if (previous.cardIndex !== next.cardIndex) {
    writeJson(StorageKeys.flashcardIndex, next.cardIndex)
  }
  if (previous.answers !== next.answers) {
    writeJson(StorageKeys.quizAnswers, next.answers)
  }
}

/**
 * One key per exercise: writes only the ones whose contents changed, and
 * drops keys for exercises that were deleted.
 */
const persistFlashcardProgress = (previous: UnseenState, next: UnseenState) => {
  if (previous.progress === next.progress) {
    return
  }

  for (const [id, progress] of Object.entries(next.progress)) {
    if (previous.progress[id] !== progress) {
      writeJson(flashcardStatusKey(id), progress)
    }
  }
  for (const id of Object.keys(previous.progress)) {
    if (!(id in next.progress)) {
      removeKey(flashcardStatusKey(id))
    }
  }
}

startListening({
  matcher: isAnyOf(
    switchExercise,
    addExercise,
    deleteExercise,
    markFlashcard,
    resetFlashcardProgress,
    toggleMarkedWord,
    answerQuestion,
    setFlashcardIndex,
    nextFlashcard,
    prevFlashcard,
  ),
  effect: (_action, api) => {
    const previous = api.getOriginalState().unseen
    const next = api.getState().unseen

    persistLibrary(previous, next)
    persistMarkedWords(previous, next)
    persistFlashcardProgress(previous, next)
    persistReadingProgress(previous, next)
  },
})

/* ------------------------------ modules ----------------------------- */

startListening({
  matcher: isAnyOf(
    addModules,
    deleteModule,
    markCard,
    resetCurrentModuleProgress,
    selectModule,
    setCardIndex,
    nextCard,
    prevCard,
    // Included only to capture the `cardIndex` reset these also perform,
    // not to persist `filterMissed`/`reviewingMissed` (see
    // docs/persistence-gaps.md).
    toggleFilterMissed,
    toggleMissedReview,
  ),
  effect: (_action, api) => {
    const previous = api.getOriginalState().modules
    const next = api.getState().modules

    if (previous.modules !== next.modules) {
      writeJson(StorageKeys.allModules, next.modules)
    }

    if (previous.progress !== next.progress) {
      writeJson(StorageKeys.modulesProgress, next.progress)
    }

    if (previous.deletedBuiltInIds !== next.deletedBuiltInIds) {
      writeJson(StorageKeys.deletedBuiltInModules, next.deletedBuiltInIds)
    }

    if (previous.cardIndex !== next.cardIndex) {
      writeJson(StorageKeys.moduleCardIndex, next.cardIndex)
    }

    if (previous.currentModuleId !== next.currentModuleId) {
      writeString(StorageKeys.currentModuleId, next.currentModuleId)
    }
  },
})
