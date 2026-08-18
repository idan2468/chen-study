import type { PayloadAction } from "@reduxjs/toolkit"
import { createSelector } from "@reduxjs/toolkit"
import { createAppSlice } from "@/store/createAppSlice"
import { deleteEntry } from "@/store/records"
import { readJson, readString } from "@/store/storage"
import { flashcardStatusKey, StorageKeys } from "@/utils/storageKeys"
import { defaultExercise } from "@/data/defaultExercise"
import type {
  AnswerRecord,
  Exercise,
  FlashcardProgress,
} from "@/types/exercise"

export type UnseenState = {
  library: Record<string, Exercise>
  currentId: string
  cardIndex: number
  /** Quiz answers for the active exercise, keyed by question id. */
  answers: Record<string, AnswerRecord>
  /** Highlighter marks, per exercise. */
  markedWords: Record<string, string[]>
  /** Flashcard known/unknown, per exercise. */
  progress: Record<string, FlashcardProgress>
}

/**
 * Prefers the stored id; falls back to the legacy single-exercise mirror's id;
 * falls back to the built-in default. Whatever that produces is checked
 * against the library one final time, since the legacy mirror's id is used
 * optimistically above without first confirming it is still in the library.
 */
const resolveCurrentExerciseId = (
  library: Record<string, Exercise>,
  storedId: string,
  legacy: Exercise | null,
): string => {
  const candidate =
    storedId && storedId in library
      ? storedId
      : (legacy?.exerciseId ?? defaultExercise.exerciseId)
  return candidate in library ? candidate : defaultExercise.exerciseId
}

/** Progress lives in one key per exercise, so hydrate them all up front. */
const readAllFlashcardProgress = (
  library: Record<string, Exercise>,
): Record<string, FlashcardProgress> => {
  const progress: Record<string, FlashcardProgress> = {}
  for (const id of Object.keys(library)) {
    progress[id] = readJson<FlashcardProgress>(flashcardStatusKey(id), {})
  }
  return progress
}

const readInitialState = (): UnseenState => {
  const library = readJson<Record<string, Exercise>>(
    StorageKeys.exerciseLibrary,
    {},
  )

  // The original seeded the built-in exercise on first run (`initApp`).
  library[defaultExercise.exerciseId] ??= defaultExercise

  const currentId = resolveCurrentExerciseId(
    library,
    readString(StorageKeys.currentExerciseId, ""),
    readJson<Exercise | null>(StorageKeys.currentExerciseData, null),
  )

  return {
    library,
    currentId,
    cardIndex: 0,
    // Only meaningful for whichever exercise was current when it was
    // written; the reducers already clear `answers` on every exercise
    // switch/add/delete (same as they always have), so a stale value here
    // would only ever belong to whatever is still current.
    answers: readJson<Record<string, AnswerRecord>>(
      StorageKeys.quizAnswers,
      {},
    ),
    markedWords: readJson<Record<string, string[]>>(
      StorageKeys.markedWords,
      {},
    ),
    progress: readAllFlashcardProgress(library),
  }
}

