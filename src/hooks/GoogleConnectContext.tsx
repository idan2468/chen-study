import type { ReactNode } from "react"
import { createContext, use } from "react"
import { Center, Loader } from "@mantine/core"
import { useTranslation } from "react-i18next"
import { useGoogleConnect } from "@/hooks/useGoogleConnect"

type GoogleConnectValue = ReturnType<typeof useGoogleConnect>

const GoogleConnectContext = createContext<GoogleConnectValue | null>(null)

export type GoogleConnectProviderProps = {
  skipBootSync: boolean
  children: ReactNode
}

/**
 * Owns the single `useGoogleConnect` instance for the whole app, so both the
 * boot-time restore and `TopBar`'s Connect button share one state instead of
 * each triggering their own GIS calls. Renders a full-page spinner in place
 * of `children` until that boot restore (including any silent re-issue)
 * settles, so a returning connected user doesn't see local state flash
 * before the Drive pull replaces it.
 */
export const GoogleConnectProvider = ({
  skipBootSync,
  children,
}: GoogleConnectProviderProps) => {
  const { t } = useTranslation()
  const value = useGoogleConnect(skipBootSync)

  if (value.restoring) {
    return (
      <Center h="100vh">
        <Loader aria-label={t("common.restoringSync")} />
      </Center>
    )
  }

  return <GoogleConnectContext value={value}>{children}</GoogleConnectContext>
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
