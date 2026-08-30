import { StorageKeys } from "@/utils/sync/storageKeys"
import { makeStore } from "@/store/store"
import {
  DEFAULT_SPEECH_RATE,
  reloadFromStorage,
  selectDyslexiaFont,
  selectSpeechRate,
  selectSystemVoiceUri,
  setSpeechRate,
  SpeechLang,
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