export const unseenSlice = createAppSlice({
  name: "unseen",
  // Lazy initializer, so localStorage is read at store-creation time -- after
  // any `?sync=` payload has been imported. See `src/main.tsx`.
  initialState: readInitialState,
  reducers: create => ({
    switchExercise: create.reducer((state, action: PayloadAction<string>) => {
      if (!(action.payload in state.library)) {
        return
      }
      state.currentId = action.payload
      state.cardIndex = 0
      state.answers = {}
    }),

    /** Upserts an imported exercise and makes it current. */
    addExercise: create.reducer((state, action: PayloadAction<Exercise>) => {
      const exercise = action.payload
      state.library[exercise.exerciseId] = exercise
      state.progress[exercise.exerciseId] ??= {}
      state.currentId = exercise.exerciseId
      state.cardIndex = 0
      state.answers = {}
    }),

    deleteExercise: create.reducer((state, action: PayloadAction<string>) => {
      const ids = Object.keys(state.library)
      // Refuse to leave the library empty, as the original did.
      if (ids.length <= 1 || !(action.payload in state.library)) {
        return
      }

      const index = ids.indexOf(action.payload)
      deleteEntry(state.library, action.payload)
      deleteEntry(state.progress, action.payload)
      deleteEntry(state.markedWords, action.payload)

      if (state.currentId === action.payload) {
        const remaining = Object.keys(state.library)
        state.currentId =
          remaining[Math.min(index, remaining.length - 1)] ?? remaining[0] ?? ""
        state.cardIndex = 0
        state.answers = {}
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
        const { questionId, selected, correct } = action.payload
        state.answers[questionId] = { selected, correct }
      },
    ),

    /**
     * Toggle semantics, inherited from `Unseen New.html:1995`: re-clicking the
     * status a card already has clears it back to unmarked.
     */
    markFlashcard: create.reducer(
      (state, action: PayloadAction<{ word: string; isKnown: boolean }>) => {
        const { word, isKnown } = action.payload
        const forExercise = (state.progress[state.currentId] ??= {})

        if (forExercise[word] === isKnown) {
          deleteEntry(forExercise, word)
        } else {
          forExercise[word] = isKnown
        }
      },
    ),

    resetFlashcardProgress: create.reducer(state => {
      state.progress[state.currentId] = {}
    }),

    /** Double-clicking a word in the passage highlights or un-highlights it. */
    toggleMarkedWord: create.reducer((state, action: PayloadAction<string>) => {
      const marks = (state.markedWords[state.currentId] ??= [])
      const index = marks.indexOf(action.payload)
      if (index >= 0) {
        marks.splice(index, 1)
      } else {
        marks.push(action.payload)
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
  }),
  selectors: {
    selectLibrary: state => state.library,
    selectCurrentExerciseId: state => state.currentId,
    selectFlashcardIndex: state => state.cardIndex,
    selectAnswers: state => state.answers,
    selectAllMarkedWords: state => state.markedWords,
    selectAllProgress: state => state.progress,
  },
})

export const {
  switchExercise,
  addExercise,
  deleteExercise,
  answerQuestion,
  markFlashcard,
  resetFlashcardProgress,
  toggleMarkedWord,
  setFlashcardIndex,
  nextFlashcard,
  prevFlashcard,
} = unseenSlice.actions

export const {
  selectLibrary,
  selectCurrentExerciseId,
  selectFlashcardIndex,
  selectAnswers,
  selectAllMarkedWords,
  selectAllProgress,
} = unseenSlice.selectors

/* ---------------------------------------------------------------- *
 * Derived state.
 * ---------------------------------------------------------------- */

export const selectCurrentExercise = createSelector(
  [selectLibrary, selectCurrentExerciseId],
  (library, currentId) => library[currentId],
)

export const selectExerciseOptions = createSelector([selectLibrary], library =>
  Object.entries(library).map(([id, exercise]) => ({
    value: id,
    // `exerciseLabel` from the original: subtitle first, emoji stripped.
    label: (exercise.subtitle || exercise.title || id)
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
      .trim()
      .slice(0, 60),
  })),
)

export const selectCurrentProgress = createSelector(
  [selectAllProgress, selectCurrentExerciseId],
  (progress, currentId): FlashcardProgress => progress[currentId] ?? {},
)

export const selectCurrentMarkedWords = createSelector(
  [selectAllMarkedWords, selectCurrentExerciseId],
  (marked, currentId) => marked[currentId] ?? [],
)

export const selectCurrentFlashcard = createSelector(
  [selectCurrentExercise, selectFlashcardIndex],
  (exercise, index) => exercise?.flashcards[index],
)

export const selectFlashcardStats = createSelector(
  [selectCurrentExercise, selectCurrentProgress],
  (exercise, progress) => {
    const flashcards = exercise?.flashcards ?? []
    let known = 0
    let unknown = 0
    for (const card of flashcards) {
      const status = progress[card.en]
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
