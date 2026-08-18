import { useCallback } from "react"
import { useDirection } from "@mantine/core"
import { useTranslation } from "react-i18next"
import { writeString } from "@/store/storage"
import { StorageKeys } from "@/utils/storageKeys"
import type { Locale } from "."
import { applyDocumentLocale, directionFor, DEFAULT_LOCALE } from "."

/**
 * Reads and switches the UI language.
 *
 * Switching a language here does three things at once, which is why it is a
 * single hook rather than three call sites: it changes i18next's active
 * language, persists the choice, and flips the document plus Mantine's
 * direction context so every Mantine component mirrors.
 *
 * Deliberately *not* Redux state: `react-i18next` already owns it and
 * re-renders subscribers, so duplicating it in a slice would mean keeping two
 * sources of truth in sync.
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
