import { defaultUnseenExercise } from "@/data/defaultUnseenExercise"
import type { UnseenExercise } from "@/types/unseenExercise"
import {
  flashcardStatusKey,
  StorageKeys,
} from "@/utils/sync/legacy/legacyStorage"
import {
  reloadFromStorage,
  selectPersistedState,
  writeLocalPersistedState,
} from "@/store/persistedState"
import { makeStore } from "@/store/store"
import type { PersistedState } from "@/types/schemas/persistedState"
import { markDeleted, toVersionedValue } from "@/utils/sync/versionedValue"
import type { UnseenState } from "./unseenSlice"
import {
  addExercise,
  addExercises,
  answerQuestion,
  deleteExercise,
  markFlashcard,
  nextFlashcard,
  resetFlashcardProgress,
  selectAllMarkedWords,
  selectAllProgress,
  selectAnswers,
  selectCurrentExerciseId,
  selectCurrentProgress,
  selectExerciseOptions,
  selectFlashcardIndex,
  selectFlashcardStats,
  selectLibrary,
  selectVocabSet,
  switchExercise,
  toggleMarkedWord,
} from "./unseenSlice"

const otherExercise: UnseenExercise = {
  title: "Other",
  subtitle: "Second exercise",
  exerciseId: "other_1",
  paragraphs: ["A cat sat."],
  questions: [],
  flashcards: [{ en: "Cat", he: "cat", trans: "kat" }],
  answers: [],
  highlights: [],
  flashcardProgress: [],
}

const thirdExercise: UnseenExercise = {
  title: "Third",
  subtitle: "Third exercise",
  exerciseId: "third_1",
  paragraphs: ["A dog ran."],
  questions: [],
  flashcards: [{ en: "Dog", he: "dog", trans: "dog" }],
  answers: [],
  highlights: [],
  flashcardProgress: [],
}

type TestStateOverrides = {
  currentId?: string
  cardIndex?: number
  library?: Record<string, UnseenExercise>
  answers?: Record<
    string,
    Record<string, { selected: number; correct: boolean }>
  >
  markedWords?: Record<string, string[]>
  progress?: Record<string, Record<string, boolean>>
}

const baseState = (overrides: TestStateOverrides = {}): UnseenState => {
  const library = overrides.library ?? {
    [defaultUnseenExercise.exerciseId]: defaultUnseenExercise,
  }

  return {
    exercises: Object.values(library).map(exercise =>
      toVersionedValue({
        ...exercise,
        answers: Object.entries(
          overrides.answers?.[exercise.exerciseId] ?? {},
        ).map(([questionId, answer]) =>
          toVersionedValue({ questionId, ...answer }),
        ),
        highlights: (overrides.markedWords?.[exercise.exerciseId] ?? []).map(
          word => toVersionedValue({ word }),
        ),
        flashcardProgress: Object.entries(
          overrides.progress?.[exercise.exerciseId] ?? {},
        ).map(([word, isKnown]) => toVersionedValue({ word, isKnown })),
      }),
    ),
    currentId: toVersionedValue(
      overrides.currentId ?? defaultUnseenExercise.exerciseId,
    ),
    cardIndex: toVersionedValue(overrides.cardIndex ?? 0),
  }
}

