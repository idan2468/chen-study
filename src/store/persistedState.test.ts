import { makeStore } from "./store"
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
