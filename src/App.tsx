import { useEffect } from "react"
import { Route, Routes, useLocation } from "react-router-dom"
import { APP_ROUTES } from "./constants/routes"
import { GoogleConnectProvider } from "./hooks/sync/GoogleConnectContext"
import { useAppDispatch, useAppSelector } from "./store/hooks"
import { selectDyslexiaFont } from "./store/slices/settingsSlice"
import { speechStopped } from "./store/slices/speechSlice"
import { cancelSpeech } from "./utils/speech/speech"
import { HubPage } from "./pages/hub/HubPage"
import { ModulesPage } from "./pages/modules/ModulesPage"
import { UnseenPage } from "./pages/unseen/UnseenPage"

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

export const App = () => {
  useDyslexiaBodyClass()
  useStopSpeechOnRouteChange()

  return (
    <GoogleConnectProvider>
      <Routes>
        <Route path={APP_ROUTES.home} element={<HubPage />} />
        <Route path={APP_ROUTES.unseen} element={<UnseenPage />} />
        <Route path={APP_ROUTES.modules} element={<ModulesPage />} />
        {/* Anything unrecognised falls back to the hub. */}
        <Route path="*" element={<HubPage />} />
      </Routes>
    </GoogleConnectProvider>
  )
}