describe("markFlashcard", () => {
  test("marks a word known", () => {
    const store = makeStore({ unseen: baseState() })
    store.dispatch(markFlashcard({ word: "Delicate", isKnown: true }))

    expect(selectCurrentProgress(store.getState())).toStrictEqual({
      Delicate: true,
    })
  })

  test("re-marking the same status clears it back to unmarked", () => {
    // Three-way toggle, inherited from `Unseen New.html:1995`.
    const store = makeStore({ unseen: baseState() })
    store.dispatch(markFlashcard({ word: "Delicate", isKnown: true }))
    store.dispatch(markFlashcard({ word: "Delicate", isKnown: true }))

    expect(selectCurrentProgress(store.getState())).toStrictEqual({})
  })

  test("marking the opposite status flips rather than clears", () => {
    const store = makeStore({ unseen: baseState() })
    store.dispatch(markFlashcard({ word: "Delicate", isKnown: true }))
    store.dispatch(markFlashcard({ word: "Delicate", isKnown: false }))

    expect(selectCurrentProgress(store.getState())).toStrictEqual({
      Delicate: false,
    })
  })

  test("progress is isolated per exercise", () => {
    const store = makeStore({
      unseen: baseState({
        library: {
          [defaultUnseenExercise.exerciseId]: defaultUnseenExercise,
          other_1: otherExercise,
        },
      }),
    })
    store.dispatch(markFlashcard({ word: "Delicate", isKnown: true }))
    store.dispatch(switchExercise("other_1"))

    expect(selectCurrentProgress(store.getState())).toStrictEqual({})

    store.dispatch(switchExercise(defaultUnseenExercise.exerciseId))
    expect(selectCurrentProgress(store.getState())).toStrictEqual({
      Delicate: true,
    })
  })

  test("counts known and unknown separately from unmarked", () => {
    const store = makeStore({ unseen: baseState() })
    store.dispatch(markFlashcard({ word: "Delicate", isKnown: true }))
    store.dispatch(markFlashcard({ word: "Batter", isKnown: false }))

    expect(selectFlashcardStats(store.getState())).toStrictEqual({
      known: 1,
      unknown: 1,
      total: 9,
    })
  })

  test("reset clears the current exercise only", () => {
    const store = makeStore({
      unseen: baseState({
        library: {
          [defaultUnseenExercise.exerciseId]: defaultUnseenExercise,
          other_1: otherExercise,
        },
        progress: { other_1: { Cat: true } },
      }),
    })
    store.dispatch(markFlashcard({ word: "Delicate", isKnown: true }))
    store.dispatch(resetFlashcardProgress())

    const state = store.getState()
    expect(selectCurrentProgress(state)).toStrictEqual({})
    expect(selectAllProgress(state).other_1).toStrictEqual({ Cat: true })
  })
})

describe("markedWords", () => {
  test("toggles a highlighted word on and off, per exercise", () => {
    const store = makeStore({ unseen: baseState() })

    store.dispatch(toggleMarkedWord("Maya"))
    expect(
      selectAllMarkedWords(store.getState())[defaultUnseenExercise.exerciseId],
    ).toStrictEqual(["Maya"])

    store.dispatch(toggleMarkedWord("Maya"))
    expect(
      selectAllMarkedWords(store.getState())[defaultUnseenExercise.exerciseId],
    ).toStrictEqual([])
  })
})

