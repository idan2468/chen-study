import { defaultModuleExercises } from "@/data/defaultModuleExercises"
import { defaultUnseenExercise } from "@/data/defaultUnseenExercise"
import { at } from "@test/helpers"
import { CardStatus } from "@/types/moduleExercise"
import {
  applySyncPayload,
  buildSyncPayload,
  flashcardStatusKey,
  readLegacyModuleProgress,
  readLegacyModules,
  readLegacyUnseenState,
  StorageKeys,
  toLegacyDeletedBuiltInIds,
  toLegacyFlashcardProgress,
  toLegacyMarkedWords,
  toLegacyModuleProgress,
  toLegacyUnseenAnswers,
  toLegacyUnseenLibrary,
} from "./legacyStorage"
import { PERSISTED_STATE_KEY } from "@/store/persistedState"
import {
  INITIAL_UPDATED_AT,
  markDeleted,
  toVersionedValue,
} from "@/utils/sync/versionedValue"

beforeEach(() => {
  localStorage.clear()
})

test("collects progress from localStorage, but never device-local keys", () => {
  localStorage.setItem(
    StorageKeys.modulesProgress,
    JSON.stringify({ HAT: "known" }),
  )
  localStorage.setItem(StorageKeys.darkMode, "1")
  localStorage.setItem(StorageKeys.shuffleUnseenAnswers, "1")
  localStorage.setItem(StorageKeys.systemVoice, "Microsoft David - English")
  localStorage.setItem(StorageKeys.googleAccessToken, "ya29.secret")
  localStorage.setItem(StorageKeys.googleLastSyncedHash, "abc123")

  expect(buildSyncPayload()).toStrictEqual({
    [StorageKeys.modulesProgress]: JSON.stringify({ HAT: "known" }),
    [StorageKeys.darkMode]: "1",
    [StorageKeys.shuffleUnseenAnswers]: "1",
  })
})

describe("applySyncPayload", () => {
  test("writes syncable keys into localStorage and reports how many applied", () => {
    const applied = applySyncPayload({
      [StorageKeys.modulesProgress]: JSON.stringify({ HAT: "known" }),
      [StorageKeys.darkMode]: "1",
    })

    expect(applied).toBe(2)
    expect(localStorage.getItem(StorageKeys.modulesProgress)).toBe(
      JSON.stringify({ HAT: "known" }),
    )
    expect(localStorage.getItem(StorageKeys.darkMode)).toBe("1")
  })

  test("ignores a device-local key rather than overwriting it, e.g. a crafted Drive file cannot hijack the stored Google token", () => {
    localStorage.setItem(StorageKeys.googleAccessToken, "victims-real-token")

    const applied = applySyncPayload({
      [StorageKeys.googleAccessToken]: "attackers-token",
      [StorageKeys.darkMode]: "1",
    })

    expect(applied).toBe(1)
    expect(localStorage.getItem(StorageKeys.googleAccessToken)).toBe(
      "victims-real-token",
    )
    expect(localStorage.getItem(StorageKeys.darkMode)).toBe("1")
  })
})

test("keeps the persisted state out of the legacy payload in both directions", () => {
  localStorage.setItem(PERSISTED_STATE_KEY, "{}")

  expect(buildSyncPayload()).not.toHaveProperty(PERSISTED_STATE_KEY)

  localStorage.clear()
  applySyncPayload({ [PERSISTED_STATE_KEY]: "{}" })
  expect(localStorage.getItem(PERSISTED_STATE_KEY)).toBeNull()
})

describe("legacy Module progress", () => {
  test("reads the keyed legacy shape as semantic word records", () => {
    localStorage.setItem(
      StorageKeys.modulesProgress,
      JSON.stringify({ HAT: CardStatus.Known, FOX: CardStatus.Unknown }),
    )

    expect(readLegacyModuleProgress()).toStrictEqual([
      toVersionedValue({ word: "HAT", status: CardStatus.Known }),
      toVersionedValue({ word: "FOX", status: CardStatus.Unknown }),
    ])
  })

  test("omits unassessed words when writing the legacy shape", () => {
    expect(
      toLegacyModuleProgress([
        toVersionedValue({ word: "HAT", status: CardStatus.None }),
        toVersionedValue({ word: "FOX", status: CardStatus.Unknown }),
      ]),
    ).toStrictEqual({ FOX: CardStatus.Unknown })
  })
})

