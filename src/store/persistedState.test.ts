import { makeStore } from "./store"
import {
  PERSISTED_STATE_KEY,
  readPersistedState,
  selectPersistedState,
  writePersistedState,
} from "./persistedState"

beforeEach(() => {
  localStorage.clear()
})

const defaultState = () => selectPersistedState(makeStore().getState())

test("round-trips the persisted default state", () => {
  const state = defaultState()

  writePersistedState(state)

  expect(readPersistedState()).toStrictEqual(state)
})

test("returns null when nothing is stored", () => {
  expect(readPersistedState()).toBeNull()
})

test("returns null for malformed JSON", () => {
  localStorage.setItem(PERSISTED_STATE_KEY, "{not json")

  expect(readPersistedState()).toBeNull()
})

test("returns null and warns for a state that fails validation", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
  localStorage.setItem(
    PERSISTED_STATE_KEY,
    JSON.stringify({ ...defaultState(), schemaVersion: 1 }),
  )

  expect(readPersistedState()).toBeNull()
  expect(warn).toHaveBeenCalledOnce()
})