describe("library", () => {
  test("adding an exercise selects it without discarding other answers", () => {
    const defaultId = defaultUnseenExercise.exerciseId
    const previousAnswers = { q1: { selected: 0, correct: true } }
    const store = makeStore({
      unseen: baseState({
        cardIndex: 3,
        answers: { [defaultId]: previousAnswers },
      }),
    })
    store.dispatch(addExercise(otherExercise))

    const state = store.getState()
    expect(selectCurrentExerciseId(state)).toBe("other_1")
    expect(selectFlashcardIndex(state)).toBe(0)
    expect(selectAnswers(state)).toStrictEqual({})
    expect(selectLibrary(state)[defaultId]?.answers).toStrictEqual([
      toVersionedValue({ questionId: "q1", ...previousAnswers.q1 }),
    ])
  })

  test("replacing an exercise clears all of its progress", () => {
    const replacement = { ...otherExercise, title: "Replacement" }
    const store = makeStore({
      unseen: baseState({
        library: {
          [defaultUnseenExercise.exerciseId]: defaultUnseenExercise,
          [otherExercise.exerciseId]: otherExercise,
        },
        answers: {
          [otherExercise.exerciseId]: {
            q1: { selected: 0, correct: true },
          },
        },
        markedWords: { [otherExercise.exerciseId]: ["cat"] },
        progress: { [otherExercise.exerciseId]: { Cat: true } },
      }),
    })

    store.dispatch(addExercise(replacement))

    expect(
      selectLibrary(store.getState())[otherExercise.exerciseId],
    ).toStrictEqual(replacement)
  })

  test("adding multiple exercises upserts all of them and selects the first", () => {
    const store = makeStore({
      unseen: baseState({
        cardIndex: 3,
        answers: {
          [defaultUnseenExercise.exerciseId]: {
            q1: { selected: 0, correct: true },
          },
        },
      }),
    })
    store.dispatch(addExercises([otherExercise, thirdExercise]))

    const state = store.getState()
    expect(Object.keys(selectLibrary(state))).toStrictEqual([
      defaultUnseenExercise.exerciseId,
      "other_1",
      "third_1",
    ])
    expect(selectCurrentExerciseId(state)).toBe("other_1")
    expect(selectFlashcardIndex(state)).toBe(0)
    expect(selectAnswers(state)).toStrictEqual({})
    expect(
      selectLibrary(state)[defaultUnseenExercise.exerciseId]?.answers,
    ).toStrictEqual([
      toVersionedValue({ questionId: "q1", selected: 0, correct: true }),
    ])
  })

  test("only applies the final occurrence of a repeated id", () => {
    const finalOther = { ...otherExercise, title: "Final" }
    const store = makeStore({ unseen: baseState() })

    store.dispatch(addExercises([otherExercise, thirdExercise, finalOther]))

    const state = store.getState()
    expect(selectLibrary(state)[otherExercise.exerciseId]).toStrictEqual(
      finalOther,
    )
    expect(Object.keys(selectLibrary(state))).toStrictEqual([
      defaultUnseenExercise.exerciseId,
      otherExercise.exerciseId,
      thirdExercise.exerciseId,
    ])
    expect(selectCurrentExerciseId(state)).toBe(otherExercise.exerciseId)
  })

  test("refuses to delete the last exercise", () => {
    const store = makeStore({ unseen: baseState() })
    store.dispatch(deleteExercise(defaultUnseenExercise.exerciseId))

    expect(Object.keys(selectLibrary(store.getState()))).toHaveLength(1)
  })

  test("deleting the active exercise selects another and drops its data", () => {
    const store = makeStore({
      unseen: baseState({
        library: {
          [defaultUnseenExercise.exerciseId]: defaultUnseenExercise,
          other_1: otherExercise,
        },
        currentId: "other_1",
        progress: { other_1: { Cat: true } },
        markedWords: { other_1: ["cat"] },
        answers: { other_1: { q1: { selected: 0, correct: true } } },
      }),
    })
    store.dispatch(deleteExercise("other_1"))

    const state = store.getState()
    expect(selectCurrentExerciseId(state)).toBe(
      defaultUnseenExercise.exerciseId,
    )
    expect(selectAllProgress(state).other_1).toBeUndefined()
    expect(selectAllMarkedWords(state).other_1).toBeUndefined()
    expect(selectLibrary(state).other_1).toBeUndefined()
  })
})

