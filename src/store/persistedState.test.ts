import { makeStore } from "./store"
import { addModules, deleteModule } from "./slices/modulesSlice"
import { defaultModuleExercises } from "@/data/defaultModuleExercises"
import { at } from "@test/helpers"
import { defaultUnseenExercise } from "@/data/defaultUnseenExercise"
import type { UnseenExercise } from "@/types/unseenExercise"
import { markDeleted, toVersionedValue } from "@/utils/sync/versionedValue"
import {
  PERSISTED_STATE_KEY,
  readLocalPersistedState,
  REJECTED_PERSISTED_STATE_KEY,
  selectPersistedState,
  writeLocalPersistedState,
} from "./persistedState"

beforeEach(() => {
  localStorage.clear()
})

/** Stores a document as-is, bypassing the typed writer, to test rejection. */
const writeRaw = (document: unknown) => {
  localStorage.setItem(PERSISTED_STATE_KEY, JSON.stringify(document))
}

/** A valid exercise with the given ID, built from the default content. */
const exercise = (exerciseId: string): UnseenExercise => ({
  ...defaultUnseenExercise,
  exerciseId,
})

const defaultState = () => selectPersistedState(makeStore().getState())

test("round-trips the persisted default state", () => {
  const state = defaultState()

  writeLocalPersistedState(state)

  expect(readLocalPersistedState()).toStrictEqual(state)
})

test("returns null when nothing is stored", () => {
  expect(readLocalPersistedState()).toBeNull()
})

test("returns null for malformed JSON", () => {
  localStorage.setItem(PERSISTED_STATE_KEY, "{not json")

  expect(readLocalPersistedState()).toBeNull()
})

test("returns null and warns for a state that fails validation", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
  localStorage.setItem(
    PERSISTED_STATE_KEY,
    JSON.stringify({ ...defaultState(), schemaVersion: 1 }),
  )

  expect(readLocalPersistedState()).toBeNull()
  expect(warn).toHaveBeenCalledOnce()
})

test("rejects a speech rate outside the allowed range", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
  const state = defaultState()
  localStorage.setItem(
    PERSISTED_STATE_KEY,
    JSON.stringify({
      ...state,
      preferences: {
        ...state.preferences,
        speechRateByLang: {
          ...state.preferences.speechRateByLang,
          en: { ...state.preferences.speechRateByLang.en, value: 5 },
        },
      },
    }),
  )

  expect(readLocalPersistedState()).toBeNull()
  expect(warn).toHaveBeenCalledOnce()
})

test("rejects stored content the import rules would reject", () => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined)
  const state = defaultState()
  const [exercise] = state.unseen.exercises
  localStorage.setItem(
    PERSISTED_STATE_KEY,
    JSON.stringify({
      ...state,
      unseen: {
        ...state.unseen,
        exercises: [
          exercise && {
            ...exercise,
            value: { ...exercise.value, flashcards: [] },
          },
        ],
      },
    }),
  )

  expect(readLocalPersistedState()).toBeNull()
})

describe("identity rules", () => {
  const withModuleProgress = (progress: unknown[]) => {
    const state = defaultState()
    return { ...state, modules: { ...state.modules, progress } }
  }
  const record = (word: string, status = "known") => ({
    value: { word, status },
    updatedAt: "2026-09-27T10:00:00.000+03:00",
    deleted: false,
  })

  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
  })

  test.each([
    ["two entries for one word", [record("HAT"), record("HAT", "unknown")]],
    ["an empty word", [record("")]],
  ])("rejects %s", (_label, progress) => {
    localStorage.setItem(
      PERSISTED_STATE_KEY,
      JSON.stringify(withModuleProgress(progress)),
    )

    expect(readLocalPersistedState()).toBeNull()
  })

  test("accepts distinct words", () => {
    localStorage.setItem(
      PERSISTED_STATE_KEY,
      JSON.stringify(withModuleProgress([record("HAT"), record("FOX")])),
    )

    expect(readLocalPersistedState()?.modules.progress).toHaveLength(2)
  })
})

test("a deleted and re-imported module is saved as one valid entry", () => {
  const store = makeStore()
  const module = at(defaultModuleExercises, 1)
  store.dispatch(deleteModule(module.id))
  store.dispatch(addModules([module]))

  const saved = readLocalPersistedState()
  const entries = saved?.modules.modules.filter(
    entry => entry.value.id === module.id,
  )

  expect(entries).toHaveLength(1)
  expect(entries?.[0]?.deleted).toBe(false)
})

describe("a current ID that isn't live", () => {
  const NOW = "2026-09-27T10:00:00.000+03:00"

  test("a deleted current exercise becomes the first live one, at card 0", () => {
    const state = defaultState()
    const exercises = [
      markDeleted(toVersionedValue(exercise("gone")), NOW),
      toVersionedValue(exercise("kept")),
    ]
    writeRaw({
      ...state,
      unseen: {
        exercises,
        currentId: toVersionedValue("gone", NOW),
        cardIndex: toVersionedValue(3, NOW),
      },
    })

    const unseen = readLocalPersistedState()?.unseen

    expect(unseen?.currentId).toStrictEqual(toVersionedValue("kept", NOW))
    expect(unseen?.cardIndex).toStrictEqual(toVersionedValue(0, NOW))
  })

  test("a deleted current module becomes the first live one, at card 0", () => {
    const state = defaultState()
    const [deleted, ...rest] = state.modules.modules
    writeRaw({
      ...state,
      modules: {
        ...state.modules,
        modules: [deleted && markDeleted(deleted, NOW), ...rest],
        currentModuleId: toVersionedValue(deleted?.value.id ?? "", NOW),
        cardIndex: toVersionedValue(5, NOW),
      },
    })

    const modules = readLocalPersistedState()?.modules

    expect(modules?.currentModuleId.value).toBe(rest[0]?.value.id)
    expect(modules?.cardIndex.value).toBe(0)
  })

  test("is empty when nothing is live", () => {
    const state = defaultState()
    writeRaw({
      ...state,
      unseen: {
        exercises: [markDeleted(toVersionedValue(exercise("gone")), NOW)],
        currentId: toVersionedValue("gone", NOW),
        cardIndex: toVersionedValue(2, NOW),
      },
    })

    expect(readLocalPersistedState()?.unseen.currentId.value).toBe("")
  })
})

describe("a rejected local document", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
  })

  test.each([
    ["malformed JSON", "{not json"],
    ["a schema failure", JSON.stringify({ schemaVersion: 1 })],
  ])("is backed up before falling back (%s)", (_label, raw) => {
    localStorage.setItem(PERSISTED_STATE_KEY, raw)

    expect(readLocalPersistedState()).toBeNull()
    expect(localStorage.getItem(REJECTED_PERSISTED_STATE_KEY)).toBe(raw)
  })

  test("survives the next write, which replaces the rejected document", () => {
    localStorage.setItem(PERSISTED_STATE_KEY, "{not json")
    const store = makeStore()

    store.dispatch(addModules([at(defaultModuleExercises, 0)]))

    expect(readLocalPersistedState()).not.toBeNull()
    expect(localStorage.getItem(REJECTED_PERSISTED_STATE_KEY)).toBe("{not json")
  })
})
