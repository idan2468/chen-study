import { useDirection, useMantineColorScheme } from "@mantine/core"
import { useTranslation } from "react-i18next"
import { useAppDispatch } from "@/store/hooks"
import { reloadFromStorage as reloadModules } from "@/store/slices/modulesSlice"
import { reloadFromStorage as reloadSettings } from "@/store/slices/settingsSlice"
import { reloadFromStorage as reloadUnseen } from "@/store/slices/unseenSlice"
import { colorSchemeManager } from "@/theme"
import { applyDocumentLocale, directionFor, readStoredLocale } from "@/i18n"

/**
 * Resets the running app from whatever is now in localStorage -- store,
 * locale and colour scheme -- without a page reload. Needed because every
 * slice only reads localStorage once, in its lazy initializer at store
 * creation (see `store/store.ts`); a Drive pull that lands after the app is
 * already mounted has no other way to take effect. See
 * docs/google-account-sync.md, "After a pull".
 */
export const useRehydrateFromStorage = () => {
  const dispatch = useAppDispatch()
  const { i18n } = useTranslation()
  const { setDirection } = useDirection()
  const { setColorScheme } = useMantineColorScheme()

  const reloadLocale = () => {
    const locale = readStoredLocale()
    applyDocumentLocale(locale)
    void i18n.changeLanguage(locale)
    setDirection(directionFor(locale))
  }

  return () => {
    dispatch(reloadSettings())
    dispatch(reloadUnseen())
    dispatch(reloadModules())

    reloadLocale()

    setColorScheme(colorSchemeManager().get("dark"))
  }
}
