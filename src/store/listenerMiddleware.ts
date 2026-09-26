import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit"
import type { AppDispatch, RootState } from "./store"
import { removeKey, writeFlag, writeJson, writeString } from "./storage"
import {
  flashcardStatusKey,
  StorageKeys,
  toLegacyFlashcardProgress,
  toLegacyMarkedWords,
  toLegacyModuleProgress,
  toLegacyUnseenAnswers,
  toLegacyUnseenLibrary,
} from "@/utils/sync/legacy/legacyStorage"
import type { SettingsState } from "./slices/settingsSlice"
import {
  setDyslexiaFont,
  setSpeechRate,
  setSystemVoiceUri,
  SpeechLang,
  toggleDyslexiaFont,
  toggleShuffleUnseenAnswers,
} from "./slices/settingsSlice"
import type { UnseenState } from "./slices/unseenSlice"
import {
  addExercise,
  addExercises,
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
 * HTML apps used (see `src/utils/sync/legacy/legacyStorage.ts`).
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

const persistShuffleUnseenAnswers = (
  previous: SettingsState,
  next: SettingsState,
) => {
  if (previous.shuffleUnseenAnswers !== next.shuffleUnseenAnswers) {
    writeFlag(StorageKeys.shuffleUnseenAnswers, next.shuffleUnseenAnswers)
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
    toggleShuffleUnseenAnswers,
  ),
  effect: (_action, api) => {
    const previous = api.getOriginalState().settings
    const next = api.getState().settings

    persistDyslexiaFont(previous, next)
    persistShuffleUnseenAnswers(previous, next)
    persistSpeechPreferences(previous, next)
  },
})

/* ------------------------------ unseen ------------------------------ */

const legacyShapeChanged = (previous: unknown, next: unknown) =>
  JSON.stringify(previous) !== JSON.stringify(next)

const persistLibrary = (previous: UnseenState, next: UnseenState) => {
  const previousLibrary = toLegacyUnseenLibrary(previous.exercises)
  const nextLibrary = toLegacyUnseenLibrary(next.exercises)
  if (legacyShapeChanged(previousLibrary, nextLibrary)) {
    writeJson(StorageKeys.exerciseLibrary, nextLibrary)
  }

  if (previous.currentId !== next.currentId) {
    writeString(StorageKeys.currentExerciseId, next.currentId)
  }

  const currentExercise = nextLibrary[next.currentId]
  if (
    currentExercise &&
    (previous.currentId !== next.currentId ||
      legacyShapeChanged(
        toLegacyUnseenLibrary(previous.exercises)[next.currentId],
        currentExercise,
      ))
  ) {
    writeJson(StorageKeys.currentExerciseData, currentExercise)
  }
}

const persistMarkedWords = (previous: UnseenState, next: UnseenState) => {
  const previousWords = toLegacyMarkedWords(previous.exercises)
  const nextWords = toLegacyMarkedWords(next.exercises)
  if (legacyShapeChanged(previousWords, nextWords)) {
    writeJson(StorageKeys.markedWords, nextWords)
  }
}

const persistReadingProgress = (previous: UnseenState, next: UnseenState) => {
  if (previous.cardIndex !== next.cardIndex) {
    writeJson(StorageKeys.flashcardIndex, next.cardIndex)
  }
  const previousAnswers = toLegacyUnseenAnswers(previous.exercises)
  const nextAnswers = toLegacyUnseenAnswers(next.exercises)
  if (legacyShapeChanged(previousAnswers, nextAnswers)) {
    writeJson(StorageKeys.quizAnswers, nextAnswers)
  }
}

const persistFlashcardProgress = (previous: UnseenState, next: UnseenState) => {
  const previousById = Object.fromEntries(
    previous.exercises.map(exercise => [exercise.exerciseId, exercise]),
  )
  const nextIds = new Set(next.exercises.map(exercise => exercise.exerciseId))

  for (const exercise of next.exercises) {
    const previousExercise = previousById[exercise.exerciseId]
    const previousProgress = previousExercise
      ? toLegacyFlashcardProgress(previousExercise)
      : undefined
    const nextProgress = toLegacyFlashcardProgress(exercise)
    if (legacyShapeChanged(previousProgress, nextProgress)) {
      writeJson(flashcardStatusKey(exercise.exerciseId), nextProgress)
    }
  }
  for (const exercise of previous.exercises) {
    if (!nextIds.has(exercise.exerciseId)) {
      removeKey(flashcardStatusKey(exercise.exerciseId))
    }
  }
}

startListening({
  matcher: isAnyOf(
    switchExercise,
    addExercise,
    addExercises,
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
    // docs/sync/persistence-gaps.md).
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
      writeJson(
        StorageKeys.modulesProgress,
        toLegacyModuleProgress(next.progress),
      )
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
