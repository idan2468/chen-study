import type { PayloadAction } from "@reduxjs/toolkit"
import { createSelector } from "@reduxjs/toolkit"
import { createAppSlice } from "@/store/createAppSlice"
import { keepFinalOccurrencesBy } from "@/utils/collections"
import { readLegacyUnseenState } from "@/utils/sync/legacy/legacyStorage"
import { defaultUnseenExercise } from "@/data/defaultUnseenExercise"
import type { UnseenExercise } from "@/types/unseenExercise"

export type UnseenState = {
  exercises: UnseenExercise[]
  currentId: string
  cardIndex: number
}

const loadFromStorage = (): UnseenState =>
  readLegacyUnseenState(defaultUnseenExercise)

const findExercise = (state: UnseenState, exerciseId: string) =>
  state.exercises.find(exercise => exercise.exerciseId === exerciseId)

const replaceExercise = (state: UnseenState, exercise: UnseenExercise) => {
  const replacement = {
    ...exercise,
    answers: [],
    highlights: [],
    flashcardProgress: [],
  }
  const index = state.exercises.findIndex(
    existing => existing.exerciseId === exercise.exerciseId,
  )
  if (index >= 0) {
    state.exercises[index] = replacement
  } else {
    state.exercises.push(replacement)
  }
}

export const unseenSlice = createAppSlice({
  name: "unseen",
  initialState: loadFromStorage,
  reducers: create => ({
    switchExercise: create.reducer((state, action: PayloadAction<string>) => {
      if (!findExercise(state, action.payload)) {
        return
      }
      state.currentId = action.payload
      state.cardIndex = 0
    }),

    addExercise: create.reducer(
      (state, action: PayloadAction<UnseenExercise>) => {
        const exercise = action.payload
        replaceExercise(state, exercise)
        state.currentId = exercise.exerciseId
        state.cardIndex = 0
      },
    ),

    addExercises: create.reducer(
      (state, action: PayloadAction<UnseenExercise[]>) => {
        if (action.payload.length === 0) {
          return
        }
        const finalExercises = keepFinalOccurrencesBy(
          action.payload,
          exercise => exercise.exerciseId,
        )
        for (const exercise of finalExercises) {
          replaceExercise(state, exercise)
        }
        const [first] = finalExercises
        if (first) {
          state.currentId = first.exerciseId
        }
        state.cardIndex = 0
      },
    ),

    deleteExercise: create.reducer((state, action: PayloadAction<string>) => {
      if (state.exercises.length <= 1) {
        return
      }
      const index = state.exercises.findIndex(
        exercise => exercise.exerciseId === action.payload,
      )
      if (index < 0) {
        return
      }

      state.exercises.splice(index, 1)
      if (state.currentId === action.payload) {
        const nextIndex = Math.min(index, state.exercises.length - 1)
        state.currentId = state.exercises[nextIndex]?.exerciseId ?? ""
        state.cardIndex = 0
      }
    }),

    answerQuestion: create.reducer(
      (
        state,
        action: PayloadAction<{
          questionId: string
          selected: number
          correct: boolean
        }>,
      ) => {
        const exercise = findExercise(state, state.currentId)
        if (!exercise) {
          return
        }
        const { questionId, selected, correct } = action.payload
        const existing = exercise.answers.find(
          answer => answer.questionId === questionId,
        )
        if (existing) {
          existing.selected = selected
          existing.correct = correct
        } else {
          exercise.answers.push({ questionId, selected, correct })
        }
      },
    ),

    /** Re-clicking a flashcard's current status clears it back to unmarked. */
    markFlashcard: create.reducer(
      (state, action: PayloadAction<{ word: string; isKnown: boolean }>) => {
        const exercise = findExercise(state, state.currentId)
        if (!exercise) {
          return
        }
        const { word, isKnown } = action.payload
        const index = exercise.flashcardProgress.findIndex(
          record => record.word === word,
        )
        const existing = exercise.flashcardProgress[index]
        if (existing?.isKnown === isKnown) {
          exercise.flashcardProgress.splice(index, 1)
        } else if (existing) {
          existing.isKnown = isKnown
        } else {
          exercise.flashcardProgress.push({ word, isKnown })
        }
      },
    ),

    resetFlashcardProgress: create.reducer(state => {
      const exercise = findExercise(state, state.currentId)
      if (exercise) {
        exercise.flashcardProgress = []
      }
    }),

    toggleMarkedWord: create.reducer((state, action: PayloadAction<string>) => {
      const exercise = findExercise(state, state.currentId)
      if (!exercise) {
        return
      }
      const index = exercise.highlights.findIndex(
        highlight => highlight.word === action.payload,
      )
      if (index >= 0) {
        exercise.highlights.splice(index, 1)
      } else {
        exercise.highlights.push({ word: action.payload })
      }
    }),

    setFlashcardIndex: create.reducer(
      (state, action: PayloadAction<number>) => {
        state.cardIndex = Math.max(0, action.payload)
      },
    ),

    nextFlashcard: create.reducer((state, action: PayloadAction<number>) => {
      state.cardIndex = Math.min(state.cardIndex + 1, action.payload - 1)
    }),

    prevFlashcard: create.reducer(state => {
      state.cardIndex = Math.max(state.cardIndex - 1, 0)
    }),

    reloadFromStorage: create.reducer(() => loadFromStorage()),
  }),
  selectors: {
    selectExercises: state => state.exercises,
    selectCurrentExerciseId: state => state.currentId,
    selectFlashcardIndex: state => state.cardIndex,
  },
})