describe("answerQuestion", () => {
  test("records the selected option and whether it was correct", () => {
    const store = makeStore({ unseen: baseState() })
    store.dispatch(
      answerQuestion({ questionId: "q1", selected: 2, correct: false }),
    )

    expect(selectAnswers(store.getState())).toStrictEqual({
      q1: { selected: 2, correct: false },
    })
  })

  test("restores selected answers after switching away and back", () => {
    const store = makeStore({
      unseen: baseState({
        library: {
          [defaultUnseenExercise.exerciseId]: defaultUnseenExercise,
          other_1: otherExercise,
        },
      }),
    })
    store.dispatch(
      answerQuestion({ questionId: "q1", selected: 2, correct: true }),
    )

    store.dispatch(switchExercise("other_1"))
    expect(selectAnswers(store.getState())).toStrictEqual({})

    store.dispatch(switchExercise(defaultUnseenExercise.exerciseId))
    expect(selectAnswers(store.getState())).toStrictEqual({
      q1: { selected: 2, correct: true },
    })
  })

  test("re-answering the same question overwrites rather than accumulating", () => {
    const store = makeStore({ unseen: baseState() })
    store.dispatch(
      answerQuestion({ questionId: "q1", selected: 0, correct: false }),
    )
    store.dispatch(
      answerQuestion({ questionId: "q1", selected: 1, correct: true }),
    )

    expect(selectAnswers(store.getState())).toStrictEqual({
      q1: { selected: 1, correct: true },
    })
  })

  test("marks an exercise complete only after every question is correct", () => {
    const exercise: UnseenExercise = {
      ...otherExercise,
      questions: [
        { id: "q1", title: "One", options: [] },
        { id: "q2", title: "Two", options: [] },
      ],
    }
    const store = makeStore({
      unseen: baseState({
        library: { [exercise.exerciseId]: exercise },
        currentId: exercise.exerciseId,
      }),
    })

    store.dispatch(
      answerQuestion({ questionId: "q1", selected: 0, correct: true }),
    )
    store.dispatch(
      answerQuestion({ questionId: "q2", selected: 0, correct: false }),
    )
    expect(selectExerciseOptions(store.getState())[0]?.completed).toBe(false)

    store.dispatch(
      answerQuestion({ questionId: "q2", selected: 1, correct: true }),
    )

    expect(selectExerciseOptions(store.getState())).toStrictEqual([
      {
        value: exercise.exerciseId,
        label: exercise.subtitle,
        completed: true,
      },
    ])
  })
})

describe("hydration", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  test("reopens on the stored flashcard index", () => {
    localStorage.setItem(StorageKeys.flashcardIndex, "2")

    const store = makeStore()

    expect(selectFlashcardIndex(store.getState())).toBe(2)
  })

  test("migrates legacy active-exercise answers and reopens marked words", () => {
    localStorage.setItem(
      StorageKeys.quizAnswers,
      JSON.stringify({ q1: { selected: 1, correct: true } }),
    )
    localStorage.setItem(
      StorageKeys.markedWords,
      JSON.stringify({ [defaultUnseenExercise.exerciseId]: ["Maya"] }),
    )

    const store = makeStore()
    const state = store.getState()

    expect(selectAnswers(state)).toStrictEqual({
      q1: { selected: 1, correct: true },
    })
    expect(selectAllMarkedWords(state)).toStrictEqual({
      [defaultUnseenExercise.exerciseId]: ["Maya"],
    })
    expect(
      selectLibrary(state)[defaultUnseenExercise.exerciseId]?.answers,
    ).toStrictEqual([
      toVersionedValue({ questionId: "q1", selected: 1, correct: true }),
    ])
  })

  test("marks a completed legacy active exercise as complete", () => {
    const answers = Object.fromEntries(
      defaultUnseenExercise.questions.map(question => [
        question.id,
        {
          selected: question.options.findIndex(option => option.isCorrect),
          correct: true,
        },
      ]),
    )
    localStorage.setItem(StorageKeys.quizAnswers, JSON.stringify(answers))

    const store = makeStore()

    expect(selectAnswers(store.getState())).toStrictEqual(answers)
    expect(
      selectExerciseOptions(store.getState()).find(
        option => option.value === defaultUnseenExercise.exerciseId,
      )?.completed,
    ).toBe(true)
  })

  test("reopens per-exercise answers in the new storage shape", () => {
    localStorage.setItem(
      StorageKeys.exerciseLibrary,
      JSON.stringify({
        [defaultUnseenExercise.exerciseId]: defaultUnseenExercise,
        other_1: otherExercise,
      }),
    )
    localStorage.setItem(
      StorageKeys.quizAnswers,
      JSON.stringify({
        [defaultUnseenExercise.exerciseId]: {
          q1: { selected: 1, correct: true },
        },
        other_1: { q2: { selected: 0, correct: false } },
      }),
    )

    const library = selectLibrary(makeStore().getState())

    expect(library[defaultUnseenExercise.exerciseId]?.answers).toStrictEqual([
      toVersionedValue({ questionId: "q1", selected: 1, correct: true }),
    ])
    expect(library.other_1?.answers).toStrictEqual([
      toVersionedValue({ questionId: "q2", selected: 0, correct: false }),
    ])
  })

  test("reopens with per-exercise flashcard progress, keyed by exercise", () => {
    localStorage.setItem(
      StorageKeys.exerciseLibrary,
      JSON.stringify({
        [defaultUnseenExercise.exerciseId]: defaultUnseenExercise,
        other_1: otherExercise,
      }),
    )
    localStorage.setItem(
      flashcardStatusKey(defaultUnseenExercise.exerciseId),
      JSON.stringify({ Delicate: true }),
    )
    localStorage.setItem(
      flashcardStatusKey("other_1"),
      JSON.stringify({ Cat: false }),
    )

    const store = makeStore()
    const progress = selectAllProgress(store.getState())

    expect(progress[defaultUnseenExercise.exerciseId]).toStrictEqual({
      Delicate: true,
    })
    expect(progress.other_1).toStrictEqual({ Cat: false })
  })

  describe("currentId resolution", () => {
    beforeEach(() => {
      localStorage.setItem(
        StorageKeys.exerciseLibrary,
        JSON.stringify({
          [defaultUnseenExercise.exerciseId]: defaultUnseenExercise,
          other_1: otherExercise,
        }),
      )
    })

    test("prefers a stored id that is still in the library", () => {
      localStorage.setItem(StorageKeys.currentExerciseId, "other_1")

      const store = makeStore()

      expect(selectCurrentExerciseId(store.getState())).toBe("other_1")
    })

    test("falls back to the legacy single-exercise mirror when the stored id is gone", () => {
      localStorage.setItem(StorageKeys.currentExerciseId, "no-such-exercise")
      localStorage.setItem(
        StorageKeys.currentExerciseData,
        JSON.stringify(otherExercise),
      )

      const store = makeStore()

      expect(selectCurrentExerciseId(store.getState())).toBe("other_1")
    })

    test("falls back to the built-in default when neither the stored id nor the legacy mirror resolve", () => {
      localStorage.setItem(StorageKeys.currentExerciseId, "no-such-exercise")

      const store = makeStore()

      expect(selectCurrentExerciseId(store.getState())).toBe(
        defaultUnseenExercise.exerciseId,
      )
    })
  })
})

