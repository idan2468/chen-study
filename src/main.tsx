import "@mantine/core/styles.css"
import "@mantine/notifications/styles.css"
import "./styles/global.css"

import { DirectionProvider, MantineProvider } from "@mantine/core"
import { ModalsProvider } from "@mantine/modals"
import { Notifications } from "@mantine/notifications"
import { GoogleOAuthProvider } from "@react-oauth/google"
import type { ReactNode } from "react"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { Provider } from "react-redux"
import { HashRouter } from "react-router-dom"
import { App } from "./App"
import {
  applyDocumentLocale,
  directionFor,
  initI18n,
  readStoredLocale,
} from "./i18n"
import { makeStore } from "./store/store"
import { colorSchemeManager, cssVariablesResolver, theme } from "./theme"
import { GOOGLE_CLIENT_ID } from "./utils/sync/google/googleAuth"
import { importSyncFromUrl } from "./utils/sync/syncUrl"

/** No-op when unset, so a build without `VITE_GOOGLE_CLIENT_ID` doesn't load GIS at all. */
const GoogleAuthGate = ({ children }: { children: ReactNode }) =>
  GOOGLE_CLIENT_ID ? (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      {children}
    </GoogleOAuthProvider>
  ) : (
    children
  )

/** A function rather than top-level `await`, which the build target may not allow. */
const bootstrap = async () => {
  // Order matters: a shared-link payload has to land in localStorage *before* the
  // store is created and before the locale is read, because both hydrate from it.
  // Expressed as explicit statements rather than relying on module import order.
  const importedKeyCount = await importSyncFromUrl()
  const store = makeStore()

  const locale = readStoredLocale()
  // Set `lang`/`dir` before mounting: Mantine's DirectionProvider reads `dir` off
  // the html element on mount to decide its initial direction.
  applyDocumentLocale(locale)
  initI18n(locale)

  const container = document.getElementById("root")
  if (!container) {
    throw new Error(
      "Root element with id 'root' was not found. Unable to mount the React application.",
    )
  }

  createRoot(container).render(
    <StrictMode>
      <Provider store={store}>
        <DirectionProvider initialDirection={directionFor(locale)}>
          <MantineProvider
            theme={theme}
            colorSchemeManager={colorSchemeManager()}
            cssVariablesResolver={cssVariablesResolver}
            defaultColorScheme="dark"
          >
            <ModalsProvider>
              <Notifications position="top-center" />
              <GoogleAuthGate>
                <HashRouter>
                  <App importedKeyCount={importedKeyCount} />
                </HashRouter>
              </GoogleAuthGate>
            </ModalsProvider>
          </MantineProvider>
        </DirectionProvider>
      </Provider>
    </StrictMode>,
  )
}

void bootstrap()
