import { defaultUnseenExercise } from "@/data/defaultUnseenExercise"
import { defaultModuleExercises } from "@/data/defaultModuleExercises"
import { at } from "@test/helpers"
import {
  flashcardStatusKey,
  StorageKeys,
} from "@/utils/sync/legacy/legacyStorage"
import { toVersionedValue } from "@/utils/sync/versionedValue"
import {
  readSyncDocumentV2,
  SYNC_DOCUMENT_V2_KEY,
} from "@/utils/sync/syncDocumentStorage"
import { makeStore } from "./store"
import { selectSyncDocumentV2 } from "./syncDocument"
import {
  markCard,
  nextCard,
  selectModule,
  toggleFilterMissed,
} from "./slices/modulesSlice"
import {
  answerQuestion,
  markFlashcard,
  nextFlashcard,
  toggleMarkedWord,
} from "./slices/unseenSlice"
import {
  setSpeechRate,
  toggleDyslexiaFont,
  toggleShuffleUnseenAnswers,
} from "./slices/settingsSlice"
import { SpeechLang } from "@/types/speech"

const otherId = "other_1"

const preloaded = () => ({
  unseen: {
    exercises: [
      toVersionedValue(defaultUnseenExercise),
      toVersionedValue({ ...defaultUnseenExercise, exerciseId: otherId }),
    ],
    currentId: toVersionedValue(defaultUnseenExercise.exerciseId),
    cardIndex: toVersionedValue(0),
  },
  modules: {
    modules: defaultModuleExercises.map(module => toVersionedValue(module)),
    currentModuleId: toVersionedValue(at(defaultModuleExercises, 0).id),
    cardIndex: toVersionedValue(0),
    filterMissed: false,
    reviewingMissed: false,
    progress: [],
  },
})

const writtenLegacyKeys = () =>
  Object.keys(localStorage).filter(key => key !== SYNC_DOCUMENT_V2_KEY)

beforeEach(() => {
  localStorage.clear()
})

test("marking a flashcard writes only that exercise's status key", () => {
  const store = makeStore(preloaded())
  store.dispatch(markFlashcard({ word: "Delicate", isKnown: true }))

  const written = writtenLegacyKeys()
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

  expect(writtenLegacyKeys()).toStrictEqual([StorageKeys.markedWords])
  expect(localStorage.getItem(StorageKeys.markedWords)).toBe(
    JSON.stringify({ [defaultUnseenExercise.exerciseId]: ["Maya"] }),
  )
})

test("marking a module card writes only the module progress key", () => {
  const store = makeStore(preloaded())
  store.dispatch(markCard({ word: "HAT", isKnown: true }))

  expect(writtenLegacyKeys()).toStrictEqual([StorageKeys.modulesProgress])
  expect(localStorage.getItem(StorageKeys.modulesProgress)).toBe(
    JSON.stringify({ HAT: "known" }),
  )
})

test("the dyslexia preference is written to its key", () => {
  const store = makeStore(preloaded())
  store.dispatch(toggleDyslexiaFont())

  expect(localStorage.getItem(StorageKeys.dyslexiaFont)).toBe("1")
})

test("the answer-shuffle preference is written to its syncable key", () => {
  const store = makeStore(preloaded())
  store.dispatch(toggleShuffleUnseenAnswers())

  expect(writtenLegacyKeys()).toStrictEqual([StorageKeys.shuffleUnseenAnswers])
  expect(localStorage.getItem(StorageKeys.shuffleUnseenAnswers)).toBe("1")
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

  expect(writtenLegacyKeys()).toStrictEqual([StorageKeys.quizAnswers])
  expect(localStorage.getItem(StorageKeys.quizAnswers)).toBe(
    JSON.stringify({
      [defaultUnseenExercise.exerciseId]: {
        q1: { selected: 0, correct: true },
      },
    }),
  )
})

test("completing every unseen question persists all selected answers", () => {
  const store = makeStore(preloaded())
  for (const question of defaultUnseenExercise.questions) {
    store.dispatch(
      answerQuestion({ questionId: question.id, selected: 0, correct: true }),
    )
  }

  expect(localStorage.getItem(StorageKeys.quizAnswers)).toBe(
    JSON.stringify({
      [defaultUnseenExercise.exerciseId]: Object.fromEntries(
        defaultUnseenExercise.questions.map(question => [
          question.id,
          { selected: 0, correct: true },
        ]),
      ),
    }),
  )
})

test("advancing a flashcard writes only the flashcard-index key", () => {
  const store = makeStore(preloaded())
  store.dispatch(nextFlashcard(defaultUnseenExercise.flashcards.length))

  expect(writtenLegacyKeys()).toStrictEqual([StorageKeys.flashcardIndex])
  expect(localStorage.getItem(StorageKeys.flashcardIndex)).toBe("1")
})

test("advancing a module card writes only the module-card-index key", () => {
  const store = makeStore(preloaded())
  store.dispatch(nextCard(at(defaultModuleExercises, 0).cards.length))

  expect(writtenLegacyKeys()).toStrictEqual([StorageKeys.moduleCardIndex])
  expect(localStorage.getItem(StorageKeys.moduleCardIndex)).toBe("1")
})

test("switching modules writes only the current-module-id key", () => {
  const store = makeStore(preloaded())
  const secondModuleId = at(defaultModuleExercises, 1).id
  store.dispatch(selectModule(secondModuleId))

  expect(writtenLegacyKeys()).toStrictEqual([StorageKeys.currentModuleId])
  expect(localStorage.getItem(StorageKeys.currentModuleId)).toBe(secondModuleId)
})

describe("v2 document", () => {
  test("writes a valid v2 document that matches the store after a change", () => {
    const store = makeStore(preloaded())
    store.dispatch(markCard({ word: "HAT", isKnown: true }))

    expect(readSyncDocumentV2()).toStrictEqual(
      selectSyncDocumentV2(store.getState()),
    )
  })

  test("skips the write when no versioned field changed", () => {
    const store = makeStore(preloaded())
    store.dispatch(toggleFilterMissed())

    expect(localStorage.getItem(SYNC_DOCUMENT_V2_KEY)).toBeNull()
  })
})
