import { StorageKeys } from "@/utils/sync/legacy/legacyStorage"
import { makeStore } from "@/store/store"
import { toVersionedValue } from "@/utils/sync/versionedValue"
import {
  DEFAULT_SPEECH_RATE,
  reloadFromStorage,
  selectDyslexiaFont,
  selectShuffleUnseenAnswers,
  selectSpeechRate,
  selectSystemVoiceUri,
  setSpeechRate,
  SpeechLang,
  toggleDyslexiaFont,
} from "./settingsSlice"

describe("hydration", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe("dyslexiaFont", () => {
    test("off when the key is not set", () => {
      const store = makeStore()

      expect(selectDyslexiaFont(store.getState())).toBe(false)
    })

    test("on when the key is set", () => {
      localStorage.setItem(StorageKeys.dyslexiaFont, "1")

      const store = makeStore()

      expect(selectDyslexiaFont(store.getState())).toBe(true)
    })
  })

  describe("shuffleUnseenAnswers", () => {
    test("defaults off and reopens on the stored preference", () => {
      expect(selectShuffleUnseenAnswers(makeStore().getState())).toBe(false)

      localStorage.setItem(StorageKeys.shuffleUnseenAnswers, "1")

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
      localStorage.setItem(StorageKeys.speechRate, "0.75")
      localStorage.setItem(StorageKeys.speechRateHe, "0.3")

      const store = makeStore()

      expect(selectSpeechRate(store.getState(), SpeechLang.English)).toBe(0.75)
      expect(selectSpeechRate(store.getState(), SpeechLang.Hebrew)).toBe(0.3)
    })

    test("clamps a stored rate above the maximum", () => {
      localStorage.setItem(StorageKeys.speechRate, "5")

      const store = makeStore()

      expect(selectSpeechRate(store.getState(), SpeechLang.English)).toBe(1)
    })

    test("clamps a stored rate below the minimum", () => {
      localStorage.setItem(StorageKeys.speechRate, "-2")

      const store = makeStore()

      expect(selectSpeechRate(store.getState(), SpeechLang.English)).toBe(0.1)
    })

    test("falls back to the default for unparsable input", () => {
      localStorage.setItem(StorageKeys.speechRate, "not-a-number")

      const store = makeStore()

      expect(selectSpeechRate(store.getState(), SpeechLang.English)).toBe(
        DEFAULT_SPEECH_RATE,
      )
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
      localStorage.setItem(StorageKeys.systemVoice, "Google US English")
      localStorage.setItem(StorageKeys.systemVoiceHe, "Carmit")

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

  test("discards in-memory changes and re-reads whatever is in storage now, e.g. after a Drive pull", () => {
    const store = makeStore()
    store.dispatch(setSpeechRate({ lang: SpeechLang.English, rate: 0.9 }))

    localStorage.setItem(StorageKeys.dyslexiaFont, "1")
    localStorage.setItem(StorageKeys.speechRate, "0.3")
    localStorage.setItem(StorageKeys.systemVoice, "Google US English")
    localStorage.setItem(StorageKeys.systemVoiceHe, "Carmit")
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
