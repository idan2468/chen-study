import { StorageKeys } from "@/utils/sync/storageKeys"
import { makeStore } from "@/store/store"
import {
  DEFAULT_SPEECH_RATE,
  selectDyslexiaFont,
  selectSpeechRate,
  selectSystemVoiceUri,
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

    test("drops the retired Modules-page key so it stops riding along in sync links", () => {
      localStorage.setItem("dyslexia_font_enabled_modules", "1")

      makeStore()

      expect(localStorage.getItem("dyslexia_font_enabled_modules")).toBeNull()
    })
  })

  describe("speechRate", () => {
    test("defaults when nothing is stored", () => {
      const store = makeStore()

      expect(selectSpeechRate(store.getState())).toBe(DEFAULT_SPEECH_RATE)
    })

    test("reopens on the stored rate", () => {
      localStorage.setItem(StorageKeys.speechRate, "0.75")

      const store = makeStore()

      expect(selectSpeechRate(store.getState())).toBe(0.75)
    })

    test("clamps a stored rate above the maximum", () => {
      localStorage.setItem(StorageKeys.speechRate, "5")

      const store = makeStore()

      expect(selectSpeechRate(store.getState())).toBe(1)
    })

    test("clamps a stored rate below the minimum", () => {
      localStorage.setItem(StorageKeys.speechRate, "-2")

      const store = makeStore()

      expect(selectSpeechRate(store.getState())).toBe(0.1)
    })

    test("falls back to the default for unparsable input", () => {
      localStorage.setItem(StorageKeys.speechRate, "not-a-number")

      const store = makeStore()

      expect(selectSpeechRate(store.getState())).toBe(DEFAULT_SPEECH_RATE)
    })
  })

  describe("systemVoiceUri", () => {
    test("null when nothing is stored, meaning 'best available'", () => {
      const store = makeStore()

      expect(selectSystemVoiceUri(store.getState())).toBeNull()
    })

    test("reopens on the stored voice", () => {
      localStorage.setItem(StorageKeys.systemVoice, "Google US English")

      const store = makeStore()

      expect(selectSystemVoiceUri(store.getState())).toBe("Google US English")
    })
  })
})
