import type { ReactNode } from "react"
import { createContext, use } from "react"
import { Center, Loader } from "@mantine/core"
import { useTranslation } from "react-i18next"
import { useDriveSync } from "@/hooks/useDriveSync"
import { useGoogleConnect } from "@/hooks/useGoogleConnect"

type GoogleConnectValue = ReturnType<typeof useGoogleConnect> &
  Pick<
    ReturnType<typeof useDriveSync>,
    "needsReconnect" | "syncing" | "syncNow"
  >

const GoogleConnectContext = createContext<GoogleConnectValue | null>(null)

export type GoogleConnectProviderProps = {
  skipBootSync: boolean
  children: ReactNode
}

/**
 * Owns the single `useGoogleConnect` instance for the whole app, shared by
 * the boot-time restore and `TopBar`'s Connect button. Renders a full-page
 * spinner in place of `children` until that restore settles, so a returning
 * user doesn't see local state flash before the Drive pull replaces it.
 */
export const GoogleConnectProvider = ({
  skipBootSync,
  children,
}: GoogleConnectProviderProps) => {
  const { t } = useTranslation()
  const googleConnect = useGoogleConnect(skipBootSync)
  const { needsReconnect, syncing, syncNow } = useDriveSync(
    Boolean(googleConnect.connectedEmail),
    googleConnect.reissueForSync,
  )

  if (googleConnect.restoring) {
    return (
      <Center h="100vh">
        <Loader aria-label={t("common.restoringSync")} />
      </Center>
    )
  }

  return (
    <GoogleConnectContext
      value={{ ...googleConnect, needsReconnect, syncing, syncNow }}
    >
      {children}
    </GoogleConnectContext>
  )
}

export const useGoogleConnectContext = () => {
  const value = use(GoogleConnectContext)
  if (!value) {
    throw new Error(
      "useGoogleConnectContext must be used within a GoogleConnectProvider",
    )
  }
  return value
}
