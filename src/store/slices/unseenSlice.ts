import { createSelector } from "@reduxjs/toolkit"
import { createAppSlice } from "@/store/createAppSlice"
import {
  readLocalPersistedState,
  reloadFromStorage,
} from "@/store/persistedState"
import type { TimestampedAction } from "@/store/updatedAt"
import { withUpdatedAt, withUpdatedAtOnly } from "@/store/updatedAt"
import { hasWord, keepLastBy } from "@/utils/collections"
import { readLegacyUnseenState } from "@/utils/sync/legacy/legacyStorage"
import {
  tombstoneValue,
  findLiveValue,
  liveValues,
  markDeleted,
  upsertValue,
  setValueIfChanged,
  toVersionedValue,
} from "@/utils/sync/versionedValue"
import { defaultUnseenExercise } from "@/data/defaultUnseenExercise"
import type {
  AnswerRecord,
  FlashcardProgressRecord,
  UnseenExercise,
} from "@/types/unseenExercise"
import type { VersionedValue } from "@/types/versionedValue"
import type { IsoTimestamp } from "@/utils/sync/timestamp"

export type UnseenState = {
  exercises: VersionedValue<UnseenExercise>[]
  currentId: VersionedValue<string>
  cardIndex: VersionedValue<number>
}

const hasExerciseId = (exerciseId: string) => (exercise: UnseenExercise) =>
  exercise.exerciseId === exerciseId

/** Seeds the built-in exercise unless it has an entry (live or tombstoned); a current ID pointing at a deleted exercise falls back, starting at the first card. */
const resolveUnseenState = (stored: UnseenState): UnseenState => {
  const exercises = stored.exercises.some(entry =>
    hasExerciseId(defaultUnseenExercise.exerciseId)(entry.value),
  )
    ? stored.exercises
    : [...stored.exercises, toVersionedValue(defaultUnseenExercise)]
  const live = liveValues(exercises)
  const currentId = live.some(hasExerciseId(stored.currentId.value))
    ? stored.currentId.value
    : ((live.find(hasExerciseId(defaultUnseenExercise.exerciseId)) ?? live[0])
        ?.exerciseId ?? "")
  return {
    exercises,
    currentId: toVersionedValue(currentId, stored.currentId.updatedAt),
    cardIndex:
      currentId === stored.currentId.value
        ? stored.cardIndex
        : toVersionedValue(0, stored.cardIndex.updatedAt),
  }
}

const loadFromStorage = (): UnseenState =>
  resolveUnseenState(
    readLocalPersistedState()?.unseen ??
      readLegacyUnseenState(defaultUnseenExercise),
  )

const findExercise = (state: UnseenState, exerciseId: string) =>
  findLiveValue(state.exercises, hasExerciseId(exerciseId))

const replaceExercise = (
  state: UnseenState,
  exercise: UnseenExercise,
  updatedAt: IsoTimestamp,
) => {
  const replacement = {
    ...exercise,
    answers: [],
    highlights: [],
    flashcardProgress: [],
  }
  upsertValue(
    state.exercises,
    hasExerciseId(exercise.exerciseId),
    replacement,
    updatedAt,
  )
}

const openExercise = (
  state: UnseenState,
  exerciseId: string,
  updatedAt: IsoTimestamp,
) => {
  setValueIfChanged(state.currentId, exerciseId, updatedAt)
  setValueIfChanged(state.cardIndex, 0, updatedAt)
}