export const {
  switchExercise,
  addExercise,
  addExercises,
  deleteExercise,
  answerQuestion,
  markFlashcard,
  resetFlashcardProgress,
  toggleMarkedWord,
  setFlashcardIndex,
  nextFlashcard,
  prevFlashcard,
  reloadFromStorage,
} = unseenSlice.actions

export const {
  selectExercises,
  selectCurrentExerciseId,
  selectFlashcardIndex,
} = unseenSlice.selectors

/* ---------------------------------------------------------------- *
 * Derived state.
 * ---------------------------------------------------------------- */

export const selectCurrentExercise = createSelector(
  [selectExercises, selectCurrentExerciseId],
  (exercises, currentId) =>
    exercises.find(exercise => exercise.exerciseId === currentId),
)

export const selectLibrary = createSelector([selectExercises], exercises =>
  Object.fromEntries(
    exercises.map(exercise => [exercise.exerciseId, exercise]),
  ),
)

export const selectAllMarkedWords = createSelector(
  [selectExercises],
  exercises =>
    Object.fromEntries(
      exercises.map(exercise => [
        exercise.exerciseId,
        exercise.highlights.map(({ word }) => word),
      ]),
    ),
)

export const selectAllProgress = createSelector([selectExercises], exercises =>
  Object.fromEntries(
    exercises.map(exercise => [
      exercise.exerciseId,
      Object.fromEntries(
        exercise.flashcardProgress.map(({ word, isKnown }) => [word, isKnown]),
      ),
    ]),
  ),
)

export const selectAnswers = createSelector([selectCurrentExercise], exercise =>
  Object.fromEntries(
    (exercise?.answers ?? []).map(({ questionId, selected, correct }) => [
      questionId,
      { selected, correct },
    ]),
  ),
)

export const selectExerciseOptions = createSelector(
  [selectExercises],
  exercises =>
    exercises.map(exercise => ({
      value: exercise.exerciseId,
      // `exerciseLabel` from the original: subtitle first, emoji stripped.
      label: (exercise.subtitle || exercise.title || exercise.exerciseId)
        .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
        .trim(),
      completed:
        exercise.questions.length > 0 &&
        exercise.questions.every(
          question =>
            exercise.answers.find(answer => answer.questionId === question.id)
              ?.correct === true,
        ),
    })),
)

export const selectCurrentProgress = createSelector(
  [selectCurrentExercise],
  exercise =>
    Object.fromEntries(
      (exercise?.flashcardProgress ?? []).map(({ word, isKnown }) => [
        word,
        isKnown,
      ]),
    ),
)

export const selectCurrentMarkedWords = createSelector(
  [selectCurrentExercise],
  exercise => exercise?.highlights.map(({ word }) => word) ?? [],
)

export const selectCurrentFlashcard = createSelector(
  [selectCurrentExercise, selectFlashcardIndex],
  (exercise, index) => exercise?.flashcards[index],
)

export const selectFlashcardStats = createSelector(
  [selectCurrentExercise],
  exercise => {
    const flashcards = exercise?.flashcards ?? []
    let known = 0
    let unknown = 0
    for (const card of flashcards) {
      const status = exercise?.flashcardProgress.find(
        record => record.word === card.en,
      )?.isKnown
      if (status === true) {
        known += 1
      } else if (status === false) {
        unknown += 1
      }
    }
    return { known, unknown, total: flashcards.length }
  },
)

/**
 * Lowercased flashcard words plus naive `+s` / `+es` plurals, used to highlight
 * vocabulary inside the passage. Ported from `getVocabSet`
 * (`Unseen New.html:1593`), including its deliberate crudeness.
 */
export const selectVocabSet = createSelector(
  [selectCurrentExercise],
  exercise => {
    const vocab = new Set<string>()
    for (const card of exercise?.flashcards ?? []) {
      const word = card.en.toLowerCase()
      vocab.add(word)
      vocab.add(`${word}s`)
      vocab.add(`${word}es`)
    }
    return vocab
  },
)
