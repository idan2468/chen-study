import { useCallback } from "react"
import { useDirection } from "@mantine/core"
import { useTranslation } from "react-i18next"
import { writeString } from "@/store/storage"
import { StorageKeys } from "@/utils/storageKeys"
import type { Locale } from "."
import { applyDocumentLocale, directionFor, DEFAULT_LOCALE } from "."

/**
 * Reads and switches the UI language: updates i18next, persists the choice,
 * and flips document direction + Mantine's direction context together.
 *
 * Not Redux state deliberately -- `react-i18next` already owns and
 * re-renders on it, so a slice would just be a second source of truth.
 */
export const useLocale = () => {
  const { i18n } = useTranslation()
  const { setDirection } = useDirection()

  const locale = (i18n.resolvedLanguage ?? DEFAULT_LOCALE) as Locale

  const setLocale = useCallback(
    (next: Locale) => {
      void i18n.changeLanguage(next)
      writeString(StorageKeys.locale, next)
      applyDocumentLocale(next)
      setDirection(directionFor(next))
    },
    [i18n, setDirection],
  )

  const toggleLocale = useCallback(() => {
    setLocale(locale === "he" ? "en" : "he")
  }, [locale, setLocale])

  return { locale, setLocale, toggleLocale }
}
