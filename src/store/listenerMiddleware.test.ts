import { defaultExercise } from "../data/defaultExercise"
import { defaultModules } from "../data/defaultModules"
import { flashcardStatusKey, StorageKeys } from "../utils/storageKeys"
import { makeStore } from "./store"
import { markCard } from "./slices/modulesSlice"
import { markFlashcard, toggleMarkedWord } from "./slices/unseenSlice"
import { setSpeechRate, toggleDyslexiaFont } from "./slices/settingsSlice"

const otherId = "other_1"

const preloaded = () => ({
  unseen: {
    library: {
      [defaultExercise.exerciseId]: defaultExercise,
      [otherId]: { ...defaultExercise, exerciseId: otherId },
    },
    currentId: defaultExercise.exerciseId,
    cardIndex: 0,
    answers: {},
    markedWords: {},
    progress: { [defaultExercise.exerciseId]: {}, [otherId]: {} },
  },
  modules: {
    modules: [...defaultModules],
    currentModuleId: "mod1",
    cardIndex: 0,
    filterMissed: false,
    progress: {},
    deletedBuiltInIds: [],
  },
})

beforeEach(() => {
  localStorage.clear()
})

test("marking a flashcard writes only that exercise's status key", () => {
  const store = makeStore(preloaded())
  store.dispatch(markFlashcard({ word: "Delicate", isKnown: true }))

  const written = Object.keys(localStorage)
  expect(written).toStrictEqual([
    flashcardStatusKey(defaultExercise.exerciseId),
  ])
  // The other exercise's key, and the library itself, are left untouched.
  expect(localStorage.getItem(flashcardStatusKey(otherId))).toBeNull()
  expect(localStorage.getItem(StorageKeys.exerciseLibrary)).toBeNull()
})

test("stores flashcard progress in the original's shape", () => {
  const store = makeStore(preloaded())
  store.dispatch(markFlashcard({ word: "Delicate", isKnown: true }))
  store.dispatch(markFlashcard({ word: "Batter", isKnown: false }))

  expect(
    localStorage.getItem(flashcardStatusKey(defaultExercise.exerciseId)),
  ).toBe(JSON.stringify({ Delicate: true, Batter: false }))
})

test("highlighting a word writes only the marked-words key", () => {
  const store = makeStore(preloaded())
  store.dispatch(toggleMarkedWord("Maya"))

  expect(Object.keys(localStorage)).toStrictEqual([StorageKeys.markedWords])
  expect(localStorage.getItem(StorageKeys.markedWords)).toBe(
    JSON.stringify({ [defaultExercise.exerciseId]: ["Maya"] }),
  )
})

test("marking a module card writes only the module progress key", () => {
  const store = makeStore(preloaded())
  store.dispatch(markCard({ word: "HAT", isKnown: true }))

  expect(Object.keys(localStorage)).toStrictEqual([StorageKeys.modulesProgress])
  expect(localStorage.getItem(StorageKeys.modulesProgress)).toBe(
    JSON.stringify({ HAT: "known" }),
  )
})

test("the dyslexia preference is written to both legacy keys", () => {
  // The two original pages each kept their own copy.
  const store = makeStore(preloaded())
  store.dispatch(toggleDyslexiaFont())

  expect(localStorage.getItem(StorageKeys.dyslexiaFont)).toBe("1")
  expect(localStorage.getItem(StorageKeys.dyslexiaFontModules)).toBe("1")
})

test("speech rate is clamped before being persisted", () => {
  const store = makeStore(preloaded())
  store.dispatch(setSpeechRate(99))

  expect(localStorage.getItem(StorageKeys.speechRate)).toBe("1")
})
