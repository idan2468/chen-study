import type { PayloadAction } from "@reduxjs/toolkit"
import { createSelector } from "@reduxjs/toolkit"
import { createAppSlice } from "@/store/createAppSlice"
import { deleteEntry } from "@/store/records"
import { readJson, readString } from "@/store/storage"
import { flashcardStatusKey, StorageKeys } from "@/utils/sync/storageKeys"
import { defaultUnseenExercise } from "@/data/defaultUnseenExercise"
import type {
  AnswerRecord,
  AnswersByExercise,
  ExerciseAnswers,
  FlashcardProgress,
  UnseenExercise,
} from "@/types/unseenExercise"

export type UnseenState = {
  library: Record<string, UnseenExercise>
  currentId: string
  cardIndex: number
  /** Quiz answers keyed first by exercise id, then by question id. */
  answers: AnswersByExercise
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
  library: Record<string, UnseenExercise>,
  storedId: string,
  legacy: UnseenExercise | null,
): string => {
  const candidate =
    storedId && storedId in library
      ? storedId
      : (legacy?.exerciseId ?? defaultUnseenExercise.exerciseId)
  return candidate in library ? candidate : defaultUnseenExercise.exerciseId
}

/** Progress lives in one key per exercise, so hydrate them all up front. */
const readAllFlashcardProgress = (
  library: Record<string, UnseenExercise>,
): Record<string, FlashcardProgress> => {
  const progress: Record<string, FlashcardProgress> = {}
  for (const id of Object.keys(library)) {
    progress[id] = readJson<FlashcardProgress>(flashcardStatusKey(id), {})
  }
  return progress
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const isAnswerRecord = (value: unknown): value is AnswerRecord =>
  isRecord(value) &&
  Number.isInteger(value.selected) &&
  typeof value.correct === "boolean"

const isExerciseAnswers = (value: unknown): value is ExerciseAnswers =>
  isRecord(value) && Object.values(value).every(isAnswerRecord)

/** Migrates the original active-exercise answer map into the per-exercise shape. */
const readAnswersByExercise = (currentId: string): AnswersByExercise => {
  const stored = readJson<unknown>(StorageKeys.quizAnswers, {})
  if (!isRecord(stored)) {
    return {}
  }

  const entries = Object.entries(stored)
  if (entries.length === 0) {
    return {}
  }
  if (entries.every(([, answer]) => isAnswerRecord(answer))) {
    return { [currentId]: stored as ExerciseAnswers }
  }

  const answersByExercise: AnswersByExercise = {}
  for (const [exerciseId, answers] of entries) {
    if (isExerciseAnswers(answers)) {
      answersByExercise[exerciseId] = answers
    }
  }
  return answersByExercise
}

const loadFromStorage = (): UnseenState => {
  const library = readJson<Record<string, UnseenExercise>>(
    StorageKeys.exerciseLibrary,
    {},
  )

  // The original seeded the built-in exercise on first run (`initApp`).
  library[defaultUnseenExercise.exerciseId] ??= defaultUnseenExercise

  const currentId = resolveCurrentExerciseId(
    library,
    readString(StorageKeys.currentExerciseId, ""),
    readJson<UnseenExercise | null>(StorageKeys.currentExerciseData, null),
  )

  return {
    library,
    currentId,
    // Exercise switches reset the active deck position, so this stored index
    // belongs to the resolved current exercise.
    cardIndex: readJson<number>(StorageKeys.flashcardIndex, 0),
    answers: readAnswersByExercise(currentId),
    markedWords: readJson<Record<string, string[]>>(
      StorageKeys.markedWords,
      {},
    ),
    progress: readAllFlashcardProgress(library),
  }
}

export const unseenSlice = createAppSlice({
  name: "unseen",
  initialState: loadFromStorage,
  reducers: create => ({
    switchExercise: create.reducer((state, action: PayloadAction<string>) => {
      if (!(action.payload in state.library)) {
        return
      }
      state.currentId = action.payload
      state.cardIndex = 0
    }),

    /** Upserts an imported exercise and makes it current. */
    addExercise: create.reducer(
      (state, action: PayloadAction<UnseenExercise>) => {
        const exercise = action.payload
        state.library[exercise.exerciseId] = exercise
        deleteEntry(state.answers, exercise.exerciseId)
        state.progress[exercise.exerciseId] ??= {}
        state.currentId = exercise.exerciseId
        state.cardIndex = 0
      },
    ),

    /** Upserts multiple imported exercises and makes the first one current. */
    addExercises: create.reducer(
      (state, action: PayloadAction<UnseenExercise[]>) => {
        if (action.payload.length === 0) {
          return
        }
        for (const exercise of action.payload) {
          state.library[exercise.exerciseId] = exercise
          deleteEntry(state.answers, exercise.exerciseId)
          state.progress[exercise.exerciseId] ??= {}
        }
        const [first] = action.payload
        if (first) {
          state.currentId = first.exerciseId
        }
        state.cardIndex = 0
      },
    ),

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
      deleteEntry(state.answers, action.payload)

      if (state.currentId === action.payload) {
        const remaining = Object.keys(state.library)
        state.currentId =
          remaining[Math.min(index, remaining.length - 1)] ?? remaining[0] ?? ""
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
        const { questionId, selected, correct } = action.payload
        const answers = (state.answers[state.currentId] ??= {})
        answers[questionId] = { selected, correct }
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

    reloadFromStorage: create.reducer(() => loadFromStorage()),
  }),
  selectors: {
    selectLibrary: state => state.library,
    selectCurrentExerciseId: state => state.currentId,
    selectFlashcardIndex: state => state.cardIndex,
    selectAnswersByExercise: state => state.answers,
    selectAllMarkedWords: state => state.markedWords,
    selectAllProgress: state => state.progress,
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
  selectLibrary,
  selectCurrentExerciseId,
  selectFlashcardIndex,
  selectAnswersByExercise,
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

export const selectAnswers = createSelector(
  [selectAnswersByExercise, selectCurrentExerciseId],
  (answers, currentId): ExerciseAnswers => answers[currentId] ?? {},
)

export const selectExerciseOptions = createSelector(
  [selectLibrary, selectAnswersByExercise],
  (library, answersByExercise) =>
    Object.entries(library).map(([id, exercise]) => {
      const answers = answersByExercise[id] ?? {}
      return {
        value: id,
        // `exerciseLabel` from the original: subtitle first, emoji stripped.
        label: (exercise.subtitle || exercise.title || id)
          .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
          .trim(),
        completed:
          exercise.questions.length > 0 &&
          exercise.questions.every(
            question => answers[question.id]?.correct === true,
          ),
      }
    }),
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
