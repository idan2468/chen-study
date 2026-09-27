import type { PersistedState } from "@/types/schemas/persistedState"
import { PERSISTED_STATE_VERSION } from "@/types/schemas/persistedState"
import type { ModuleExercise } from "@/types/moduleExercise"
import { CardStatus } from "@/types/moduleExercise"
import { SpeechLang } from "@/types/speech"
import type { UnseenExercise } from "@/types/unseenExercise"
import type { VersionedValue } from "@/types/versionedValue"
import { mergePersistedState } from "./mergePersistedState"
import { markDeleted, toVersionedValue } from "./versionedValue"

const T1 = "2026-09-27T10:00:00.000+03:00"
const T2 = "2026-09-27T11:00:00.000+03:00"
const T3 = "2026-09-27T12:00:00.000+03:00"

const exercise = (
  exerciseId: string,
  overrides: Partial<UnseenExercise> = {},
): UnseenExercise => ({
  title: exerciseId,
  subtitle: "",
  exerciseId,
  paragraphs: [],
  questions: [],
  flashcards: [],
  answers: [],
  highlights: [],
  flashcardProgress: [],
  ...overrides,
})

const module = (
  id: string,
  overrides: Partial<ModuleExercise> = {},
): ModuleExercise => ({
  id,
  tabName: id,
  title: id,
  rule: "",
  cards: [],
  ...overrides,
})

const state = (
  overrides: {
    unseen?: Partial<PersistedState["unseen"]>
    modules?: Partial<PersistedState["modules"]>
    preferences?: Partial<PersistedState["preferences"]>
  } = {},
): PersistedState => ({
  schemaVersion: PERSISTED_STATE_VERSION,
  unseen: {
    exercises: [],
    currentId: toVersionedValue(""),
    cardIndex: toVersionedValue(0),
    ...overrides.unseen,
  },
  modules: {
    modules: [],
    progress: [],
    currentModuleId: toVersionedValue(""),
    cardIndex: toVersionedValue(0),
    ...overrides.modules,
  },
  preferences: {
    dyslexiaFont: toVersionedValue(false),
    shuffleUnseenAnswers: toVersionedValue(false),
    speechRateByLang: {
      [SpeechLang.English]: toVersionedValue(0.5),
      [SpeechLang.Hebrew]: toVersionedValue(0.5),
    },
    ...overrides.preferences,
  },
})

const withExercises = (...exercises: VersionedValue<UnseenExercise>[]) =>
  state({ unseen: { exercises } })

const mergedExercises = (local: PersistedState, remote: PersistedState) =>
  mergePersistedState(local, remote).unseen.exercises