describe("reloadFromStorage", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  const writeUnseen = (unseen: Partial<PersistedState["unseen"]>) => {
    const persisted = selectPersistedState(makeStore().getState())
    writeLocalPersistedState({
      ...persisted,
      unseen: { ...persisted.unseen, ...unseen },
    })
  }

  test("discards in-memory changes and re-reads local v2, e.g. after a Drive merge", () => {
    const store = makeStore({ unseen: baseState() })
    store.dispatch(markFlashcard({ word: "Delicate", isKnown: true }))

    writeUnseen({
      exercises: [toVersionedValue(otherExercise)],
      currentId: toVersionedValue("other_1"),
    })
    store.dispatch(reloadFromStorage())

    const state = store.getState()
    expect(selectCurrentExerciseId(state)).toBe("other_1")
    // The built-in default is re-seeded when v2 has no entry for it at all.
    expect(selectLibrary(state)).toStrictEqual({
      other_1: otherExercise,
      [defaultUnseenExercise.exerciseId]: defaultUnseenExercise,
    })
    expect(selectCurrentProgress(state)).toStrictEqual({})
  })

  test("keeps a tombstoned default and repairs a current ID pointing at it", () => {
    const NOW = "2026-09-27T10:00:00.000+03:00"
    writeUnseen({
      exercises: [
        markDeleted(toVersionedValue(defaultUnseenExercise), NOW),
        toVersionedValue(otherExercise),
      ],
      currentId: toVersionedValue(defaultUnseenExercise.exerciseId, NOW),
      cardIndex: toVersionedValue(3, NOW),
    })

    const state = makeStore().getState()

    expect(Object.keys(selectLibrary(state))).toStrictEqual(["other_1"])
    expect(selectCurrentExerciseId(state)).toBe("other_1")
    expect(state.unseen.currentId.updatedAt).toBe(NOW)
    expect(state.unseen.cardIndex.value).toBe(0)
  })
})

