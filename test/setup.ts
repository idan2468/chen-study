import "@testing-library/jest-dom/vitest"
import { initI18n } from "@/i18n"

// The app defaults to Hebrew, but tests run in English so assertions and
// fixtures in test files stay readable without mixing scripts.
initI18n("en")

// jsdom does not implement matchMedia; Mantine's colour-scheme hooks need it.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
})

// jsdom has no `speechSynthesis`, so `isSpeechSupported()` (utils/speech.ts)
// is false and every `SpeakButton` renders `null` in tests. This is a minimal
// fake -- enough for a click to dispatch through `useSpeech`, not a real audio
// pipeline. `vi.fn()` here (rather than plain functions) is what lets
// `restoreMocks: true` reset call history between tests.
Object.defineProperty(window, "speechSynthesis", {
  writable: true,
  value: {
    speak: vi.fn(),
    cancel: vi.fn(),
    getVoices: vi.fn(() => []),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  },
})

// `SyncModal`'s copy-link button goes through `@mantine/hooks`' `useClipboard`,
// which needs `navigator.clipboard.writeText` in jsdom.
Object.defineProperty(navigator, "clipboard", {
  writable: true,
  configurable: true,
  value: {
    writeText: vi.fn(() => Promise.resolve()),
  },
})

// Slices hydrate from real `window.localStorage` via lazy initializers. Logic
// tests either pass `preloadedState` or clear storage themselves in
// `beforeEach`; component tests should follow the same
// `beforeEach(() => localStorage.clear())` convention and prefer
// `preloadedState` over relying on hydration, for determinism.