describe("Unseen exercises", () => {
  test("a replaced exercise wins with its whole subtree", () => {
    const replaced = toVersionedValue(exercise("u1", { title: "new" }), T2)
    const staleWithLaterAnswer = toVersionedValue(
      exercise("u1", {
        answers: [
          toVersionedValue(
            { questionId: "q1", selected: 0, correct: true },
            T3,
          ),
        ],
      }),
      T1,
    )

    expect(
      mergedExercises(
        withExercises(staleWithLaterAnswer),
        withExercises(replaced),
      ),
    ).toStrictEqual([replaced])
    expect(
      mergedExercises(
        withExercises(replaced),
        withExercises(staleWithLaterAnswer),
      ),
    ).toStrictEqual([replaced])
  })

  test("the same version merges progress record by record", () => {
    const local = toVersionedValue(
      exercise("u1", {
        title: "local",
        answers: [
          toVersionedValue(
            { questionId: "q1", selected: 1, correct: false },
            T3,
          ),
          toVersionedValue(
            { questionId: "q2", selected: 0, correct: true },
            T1,
          ),
        ],
        highlights: [markDeleted(toVersionedValue({ word: "cat" }, T1), T3)],
        flashcardProgress: [
          toVersionedValue({ word: "dog", isKnown: true }, T2),
        ],
      }),
      T1,
    )
    const remote = toVersionedValue(
      exercise("u1", {
        title: "remote",
        answers: [
          toVersionedValue(
            { questionId: "q1", selected: 0, correct: true },
            T2,
          ),
          toVersionedValue(
            { questionId: "q2", selected: 1, correct: false },
            T2,
          ),
        ],
        highlights: [toVersionedValue({ word: "cat" }, T2)],
        flashcardProgress: [
          toVersionedValue({ word: "hat", isKnown: false }, T1),
        ],
      }),
      T1,
    )

    expect(
      mergedExercises(withExercises(local), withExercises(remote)),
    ).toStrictEqual([
      toVersionedValue(
        exercise("u1", {
          title: "remote",
          answers: [
            toVersionedValue(
              { questionId: "q1", selected: 1, correct: false },
              T3,
            ),
            toVersionedValue(
              { questionId: "q2", selected: 1, correct: false },
              T2,
            ),
          ],
          highlights: [markDeleted(toVersionedValue({ word: "cat" }, T1), T3)],
          flashcardProgress: [
            toVersionedValue({ word: "hat", isKnown: false }, T1),
            toVersionedValue({ word: "dog", isKnown: true }, T2),
          ],
        }),
        T1,
      ),
    ])
  })

  test("a later deletion beats an older live exercise", () => {
    const live = toVersionedValue(exercise("u1"), T1)
    const deleted = markDeleted(live, T2)

    expect(
      mergedExercises(withExercises(live), withExercises(deleted)),
    ).toStrictEqual([deleted])
    expect(
      mergedExercises(withExercises(deleted), withExercises(live)),
    ).toStrictEqual([deleted])
  })

  test("a later re-import beats an older deletion", () => {
    const deleted = markDeleted(toVersionedValue(exercise("u1"), T1), T2)
    const reimported = toVersionedValue(exercise("u1", { title: "again" }), T3)

    expect(
      mergedExercises(withExercises(deleted), withExercises(reimported)),
    ).toStrictEqual([reimported])
    expect(
      mergedExercises(withExercises(reimported), withExercises(deleted)),
    ).toStrictEqual([reimported])
  })

  test("Drive wins a same-time tie between a deletion and a live exercise", () => {
    const live = toVersionedValue(exercise("u1"), T2)
    const deleted = markDeleted(toVersionedValue(exercise("u1"), T1), T2)

    expect(
      mergedExercises(withExercises(live), withExercises(deleted)),
    ).toStrictEqual([deleted])
    expect(
      mergedExercises(withExercises(deleted), withExercises(live)),
    ).toStrictEqual([live])
  })

  test("keeps Drive's order, then local-only exercises", () => {
    const local = withExercises(
      toVersionedValue(exercise("local-only"), T1),
      toVersionedValue(exercise("shared"), T1),
    )
    const remote = withExercises(
      toVersionedValue(exercise("shared"), T1),
      toVersionedValue(exercise("drive-only"), T1),
    )

    expect(
      mergedExercises(local, remote).map(entry => entry.value.exerciseId),
    ).toStrictEqual(["shared", "drive-only", "local-only"])
  })
})

describe("navigation", () => {
  test("the side that switched more recently keeps its card index", () => {
    const local = state({
      unseen: {
        currentId: toVersionedValue("a", T1),
        cardIndex: toVersionedValue(5, T3),
      },
      modules: {
        currentModuleId: toVersionedValue("m2", T3),
        cardIndex: toVersionedValue(4, T3),
      },
    })
    const remote = state({
      unseen: {
        currentId: toVersionedValue("b", T2),
        cardIndex: toVersionedValue(2, T2),
      },
      modules: {
        currentModuleId: toVersionedValue("m1", T2),
        cardIndex: toVersionedValue(1, T2),
      },
    })

    const merged = mergePersistedState(local, remote)

    expect(merged.unseen.currentId).toStrictEqual(toVersionedValue("b", T2))
    expect(merged.unseen.cardIndex).toStrictEqual(toVersionedValue(2, T2))
    expect(merged.modules.currentModuleId).toStrictEqual(
      toVersionedValue("m2", T3),
    )
    expect(merged.modules.cardIndex).toStrictEqual(toVersionedValue(4, T3))
  })

  test("on the same ID, each field is newest-wins", () => {
    const local = state({
      unseen: {
        currentId: toVersionedValue("a", T1),
        cardIndex: toVersionedValue(5, T3),
      },
    })
    const remote = state({
      unseen: {
        currentId: toVersionedValue("a", T2),
        cardIndex: toVersionedValue(2, T2),
      },
    })

    const merged = mergePersistedState(local, remote)

    expect(merged.unseen.currentId).toStrictEqual(toVersionedValue("a", T2))
    expect(merged.unseen.cardIndex).toStrictEqual(toVersionedValue(5, T3))
  })

  test("Drive wins a tie between different IDs", () => {
    const local = state({
      unseen: {
        currentId: toVersionedValue("a", T2),
        cardIndex: toVersionedValue(5, T3),
      },
    })
    const remote = state({
      unseen: {
        currentId: toVersionedValue("b", T2),
        cardIndex: toVersionedValue(2, T1),
      },
    })

    const merged = mergePersistedState(local, remote)

    expect(merged.unseen.currentId).toStrictEqual(toVersionedValue("b", T2))
    expect(merged.unseen.cardIndex).toStrictEqual(toVersionedValue(2, T1))
  })
})