describe("legacy Modules", () => {
  const firstBuiltIn = at(defaultModuleExercises, 0)
  const secondBuiltIn = at(defaultModuleExercises, 1)

  test("reads deleted built-ins as tombstones that win over a stored copy", () => {
    localStorage.setItem(
      StorageKeys.allModules,
      JSON.stringify([firstBuiltIn, secondBuiltIn]),
    )
    localStorage.setItem(
      StorageKeys.deletedBuiltInModules,
      JSON.stringify([secondBuiltIn.id]),
    )

    expect(readLegacyModules()).toStrictEqual([
      toVersionedValue(firstBuiltIn),
      markDeleted(toVersionedValue(secondBuiltIn), INITIAL_UPDATED_AT),
    ])
  })

  test("writes only deleted built-in ids to the legacy deletion list", () => {
    const customModule = { ...firstBuiltIn, id: "custom_1" }

    expect(
      toLegacyDeletedBuiltInIds([
        toVersionedValue(firstBuiltIn),
        markDeleted(toVersionedValue(secondBuiltIn), INITIAL_UPDATED_AT),
        markDeleted(toVersionedValue(customModule), INITIAL_UPDATED_AT),
      ]),
    ).toStrictEqual([secondBuiltIn.id])
  })
})

describe("legacy Unseen state", () => {
  test("combines split legacy progress into the matching exercise", () => {
    const exerciseId = defaultUnseenExercise.exerciseId
    localStorage.setItem(
      StorageKeys.exerciseLibrary,
      JSON.stringify(toLegacyUnseenLibrary([defaultUnseenExercise])),
    )
    localStorage.setItem(StorageKeys.currentExerciseId, exerciseId)
    localStorage.setItem(
      StorageKeys.quizAnswers,
      JSON.stringify({
        [exerciseId]: { q1: { selected: 1, correct: true } },
      }),
    )
    localStorage.setItem(
      StorageKeys.markedWords,
      JSON.stringify({ [exerciseId]: ["Maya"] }),
    )
    localStorage.setItem(
      flashcardStatusKey(exerciseId),
      JSON.stringify({ Delicate: false }),
    )

    const state = readLegacyUnseenState(defaultUnseenExercise)

    const exercise = state.exercises[0]
    expect(exercise?.updatedAt).toBe(INITIAL_UPDATED_AT)
    expect(exercise?.value.answers).toStrictEqual([
      toVersionedValue({ questionId: "q1", selected: 1, correct: true }),
    ])
    expect(exercise?.value.highlights).toStrictEqual([
      toVersionedValue({ word: "Maya" }),
    ])
    expect(exercise?.value.flashcardProgress).toStrictEqual([
      toVersionedValue({ word: "Delicate", isKnown: false }),
    ])
  })

  test("projects live nested progress to the unchanged legacy shapes", () => {
    const exercise = {
      ...defaultUnseenExercise,
      answers: [
        toVersionedValue({ questionId: "q1", selected: 1, correct: true }),
      ],
      highlights: [
        toVersionedValue({ word: "Maya" }),
        markDeleted(toVersionedValue({ word: "Tom" }), INITIAL_UPDATED_AT),
      ],
      flashcardProgress: [
        toVersionedValue({ word: "Delicate", isKnown: true }),
        markDeleted(
          toVersionedValue({ word: "Tiny", isKnown: false }),
          INITIAL_UPDATED_AT,
        ),
      ],
    }
    const exerciseId = exercise.exerciseId

    expect(toLegacyUnseenAnswers([exercise])).toStrictEqual({
      [exerciseId]: { q1: { selected: 1, correct: true } },
    })
    expect(toLegacyMarkedWords([exercise])).toStrictEqual({
      [exerciseId]: ["Maya"],
    })
    expect(toLegacyFlashcardProgress(exercise)).toStrictEqual({
      Delicate: true,
    })
    expect(toLegacyUnseenLibrary([exercise])[exerciseId]).not.toHaveProperty(
      "answers",
    )
  })
})
