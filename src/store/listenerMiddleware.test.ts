import { defaultUnseenExercise } from "@/data/defaultUnseenExercise"
import { defaultModuleExercises } from "@/data/defaultModuleExercises"
import { at } from "@test/helpers"
import { StorageKeys } from "@/utils/sync/legacy/legacyStorage"
import { toVersionedValue } from "@/utils/sync/versionedValue"
import {
  PERSISTED_STATE_KEY,
  readLocalPersistedState,
  selectPersistedState,
} from "./persistedState"
import { makeStore } from "./store"
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
  setSystemVoiceUri,
  toggleDyslexiaFont,
  toggleShuffleUnseenAnswers,
} from "./slices/settingsSlice"
import { DEFAULT_SPEECH_RATE, SpeechLang } from "@/types/speech"

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
    missedReview: null,
    progress: [],
  },
})

beforeEach(() => {
  localStorage.clear()
})

test.each([
  ["marking a flashcard", markFlashcard({ word: "Delicate", isKnown: true })],
  ["highlighting a word", toggleMarkedWord("Maya")],
  [
    "answering a question",
    answerQuestion({ questionId: "q1", selected: 0, correct: true }),
  ],
  [
    "advancing a flashcard",
    nextFlashcard(defaultUnseenExercise.flashcards.length),
  ],
  ["marking a module card", markCard({ word: "HAT", isKnown: true })],
  [
    "advancing a module card",
    nextCard(at(defaultModuleExercises, 0).cards.length),
  ],
  ["switching modules", selectModule(at(defaultModuleExercises, 1).id)],
  ["toggling the dyslexia font", toggleDyslexiaFont()],
  ["toggling answer shuffling", toggleShuffleUnseenAnswers()],
])(
  "%s writes only the persisted state, matching the store",
  (_label, action) => {
    const store = makeStore(preloaded())
    store.dispatch(action)

    expect(Object.keys(localStorage)).toStrictEqual([PERSISTED_STATE_KEY])
    expect(readLocalPersistedState()).toStrictEqual(
      selectPersistedState(store.getState()),
    )
  },
)

test("an out-of-range speech rate falls back to the default before being persisted", () => {
  const store = makeStore(preloaded())
  store.dispatch(setSpeechRate({ lang: SpeechLang.English, rate: 0.8 }))
  store.dispatch(setSpeechRate({ lang: SpeechLang.English, rate: 99 }))

  expect(
    readLocalPersistedState()?.preferences.speechRateByLang[SpeechLang.English]
      .value,
  ).toBe(DEFAULT_SPEECH_RATE)
})

test("a system voice is written to its device-local key only", () => {
  const store = makeStore(preloaded())
  store.dispatch(setSystemVoiceUri({ lang: SpeechLang.Hebrew, uri: "Carmit" }))
  store.dispatch(setSystemVoiceUri({ lang: SpeechLang.English, uri: null }))

  expect(localStorage.getItem(StorageKeys.systemVoiceHe)).toBe("Carmit")
  expect(localStorage.getItem(StorageKeys.systemVoice)).toBe("")
  expect(localStorage.getItem(PERSISTED_STATE_KEY)).toBeNull()
})

test("skips the write when no versioned field changed", () => {
  const store = makeStore(preloaded())
  store.dispatch(toggleFilterMissed())

  expect(localStorage.getItem(PERSISTED_STATE_KEY)).toBeNull()
})