describe("version metadata", () => {
  const NOW = "2026-09-26T11:00:00.000+03:00"

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date(NOW) })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const currentEntry = (store: ReturnType<typeof makeStore>) =>
    store
      .getState()
      .unseen.exercises.find(
        entry => entry.value.exerciseId === defaultUnseenExercise.exerciseId,
      )

  test("stamps progress with the time it was recorded", () => {
    const store = makeStore({ unseen: baseState() })

    store.dispatch(
      answerQuestion({ questionId: "q1", selected: 0, correct: true }),
    )

    expect(currentEntry(store)?.value.answers).toStrictEqual([
      toVersionedValue({ questionId: "q1", selected: 0, correct: true }, NOW),
    ])
  })

  test("keeps cleared flashcards and highlights as tombstones", () => {
    const store = makeStore({
      unseen: baseState({
        markedWords: { [defaultUnseenExercise.exerciseId]: ["Maya"] },
        progress: {
          [defaultUnseenExercise.exerciseId]: { Delicate: true, Tiny: false },
        },
      }),
    })

    store.dispatch(toggleMarkedWord("Maya"))
    store.dispatch(markFlashcard({ word: "Delicate", isKnown: true }))
    store.dispatch(resetFlashcardProgress())

    const exercise = currentEntry(store)?.value
    expect(exercise?.highlights).toStrictEqual([
      { value: { word: "Maya" }, updatedAt: NOW, deleted: true },
    ])
    expect(exercise?.flashcardProgress).toStrictEqual([
      {
        value: { word: "Delicate", isKnown: true },
        updatedAt: NOW,
        deleted: true,
      },
      {
        value: { word: "Tiny", isKnown: false },
        updatedAt: NOW,
        deleted: true,
      },
    ])
  })

  test("stamps navigation only when it actually moves", () => {
    const store = makeStore({ unseen: baseState({ cardIndex: 1 }) })

    store.dispatch(nextFlashcard(2))
    expect(store.getState().unseen.cardIndex).toStrictEqual(toVersionedValue(1))

    store.dispatch(switchExercise(defaultUnseenExercise.exerciseId))
    expect(store.getState().unseen.cardIndex).toStrictEqual(
      toVersionedValue(0, NOW),
    )
    expect(store.getState().unseen.currentId).toStrictEqual(
      toVersionedValue(defaultUnseenExercise.exerciseId),
    )
  })

  test("keeps a deleted exercise as a tombstone and appends it when re-added", () => {
    const store = makeStore({
      unseen: baseState({
        library: {
          other_1: otherExercise,
          [defaultUnseenExercise.exerciseId]: defaultUnseenExercise,
        },
      }),
    })

    store.dispatch(deleteExercise("other_1"))
    expect(store.getState().unseen.exercises[0]).toStrictEqual({
      value: otherExercise,
      updatedAt: NOW,
      deleted: true,
    })

    store.dispatch(addExercise(otherExercise))
    expect(
      store.getState().unseen.exercises.map(entry => entry.value.exerciseId),
    ).toStrictEqual([defaultUnseenExercise.exerciseId, "other_1"])
  })
})

describe("selectVocabSet", () => {
  test("includes the flashcard words lowercased, plus naive plurals", () => {
    const store = makeStore({ unseen: baseState() })
    const vocab = selectVocabSet(store.getState())

    expect(vocab.has("delicate")).toBe(true)
    expect(vocab.has("delicates")).toBe(true)
    // Lookups are lowercased by the caller, so the original casing is absent.
    expect(vocab.has("Delicate")).toBe(false)
    // The `+es` rule is applied unconditionally, so it produces non-words too.
    // Faithful to `getVocabSet` in the original; harmless because these extra
    // entries simply never match anything in the passage.
    expect(vocab.has("delicatees")).toBe(true)
    expect(vocab.has("unrelated")).toBe(false)
  })
})
