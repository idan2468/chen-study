import "@testing-library/jest-dom/vitest"
import { notifications } from "@mantine/notifications"
import { initI18n } from "@/i18n"

// The app defaults to Hebrew, but tests run in English so assertions and
// fixtures in test files stay readable without mixing scripts.
initI18n("en")

// Mantine's notification queue is a module-level store outside the React
// tree, so unmounting a test's <Notifications /> never clears it -- a toast
// left showing (e.g. no autoClose wait) would otherwise leak into the next
// test's queries.
afterEach(() => {
  notifications.clean()
})

// jsdom has no ResizeObserver; Mantine's ScrollArea (used inside Modal, Select,
// Menu, etc.) needs it just to mount.
class ResizeObserverStub {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}
Object.defineProperty(window, "ResizeObserver", {
  writable: true,
  value: ResizeObserverStub,
})

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
