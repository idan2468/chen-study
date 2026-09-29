import { DeviceStorageKeys } from "@/store/deviceStorageKeys"
import {
  builtInModuleIds,
  defaultModuleExercises,
} from "@/data/defaultModuleExercises"
import { defaultUnseenExercise } from "@/data/defaultUnseenExercise"
import { at } from "@test/helpers"
import { CardStatus } from "@/types/moduleExercise"
import type { ModuleExercise } from "@/types/moduleExercise"
import {
  applySyncPayload,
  flashcardStatusKey,
  isLegacyDataKey,
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
  withBuiltInModules,
} from "./legacyStorage"
import { PERSISTED_STATE_KEY } from "@/store/persistedState"
import {
  INITIAL_UPDATED_AT,
  liveValues,
  markDeleted,
  toVersionedValue,
} from "@/utils/sync/versionedValue"

beforeEach(() => {
  localStorage.clear()
})

describe("applySyncPayload", () => {
  test("writes syncable keys into localStorage and reports how many applied", () => {
    const applied = applySyncPayload({
      [StorageKeys.modulesProgress]: JSON.stringify({ HAT: "known" }),
      [DeviceStorageKeys.darkMode]: "1",
    })

    expect(applied).toBe(2)
    expect(localStorage.getItem(StorageKeys.modulesProgress)).toBe(
      JSON.stringify({ HAT: "known" }),
    )
    expect(localStorage.getItem(DeviceStorageKeys.darkMode)).toBe("1")
  })

  test("ignores a device-local key rather than overwriting it, e.g. a crafted Drive file cannot hijack the stored Google token", () => {
    localStorage.setItem(
      DeviceStorageKeys.googleAccessToken,
      "victims-real-token",
    )

    const applied = applySyncPayload({
      [DeviceStorageKeys.googleAccessToken]: "attackers-token",
      [DeviceStorageKeys.darkMode]: "1",
    })

    expect(applied).toBe(1)
    expect(localStorage.getItem(DeviceStorageKeys.googleAccessToken)).toBe(
      "victims-real-token",
    )
    expect(localStorage.getItem(DeviceStorageKeys.darkMode)).toBe("1")
  })
})

test("never lets a legacy payload overwrite the persisted state", () => {
  applySyncPayload({ [PERSISTED_STATE_KEY]: "{}" })
  expect(localStorage.getItem(PERSISTED_STATE_KEY)).toBeNull()
})

test("treats every legacy key as migratable data, and no device setting", () => {
  expect(Object.values(StorageKeys).every(isLegacyDataKey)).toBe(true)
  expect(Object.values(DeviceStorageKeys).some(isLegacyDataKey)).toBe(false)
  expect(isLegacyDataKey(flashcardStatusKey("u1"))).toBe(true)
  expect(isLegacyDataKey(PERSISTED_STATE_KEY)).toBe(false)
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

describe("withBuiltInModules", () => {
  const customModule: ModuleExercise = {
    id: "custom_1",
    tabName: "Mine",
    title: "My module",
    rule: "A rule",
    cards: [{ en: "ZAP", he: "zap", meaning: "zap" }],
  }
  const mergedIds = (stored: ModuleExercise[]) =>
    withBuiltInModules(stored.map(module => toVersionedValue(module))).map(
      entry => entry.value.id,
    )

  test("seeds all built-ins on a first run", () => {
    expect(mergedIds([])).toStrictEqual(builtInModuleIds)
  })

  test("re-seeds built-ins missing from stored data, fixing the original's bug", () => {
    // The original replaced the built-in list wholesale with whatever was
    // stored, so a user who had only the first built-in never saw the rest
    // again.
    const stored = [at(defaultModuleExercises, 0), customModule]

    expect(mergedIds(stored)).toStrictEqual([...builtInModuleIds, "custom_1"])
  })

  test("a stored copy of a built-in wins, so user edits survive", () => {
    const edited = { ...at(defaultModuleExercises, 0), tabName: "Edited" }
    const merged = withBuiltInModules([toVersionedValue(edited)])

    expect(at(merged, 0).value.tabName).toBe("Edited")
  })

  test("keeps a deleted built-in's tombstone instead of re-seeding it", () => {
    const deleted = at(defaultModuleExercises, 1)
    const tombstone = markDeleted(toVersionedValue(deleted), INITIAL_UPDATED_AT)
    const merged = withBuiltInModules([tombstone])

    expect(liveValues(merged).map(m => m.id)).not.toContain(deleted.id)
    expect(at(merged, 1)).toStrictEqual(tombstone)
  })
})
