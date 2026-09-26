import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit"
import type { AppDispatch, RootState } from "./store"
import { removeKey, writeFlag, writeJson, writeString } from "./storage"
import {
  flashcardStatusKey,
  StorageKeys,
  toLegacyDeletedBuiltInIds,
  toLegacyFlashcardProgress,
  toLegacyMarkedWords,
  toLegacyModuleProgress,
  toLegacyUnseenAnswers,
  toLegacyUnseenLibrary,
} from "@/utils/sync/legacy/legacyStorage"
import { liveValues } from "@/utils/sync/versionedValue"
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
  if (previous.dyslexiaFont.value !== next.dyslexiaFont.value) {
    writeFlag(StorageKeys.dyslexiaFont, next.dyslexiaFont.value)
  }
}

const persistShuffleUnseenAnswers = (
  previous: SettingsState,
  next: SettingsState,
) => {
  if (previous.shuffleUnseenAnswers.value !== next.shuffleUnseenAnswers.value) {
    writeFlag(StorageKeys.shuffleUnseenAnswers, next.shuffleUnseenAnswers.value)
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
    const nextRate = next.speechRateByLang[lang].value
    if (previous.speechRateByLang[lang].value !== nextRate) {
      writeString(rateKeys[lang], String(nextRate))
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

const liveExercises = (state: UnseenState) => liveValues(state.exercises)

const persistLibrary = (previous: UnseenState, next: UnseenState) => {
  const previousLibrary = toLegacyUnseenLibrary(liveExercises(previous))
  const nextLibrary = toLegacyUnseenLibrary(liveExercises(next))
  if (legacyShapeChanged(previousLibrary, nextLibrary)) {
    writeJson(StorageKeys.exerciseLibrary, nextLibrary)
  }

  const currentId = next.currentId.value
  const currentIdChanged = previous.currentId.value !== currentId
  if (currentIdChanged) {
    writeString(StorageKeys.currentExerciseId, currentId)
  }

  const currentExercise = nextLibrary[currentId]
  if (
    currentExercise &&
    (currentIdChanged ||
      legacyShapeChanged(previousLibrary[currentId], currentExercise))
  ) {
    writeJson(StorageKeys.currentExerciseData, currentExercise)
  }
}

const persistMarkedWords = (previous: UnseenState, next: UnseenState) => {
  const previousWords = toLegacyMarkedWords(liveExercises(previous))
  const nextWords = toLegacyMarkedWords(liveExercises(next))
  if (legacyShapeChanged(previousWords, nextWords)) {
    writeJson(StorageKeys.markedWords, nextWords)
  }
}

const persistReadingProgress = (previous: UnseenState, next: UnseenState) => {
  if (previous.cardIndex.value !== next.cardIndex.value) {
    writeJson(StorageKeys.flashcardIndex, next.cardIndex.value)
  }
  const previousAnswers = toLegacyUnseenAnswers(liveExercises(previous))
  const nextAnswers = toLegacyUnseenAnswers(liveExercises(next))
  if (legacyShapeChanged(previousAnswers, nextAnswers)) {
    writeJson(StorageKeys.quizAnswers, nextAnswers)
  }
}

const persistFlashcardProgress = (previous: UnseenState, next: UnseenState) => {
  const previousExercises = liveExercises(previous)
  const nextExercises = liveExercises(next)
  const previousById = Object.fromEntries(
    previousExercises.map(exercise => [exercise.exerciseId, exercise]),
  )
  const nextIds = new Set(nextExercises.map(exercise => exercise.exerciseId))

  for (const exercise of nextExercises) {
    const previousExercise = previousById[exercise.exerciseId]
    const previousProgress = previousExercise
      ? toLegacyFlashcardProgress(previousExercise)
      : undefined
    const nextProgress = toLegacyFlashcardProgress(exercise)
    if (legacyShapeChanged(previousProgress, nextProgress)) {
      writeJson(flashcardStatusKey(exercise.exerciseId), nextProgress)
    }
  }
  for (const exercise of previousExercises) {
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
      writeJson(StorageKeys.allModules, liveValues(next.modules))
      const nextDeletedIds = toLegacyDeletedBuiltInIds(next.modules)
      if (
        legacyShapeChanged(
          toLegacyDeletedBuiltInIds(previous.modules),
          nextDeletedIds,
        )
      ) {
        writeJson(StorageKeys.deletedBuiltInModules, nextDeletedIds)
      }
    }

    if (previous.progress !== next.progress) {
      writeJson(
        StorageKeys.modulesProgress,
        toLegacyModuleProgress(next.progress),
      )
    }

    if (previous.cardIndex.value !== next.cardIndex.value) {
      writeJson(StorageKeys.moduleCardIndex, next.cardIndex.value)
    }

    if (previous.currentModuleId.value !== next.currentModuleId.value) {
      writeString(StorageKeys.currentModuleId, next.currentModuleId.value)
    }
  },
})
