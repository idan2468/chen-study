import { defaultExercise } from "@/data/defaultExercise"
import type { Exercise } from "@/types/exercise"
import { flashcardStatusKey, StorageKeys } from "@/utils/sync/storageKeys"
import { makeStore } from "@/store/store"
import type { UnseenState } from "./unseenSlice"
import {
  addExercise,
  answerQuestion,
  deleteExercise,
  markFlashcard,
  reloadFromStorage,
  resetFlashcardProgress,
  selectAllMarkedWords,
  selectAllProgress,
  selectAnswers,
  selectCurrentExerciseId,
  selectCurrentProgress,
  selectFlashcardIndex,
  selectFlashcardStats,
  selectLibrary,
  selectVocabSet,
  switchExercise,
  toggleMarkedWord,
} from "./unseenSlice"

const otherExercise: Exercise = {
  title: "Other",
  subtitle: "Second exercise",
  exerciseId: "other_1",
  paragraphs: ["A cat sat."],
  questions: [],
  flashcards: [{ en: "Cat", he: "cat", trans: "kat" }],
}

const baseState = (overrides: Partial<UnseenState> = {}): UnseenState => ({
  library: { [defaultExercise.exerciseId]: defaultExercise },
  currentId: defaultExercise.exerciseId,
  cardIndex: 0,
  answers: {},
  markedWords: {},
  progress: {},
  ...overrides,
})

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
          [defaultExercise.exerciseId]: defaultExercise,
          other_1: otherExercise,
        },
      }),
    })
    store.dispatch(markFlashcard({ word: "Delicate", isKnown: true }))
    store.dispatch(switchExercise("other_1"))

    expect(selectCurrentProgress(store.getState())).toStrictEqual({})

    store.dispatch(switchExercise(defaultExercise.exerciseId))
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
          [defaultExercise.exerciseId]: defaultExercise,
          other_1: otherExercise,
        },
        progress: { other_1: { Cat: true } },
      }),
    })
    store.dispatch(markFlashcard({ word: "Delicate", isKnown: true }))
    store.dispatch(resetFlashcardProgress())

    const state = store.getState()
    expect(selectCurrentProgress(state)).toStrictEqual({})
    expect(state.unseen.progress.other_1).toStrictEqual({ Cat: true })
  })
})

describe("markedWords", () => {
  test("toggles a highlighted word on and off, per exercise", () => {
    const store = makeStore({ unseen: baseState() })

    store.dispatch(toggleMarkedWord("Maya"))
    expect(
      store.getState().unseen.markedWords[defaultExercise.exerciseId],
    ).toStrictEqual(["Maya"])

    store.dispatch(toggleMarkedWord("Maya"))
    expect(
      store.getState().unseen.markedWords[defaultExercise.exerciseId],
    ).toStrictEqual([])
  })
})

describe("library", () => {
  test("adding an exercise makes it current and resets card + answers", () => {
    const store = makeStore({
      unseen: baseState({
        cardIndex: 3,
        answers: { q1: { selected: 0, correct: true } },
      }),
    })
    store.dispatch(addExercise(otherExercise))

    const state = store.getState()
    expect(state.unseen.currentId).toBe("other_1")
    expect(state.unseen.cardIndex).toBe(0)
    expect(state.unseen.answers).toStrictEqual({})
  })

  test("refuses to delete the last exercise", () => {
    const store = makeStore({ unseen: baseState() })
    store.dispatch(deleteExercise(defaultExercise.exerciseId))

    expect(Object.keys(selectLibrary(store.getState()))).toHaveLength(1)
  })

  test("deleting the active exercise selects another and drops its data", () => {
    const store = makeStore({
      unseen: baseState({
        library: {
          [defaultExercise.exerciseId]: defaultExercise,
          other_1: otherExercise,
        },
        currentId: "other_1",
        progress: { other_1: { Cat: true } },
        markedWords: { other_1: ["cat"] },
      }),
    })
    store.dispatch(deleteExercise("other_1"))

    const state = store.getState()
    expect(state.unseen.currentId).toBe(defaultExercise.exerciseId)
    expect(state.unseen.progress.other_1).toBeUndefined()
    expect(state.unseen.markedWords.other_1).toBeUndefined()
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

  test("reopens with the stored answers and marked words", () => {
    localStorage.setItem(
      StorageKeys.quizAnswers,
      JSON.stringify({ q1: { selected: 1, correct: true } }),
    )
    localStorage.setItem(
      StorageKeys.markedWords,
      JSON.stringify({ [defaultExercise.exerciseId]: ["Maya"] }),
    )

    const store = makeStore()
    const state = store.getState()

    expect(selectAnswers(state)).toStrictEqual({
      q1: { selected: 1, correct: true },
    })
    expect(selectAllMarkedWords(state)).toStrictEqual({
      [defaultExercise.exerciseId]: ["Maya"],
    })
  })

  test("reopens with per-exercise flashcard progress, keyed by exercise", () => {
    localStorage.setItem(
      StorageKeys.exerciseLibrary,
      JSON.stringify({
        [defaultExercise.exerciseId]: defaultExercise,
        other_1: otherExercise,
      }),
    )
    localStorage.setItem(
      flashcardStatusKey(defaultExercise.exerciseId),
      JSON.stringify({ Delicate: true }),
    )
    localStorage.setItem(
      flashcardStatusKey("other_1"),
      JSON.stringify({ Cat: false }),
    )

    const store = makeStore()
    const progress = selectAllProgress(store.getState())

    expect(progress[defaultExercise.exerciseId]).toStrictEqual({
      Delicate: true,
    })
    expect(progress.other_1).toStrictEqual({ Cat: false })
  })

  describe("currentId resolution", () => {
    beforeEach(() => {
      localStorage.setItem(
        StorageKeys.exerciseLibrary,
        JSON.stringify({
          [defaultExercise.exerciseId]: defaultExercise,
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
        defaultExercise.exerciseId,
      )
    })
  })
})

describe("reloadFromStorage", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  test("discards in-memory changes and re-reads whatever is in storage now, e.g. after a Drive pull", () => {
    const store = makeStore({ unseen: baseState() })
    store.dispatch(markFlashcard({ word: "Delicate", isKnown: true }))

    localStorage.setItem(
      StorageKeys.exerciseLibrary,
      JSON.stringify({ other_1: otherExercise }),
    )
    localStorage.setItem(StorageKeys.currentExerciseId, "other_1")
    store.dispatch(reloadFromStorage())

    const state = store.getState()
    expect(selectCurrentExerciseId(state)).toBe("other_1")
    // The built-in default is always re-seeded if missing from storage -- see
    // `loadFromStorage`'s "first run" comment.
    expect(selectLibrary(state)).toStrictEqual({
      other_1: otherExercise,
      [defaultExercise.exerciseId]: defaultExercise,
    })
    expect(selectCurrentProgress(state)).toStrictEqual({})
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
