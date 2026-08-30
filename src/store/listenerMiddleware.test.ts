import { defaultUnseenExercise } from "@/data/defaultUnseenExercise"
import { defaultModuleExercises } from "@/data/defaultModuleExercises"
import { at } from "@test/helpers"
import { flashcardStatusKey, StorageKeys } from "@/utils/sync/storageKeys"
import { makeStore } from "./store"
import { markCard, nextCard, selectModule } from "./slices/modulesSlice"
import {
  answerQuestion,
  markFlashcard,
  nextFlashcard,
  toggleMarkedWord,
} from "./slices/unseenSlice"
import {
  setSpeechRate,
  SpeechLang,
  toggleDyslexiaFont,
} from "./slices/settingsSlice"

const otherId = "other_1"

const preloaded = () => ({
  unseen: {
    library: {
      [defaultUnseenExercise.exerciseId]: defaultUnseenExercise,
      [otherId]: { ...defaultUnseenExercise, exerciseId: otherId },
    },
    currentId: defaultUnseenExercise.exerciseId,
    cardIndex: 0,
    answers: {},
    markedWords: {},
    progress: { [defaultUnseenExercise.exerciseId]: {}, [otherId]: {} },
  },
  modules: {
    modules: [...defaultModuleExercises],
    currentModuleId: at(defaultModuleExercises, 0).id,
    cardIndex: 0,
    filterMissed: false,
    reviewingMissed: false,
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
    flashcardStatusKey(defaultUnseenExercise.exerciseId),
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
    localStorage.getItem(flashcardStatusKey(defaultUnseenExercise.exerciseId)),
  ).toBe(JSON.stringify({ Delicate: true, Batter: false }))
})

test("highlighting a word writes only the marked-words key", () => {
  const store = makeStore(preloaded())
  store.dispatch(toggleMarkedWord("Maya"))

  expect(Object.keys(localStorage)).toStrictEqual([StorageKeys.markedWords])
  expect(localStorage.getItem(StorageKeys.markedWords)).toBe(
    JSON.stringify({ [defaultUnseenExercise.exerciseId]: ["Maya"] }),
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

test("the dyslexia preference is written to its key", () => {
  const store = makeStore(preloaded())
  store.dispatch(toggleDyslexiaFont())

  expect(localStorage.getItem(StorageKeys.dyslexiaFont)).toBe("1")
})

test("speech rate is clamped before being persisted", () => {
  const store = makeStore(preloaded())
  store.dispatch(setSpeechRate({ lang: SpeechLang.English, rate: 99 }))

  expect(localStorage.getItem(StorageKeys.speechRate)).toBe("1")
})

test("answering a question writes only the quiz-answers key", () => {
  const store = makeStore(preloaded())
  store.dispatch(
    answerQuestion({ questionId: "q1", selected: 0, correct: true }),
  )

  expect(Object.keys(localStorage)).toStrictEqual([StorageKeys.quizAnswers])
  expect(localStorage.getItem(StorageKeys.quizAnswers)).toBe(
    JSON.stringify({ q1: { selected: 0, correct: true } }),
  )
})

test("advancing a flashcard writes only the flashcard-index key", () => {
  const store = makeStore(preloaded())
  store.dispatch(nextFlashcard(defaultUnseenExercise.flashcards.length))

  expect(Object.keys(localStorage)).toStrictEqual([StorageKeys.flashcardIndex])
  expect(localStorage.getItem(StorageKeys.flashcardIndex)).toBe("1")
})

test("advancing a module card writes only the module-card-index key", () => {
  const store = makeStore(preloaded())
  store.dispatch(nextCard(at(defaultModuleExercises, 0).cards.length))

  expect(Object.keys(localStorage)).toStrictEqual([StorageKeys.moduleCardIndex])
  expect(localStorage.getItem(StorageKeys.moduleCardIndex)).toBe("1")
})

test("switching modules writes only the current-module-id key", () => {
  const store = makeStore(preloaded())
  const secondModuleId = at(defaultModuleExercises, 1).id
  store.dispatch(selectModule(secondModuleId))

  expect(Object.keys(localStorage)).toStrictEqual([StorageKeys.currentModuleId])
  expect(localStorage.getItem(StorageKeys.currentModuleId)).toBe(secondModuleId)
})