describe("Modules", () => {
  test("merges each module independently", () => {
    const local = state({
      modules: {
        modules: [
          toVersionedValue(module("m1", { title: "local edit" }), T2),
          markDeleted(toVersionedValue(module("m2")), T3),
        ],
      },
    })
    const remote = state({
      modules: {
        modules: [
          toVersionedValue(module("m1", { title: "drive edit" }), T1),
          toVersionedValue(module("m2", { title: "drive edit" }), T2),
          toVersionedValue(module("m3"), T1),
        ],
      },
    })

    expect(mergePersistedState(local, remote).modules.modules).toStrictEqual([
      toVersionedValue(module("m1", { title: "local edit" }), T2),
      markDeleted(toVersionedValue(module("m2")), T3),
      toVersionedValue(module("m3"), T1),
    ])
  })

  test("merges progress per word, so stale later progress beats a reset", () => {
    const local = state({
      modules: {
        progress: [
          toVersionedValue({ word: "HAT", status: CardStatus.None }, T2),
          toVersionedValue({ word: "FOX", status: CardStatus.None }, T2),
        ],
      },
    })
    const remote = state({
      modules: {
        progress: [
          toVersionedValue({ word: "HAT", status: CardStatus.Known }, T1),
          toVersionedValue({ word: "FOX", status: CardStatus.Unknown }, T3),
        ],
      },
    })

    expect(mergePersistedState(local, remote).modules.progress).toStrictEqual([
      toVersionedValue({ word: "HAT", status: CardStatus.None }, T2),
      toVersionedValue({ word: "FOX", status: CardStatus.Unknown }, T3),
    ])
  })
})

describe("preferences", () => {
  test("merges each preference independently", () => {
    const local = state({
      preferences: {
        dyslexiaFont: toVersionedValue(true, T3),
        shuffleUnseenAnswers: toVersionedValue(true, T1),
        speechRateByLang: {
          [SpeechLang.English]: toVersionedValue(0.8, T3),
          [SpeechLang.Hebrew]: toVersionedValue(0.3, T1),
        },
      },
    })
    const remote = state({
      preferences: {
        dyslexiaFont: toVersionedValue(false, T2),
        shuffleUnseenAnswers: toVersionedValue(false, T2),
        speechRateByLang: {
          [SpeechLang.English]: toVersionedValue(0.6, T2),
          [SpeechLang.Hebrew]: toVersionedValue(0.4, T2),
        },
      },
    })

    expect(mergePersistedState(local, remote).preferences).toStrictEqual({
      dyslexiaFont: toVersionedValue(true, T3),
      shuffleUnseenAnswers: toVersionedValue(false, T2),
      speechRateByLang: {
        [SpeechLang.English]: toVersionedValue(0.8, T3),
        [SpeechLang.Hebrew]: toVersionedValue(0.4, T2),
      },
    })
  })

  test("Drive wins a tie", () => {
    const local = state({
      preferences: { dyslexiaFont: toVersionedValue(true, T2) },
    })
    const remote = state({
      preferences: { dyslexiaFont: toVersionedValue(false, T2) },
    })

    expect(
      mergePersistedState(local, remote).preferences.dyslexiaFont,
    ).toStrictEqual(toVersionedValue(false, T2))
  })
})

test("merging a state with itself changes nothing", () => {
  const persisted = state({
    unseen: {
      exercises: [toVersionedValue(exercise("u1"), T1)],
      currentId: toVersionedValue("u1", T1),
    },
    modules: {
      modules: [toVersionedValue(module("m1"), T1)],
      progress: [
        toVersionedValue({ word: "HAT", status: CardStatus.Known }, T2),
      ],
    },
  })

  expect(mergePersistedState(persisted, persisted)).toStrictEqual(persisted)
})
