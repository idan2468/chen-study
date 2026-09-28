import { makeStore } from "./store"
import { addModules, deleteModule } from "./slices/modulesSlice"
import { defaultModuleExercises } from "@/data/defaultModuleExercises"
import { at } from "@test/helpers"
import {
  PERSISTED_STATE_KEY,
  readLocalPersistedState,
  selectPersistedState,
  writeLocalPersistedState,
} from "./persistedState"

beforeEach(() => {
  localStorage.clear()
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

test.each([
  ["exercise", "unseen", "exercises", "currentId", "exerciseId"],
  ["module", "modules", "modules", "currentModuleId", "id"],
] as const)(
  "rejects a current %s that is deleted",
  (_label, section, list, current, idKey) => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const state = defaultState()
    const sectionState = state[section] as Record<string, unknown>
    const entries = sectionState[list] as {
      value: Record<string, unknown>
      deleted: boolean
    }[]
    const target = entries.find(entry => !entry.deleted)
    const invalid = {
      ...state,
      [section]: {
        ...sectionState,
        [list]: entries.map(entry =>
          entry === target ? { ...entry, deleted: true } : entry,
        ),
        [current]: {
          ...(sectionState[current] as object),
          value: target?.value[idKey],
        },
      },
    }
    localStorage.setItem(PERSISTED_STATE_KEY, JSON.stringify(invalid))

    expect(readLocalPersistedState()).toBeNull()
  },
)
