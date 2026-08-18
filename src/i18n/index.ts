import i18next from "i18next"
import { initReactI18next } from "react-i18next"
import { readString } from "@/store/storage"
import { StorageKeys } from "@/utils/storageKeys"
import { en } from "./en"
import { he } from "./he"

export const locales = ["he", "en"] as const
export type Locale = (typeof locales)[number]

/** Hebrew is the default, matching the original apps. */
export const DEFAULT_LOCALE: Locale = "he"

/** The chrome direction follows the UI language. Hebrew content keeps its own
 *  explicit `dir="rtl"` wherever it is rendered, so switching to English does
 *  not flip the teaching material. */
export const directionFor = (locale: Locale) =>
  locale === "he" ? "rtl" : "ltr"

const isLocale = (value: string): value is Locale =>
  locales.includes(value as Locale)

export const readStoredLocale = (): Locale => {
  const stored = readString(StorageKeys.locale, "")
  return isLocale(stored) ? stored : DEFAULT_LOCALE
}

/** Keeps the document in sync with the active language, for assistive tech and
 *  for Mantine's `DirectionProvider`, which reads `dir` on mount. */
export const applyDocumentLocale = (locale: Locale) => {
  document.documentElement.lang = locale
  document.documentElement.dir = directionFor(locale)
}

/**
 * Synchronous on purpose. `init` returns a promise, but with the resources
 * supplied inline there is no backend to wait on, so the catalogues are in place
 * by the time it returns and the first render already has its translations.
 * Awaiting it would mean top-level `await` in `main.tsx`, which the ES2020 build
 * target rejects.
 */
export const initI18n = (locale: Locale) => {
  void i18next.use(initReactI18next).init({
    lng: locale,
    fallbackLng: DEFAULT_LOCALE,
    defaultNS: "translation",
    resources: {
      he: { translation: he },
      en: { translation: en },
    },
    interpolation: {
      // React already escapes interpolated values.
      escapeValue: false,
    },
    react: {
      // Nothing loads asynchronously, so there is nothing to suspend on.
      useSuspense: false,
    },
  })
}

export { i18next }
