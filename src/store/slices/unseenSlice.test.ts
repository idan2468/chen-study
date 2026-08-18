import { defaultExercise } from "@/data/defaultExercise"
import type { Exercise } from "@/types/exercise"
import { makeStore } from "@/store/store"
import type { UnseenState } from "./unseenSlice"
import {
  addExercise,
  deleteExercise,
  markFlashcard,
  resetFlashcardProgress,
  selectCurrentProgress,
  selectFlashcardStats,
  selectLibrary,
  selectVocabSet,
  switchExercise,
  toggleMarkedWord,
} from "./unseenSlice"

const otherExercise: Exercise = {
  title: "אחר",
  subtitle: "תרגיל שני",
  exerciseId: "other_1",
  paragraphs: ["A cat sat."],
  questions: [],
  flashcards: [{ en: "Cat", he: "חתול", trans: "קֶט" }],
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
