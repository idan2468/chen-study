import {
  reloadFromStorage,
  selectPersistedState,
  writeLocalPersistedState,
} from "@/store/persistedState"
import { DeviceStorageKeys } from "@/store/deviceStorageKeys"
import { makeStore } from "@/store/store"
import { toVersionedValue } from "@/utils/sync/versionedValue"
import {
  selectDyslexiaFont,
  selectShuffleUnseenAnswers,
  selectSpeechRate,
  selectSystemVoiceUri,
  setSpeechRate,
  toggleDyslexiaFont,
  toggleShuffleUnseenAnswers,
} from "@/store/slices/settingsSlice"
import { DEFAULT_SPEECH_RATE, SpeechLang } from "@/types/speech"

describe("hydration", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe("dyslexiaFont", () => {
    test("off when the key is not set", () => {
      const store = makeStore()

      expect(selectDyslexiaFont(store.getState())).toBe(false)
    })

    test("reopens on after it was turned on", () => {
      makeStore().dispatch(toggleDyslexiaFont())

      expect(selectDyslexiaFont(makeStore().getState())).toBe(true)
    })
  })

  describe("shuffleUnseenAnswers", () => {
    test("defaults off and reopens on the stored preference", () => {
      expect(selectShuffleUnseenAnswers(makeStore().getState())).toBe(false)

      makeStore().dispatch(toggleShuffleUnseenAnswers())

      expect(selectShuffleUnseenAnswers(makeStore().getState())).toBe(true)
    })
  })

  describe("speechRate", () => {
    test("defaults when nothing is stored, independently per language", () => {
      const store = makeStore()

      expect(selectSpeechRate(store.getState(), SpeechLang.English)).toBe(
        DEFAULT_SPEECH_RATE,
      )
      expect(selectSpeechRate(store.getState(), SpeechLang.Hebrew)).toBe(
        DEFAULT_SPEECH_RATE,
      )
    })

    test("reopens on the stored rate, independently per language", () => {
      const previous = makeStore()
      previous.dispatch(setSpeechRate({ lang: SpeechLang.English, rate: 0.75 }))
      previous.dispatch(setSpeechRate({ lang: SpeechLang.Hebrew, rate: 0.3 }))

      const store = makeStore()

      expect(selectSpeechRate(store.getState(), SpeechLang.English)).toBe(0.75)
      expect(selectSpeechRate(store.getState(), SpeechLang.Hebrew)).toBe(0.3)
    })
  })

  describe("systemVoiceUri", () => {
    test("null when nothing is stored, meaning 'best available'", () => {
      const store = makeStore()

      expect(
        selectSystemVoiceUri(store.getState(), SpeechLang.English),
      ).toBeNull()
      expect(
        selectSystemVoiceUri(store.getState(), SpeechLang.Hebrew),
      ).toBeNull()
    })

    test("reopens on the stored voice, independently per language", () => {
      localStorage.setItem(DeviceStorageKeys.systemVoice, "Google US English")
      localStorage.setItem(DeviceStorageKeys.systemVoiceHe, "Carmit")

      const store = makeStore()

      expect(selectSystemVoiceUri(store.getState(), SpeechLang.English)).toBe(
        "Google US English",
      )
      expect(selectSystemVoiceUri(store.getState(), SpeechLang.Hebrew)).toBe(
        "Carmit",
      )
    })
  })
})

describe("reloadFromStorage", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  test("discards in-memory changes and re-reads local v2 plus device voices", () => {
    const store = makeStore()
    store.dispatch(setSpeechRate({ lang: SpeechLang.English, rate: 0.9 }))

    const persisted = selectPersistedState(store.getState())
    writeLocalPersistedState({
      ...persisted,
      preferences: {
        ...persisted.preferences,
        dyslexiaFont: toVersionedValue(true),
        speechRateByLang: {
          ...persisted.preferences.speechRateByLang,
          [SpeechLang.English]: toVersionedValue(0.3),
        },
      },
    })
    localStorage.setItem(DeviceStorageKeys.systemVoice, "Google US English")
    localStorage.setItem(DeviceStorageKeys.systemVoiceHe, "Carmit")
    store.dispatch(reloadFromStorage())

    const state = store.getState()
    expect(selectDyslexiaFont(state)).toBe(true)
    expect(selectSpeechRate(state, SpeechLang.English)).toBe(0.3)
    expect(selectSystemVoiceUri(state, SpeechLang.English)).toBe(
      "Google US English",
    )
    expect(selectSystemVoiceUri(state, SpeechLang.Hebrew)).toBe("Carmit")
  })
})

describe("version metadata", () => {
  const NOW = "2026-09-26T11:00:00.000+03:00"

  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers({ toFake: ["Date"], now: new Date(NOW) })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test("loads stored preferences at the initial timestamp", () => {
    const { settings } = makeStore().getState()

    expect(settings.dyslexiaFont).toStrictEqual(toVersionedValue(false))
    expect(settings.speechRateByLang[SpeechLang.Hebrew]).toStrictEqual(
      toVersionedValue(DEFAULT_SPEECH_RATE),
    )
  })

  test("stamps a changed preference and leaves an unchanged one alone", () => {
    const store = makeStore()

    store.dispatch(toggleDyslexiaFont())
    store.dispatch(
      setSpeechRate({ lang: SpeechLang.English, rate: DEFAULT_SPEECH_RATE }),
    )

    const { settings } = store.getState()
    expect(settings.dyslexiaFont).toStrictEqual(toVersionedValue(true, NOW))
    expect(settings.speechRateByLang[SpeechLang.English]).toStrictEqual(
      toVersionedValue(DEFAULT_SPEECH_RATE),
    )
  })
})