export const unseenSlice = createAppSlice({
  name: "unseen",
  initialState: loadFromStorage,
  reducers: create => ({
    switchExercise: create.preparedReducer(
      withUpdatedAt<string>,
      (state, action: TimestampedAction<string>) => {
        if (!findExercise(state, action.payload)) {
          return
        }
        openExercise(state, action.payload, action.meta.updatedAt)
      },
    ),

    addExercise: create.preparedReducer(
      withUpdatedAt<UnseenExercise>,
      (state, action: TimestampedAction<UnseenExercise>) => {
        const exercise = action.payload
        replaceExercise(state, exercise, action.meta.updatedAt)
        openExercise(state, exercise.exerciseId, action.meta.updatedAt)
      },
    ),

    addExercises: create.preparedReducer(
      withUpdatedAt<UnseenExercise[]>,
      (state, action: TimestampedAction<UnseenExercise[]>) => {
        if (action.payload.length === 0) {
          return
        }
        const finalExercises = keepLastBy(
          action.payload,
          exercise => exercise.exerciseId,
        )
        for (const exercise of finalExercises) {
          replaceExercise(state, exercise, action.meta.updatedAt)
        }
        const [first] = finalExercises
        if (first) {
          openExercise(state, first.exerciseId, action.meta.updatedAt)
        }
      },
    ),

    deleteExercise: create.preparedReducer(
      withUpdatedAt<string>,
      (state, action: TimestampedAction<string>) => {
        const exercises = liveValues(state.exercises)
        if (exercises.length <= 1) {
          return
        }
        const index = exercises.findIndex(hasExerciseId(action.payload))
        if (index < 0) {
          return
        }

        tombstoneValue(
          state.exercises,
          hasExerciseId(action.payload),
          action.meta.updatedAt,
        )
        if (state.currentId.value === action.payload) {
          const remaining = liveValues(state.exercises)
          const nextIndex = Math.min(index, remaining.length - 1)
          openExercise(
            state,
            remaining[nextIndex]?.exerciseId ?? "",
            action.meta.updatedAt,
          )
        }
      },
    ),

    answerQuestion: create.preparedReducer(
      withUpdatedAt<AnswerRecord>,
      (state, action: TimestampedAction<AnswerRecord>) => {
        const exercise = findExercise(state, state.currentId.value)
        if (!exercise) {
          return
        }
        const { questionId, selected, correct } = action.payload
        upsertValue(
          exercise.answers,
          answer => answer.questionId === questionId,
          { questionId, selected, correct },
          action.meta.updatedAt,
        )
      },
    ),

    /** Re-clicking a flashcard's current status clears it back to unmarked. */
    markFlashcard: create.preparedReducer(
      withUpdatedAt<FlashcardProgressRecord>,
      (state, action: TimestampedAction<FlashcardProgressRecord>) => {
        const exercise = findExercise(state, state.currentId.value)
        if (!exercise) {
          return
        }
        const { word, isKnown } = action.payload
        const { updatedAt } = action.meta
        const existing = findLiveValue(
          exercise.flashcardProgress,
          hasWord(word),
        )
        if (existing?.isKnown === isKnown) {
          tombstoneValue(exercise.flashcardProgress, hasWord(word), updatedAt)
        } else {
          upsertValue(
            exercise.flashcardProgress,
            hasWord(word),
            { word, isKnown },
            updatedAt,
          )
        }
      },
    ),

    resetFlashcardProgress: create.preparedReducer(
      withUpdatedAtOnly,
      (state, action: TimestampedAction) => {
        const exercise = findExercise(state, state.currentId.value)
        if (exercise) {
          exercise.flashcardProgress = exercise.flashcardProgress.map(record =>
            record.deleted
              ? record
              : markDeleted(record, action.meta.updatedAt),
          )
        }
      },
    ),

    toggleMarkedWord: create.preparedReducer(
      withUpdatedAt<string>,
      (state, action: TimestampedAction<string>) => {
        const exercise = findExercise(state, state.currentId.value)
        if (!exercise) {
          return
        }
        const word = action.payload
        const { updatedAt } = action.meta
        if (findLiveValue(exercise.highlights, hasWord(word))) {
          tombstoneValue(exercise.highlights, hasWord(word), updatedAt)
        } else {
          upsertValue(exercise.highlights, hasWord(word), { word }, updatedAt)
        }
      },
    ),

    setFlashcardIndex: create.preparedReducer(
      withUpdatedAt<number>,
      (state, action: TimestampedAction<number>) => {
        setValueIfChanged(
          state.cardIndex,
          Math.max(0, action.payload),
          action.meta.updatedAt,
        )
      },
    ),

    nextFlashcard: create.preparedReducer(
      withUpdatedAt<number>,
      (state, action: TimestampedAction<number>) => {
        setValueIfChanged(
          state.cardIndex,
          Math.min(state.cardIndex.value + 1, action.payload - 1),
          action.meta.updatedAt,
        )
      },
    ),

    prevFlashcard: create.preparedReducer(
      withUpdatedAtOnly,
      (state, action: TimestampedAction) => {
        setValueIfChanged(
          state.cardIndex,
          Math.max(state.cardIndex.value - 1, 0),
          action.meta.updatedAt,
        )
      },
    ),
  }),
  extraReducers: builder => {
    builder.addCase(reloadFromStorage, () => loadFromStorage())
  },
  selectors: {
    selectExerciseEntries: state => state.exercises,
    selectCurrentExerciseId: state => state.currentId.value,
    selectFlashcardIndex: state => state.cardIndex.value,
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
} = unseenSlice.actions

export const {
  selectExerciseEntries,
  selectCurrentExerciseId,
  selectFlashcardIndex,
} = unseenSlice.selectors

/* ---------------------------------------------------------------- *
 * Derived state.
 * ---------------------------------------------------------------- */

const toKnownByWord = (
  progress: readonly VersionedValue<FlashcardProgressRecord>[],
): Record<string, boolean> =>
  Object.fromEntries(
    liveValues(progress).map(({ word, isKnown }) => [word, isKnown]),
  )

export const selectExercises = createSelector(
  [selectExerciseEntries],
  liveValues,
)

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
        liveValues(exercise.highlights).map(({ word }) => word),
      ]),
    ),
)

export const selectAllProgress = createSelector([selectExercises], exercises =>
  Object.fromEntries(
    exercises.map(exercise => [
      exercise.exerciseId,
      toKnownByWord(exercise.flashcardProgress),
    ]),
  ),
)

export const selectAnswers = createSelector([selectCurrentExercise], exercise =>
  Object.fromEntries(
    liveValues(exercise?.answers ?? []).map(
      ({ questionId, selected, correct }) => [
        questionId,
        { selected, correct },
      ],
    ),
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
            findLiveValue(
              exercise.answers,
              answer => answer.questionId === question.id,
            )?.correct === true,
        ),
    })),
)

export const selectCurrentProgress = createSelector(
  [selectCurrentExercise],
  exercise => toKnownByWord(exercise?.flashcardProgress ?? []),
)

export const selectCurrentMarkedWords = createSelector(
  [selectCurrentExercise],
  exercise => liveValues(exercise?.highlights ?? []).map(({ word }) => word),
)

export const selectCurrentFlashcard = createSelector(
  [selectCurrentExercise, selectFlashcardIndex],
  (exercise, index) => exercise?.flashcards[index],
)

export const selectFlashcardStats = createSelector(
  [selectCurrentExercise],
  exercise => {
    const flashcards = exercise?.flashcards ?? []
    const knownByWord = toKnownByWord(exercise?.flashcardProgress ?? [])
    let known = 0
    let unknown = 0
    for (const card of flashcards) {
      const status = knownByWord[card.en]
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
