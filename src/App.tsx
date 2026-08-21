import { useEffect } from "react"
import { Route, Routes, useLocation } from "react-router-dom"
import { notifications } from "@mantine/notifications"
import { useTranslation } from "react-i18next"
import { useAppDispatch, useAppSelector } from "./store/hooks"
import { selectDyslexiaFont } from "./store/slices/settingsSlice"
import { speechStopped } from "./store/slices/speechSlice"
import { cancelSpeech } from "./utils/speech/speech"
import { HubPage } from "./pages/hub/HubPage"
import { ModulesPage } from "./pages/modules/ModulesPage"
import { UnseenPage } from "./pages/unseen/UnseenPage"

export type AppProps = {
  /** Number of keys pulled in from a `?sync=` link, or `null` if none. */
  importedKeyCount: number | null
}

/**
 * The dyslexia rule keys off a body class, since it overrides the global
 * Mantine font variable (see `styles/global.css`).
 */
const useDyslexiaBodyClass = () => {
  const dyslexiaFont = useAppSelector(selectDyslexiaFont)

  useEffect(() => {
    document.body.classList.toggle("dyslexiaFont", dyslexiaFont)
  }, [dyslexiaFont])
}

/**
 * `speechSynthesis` is a browser singleton, so leaving a page has to silence
 * whatever it started. Dispatched directly rather than through `useSpeech`,
 * to keep the whole app from re-rendering on every speech state change.
 */
const useStopSpeechOnRouteChange = () => {
  const dispatch = useAppDispatch()
  const { pathname } = useLocation()

  useEffect(() => {
    return () => {
      cancelSpeech()
      dispatch(speechStopped())
    }
  }, [pathname, dispatch])
}

/** Replaces the original's `alert()` after importing a shared link. */
const useSyncImportNotice = (importedKeyCount: number | null) => {
  const { t } = useTranslation()

  useEffect(() => {
    if (importedKeyCount !== null) {
      notifications.show({
        // A fixed id makes this idempotent, so StrictMode's double-invoked
        // effects (and any future remount) update the toast instead of
        // stacking a second copy.
        id: "sync-import",
        color: "success",
        title: t("sync.importedTitle"),
        message: t("sync.importedMessage", { count: importedKeyCount }),
      })
    }
  }, [importedKeyCount, t])
}

export const App = ({ importedKeyCount }: AppProps) => {
  useDyslexiaBodyClass()
  useStopSpeechOnRouteChange()
  useSyncImportNotice(importedKeyCount)

  return (
    <Routes>
      <Route path="/" element={<HubPage />} />
      <Route path="/unseen" element={<UnseenPage />} />
      <Route path="/modules" element={<ModulesPage />} />
      {/* Anything unrecognised falls back to the hub. */}
      <Route path="*" element={<HubPage />} />
    </Routes>
  )
}
