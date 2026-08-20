import { useEffect, useState } from "react"
import { notifications } from "@mantine/notifications"
import type { TokenResponse } from "@react-oauth/google"
import { hasGrantedAllScopesGoogle, useGoogleLogin } from "@react-oauth/google"
import { useTranslation } from "react-i18next"
import {
  fetchConnectedEmail,
  getAccessToken,
  GOOGLE_DRIVE_SCOPE,
  GOOGLE_EMAIL_SCOPE,
  GOOGLE_SCOPES,
  setAccessToken,
} from "@/utils/google/googleAuth"

type ImplicitTokenResponse = Omit<
  TokenResponse,
  "error" | "error_description" | "error_uri"
>

/**
 * Proves a token can be obtained end to end; no Drive calls yet. Reloading
 * restores the session from localStorage. Replaced by a full `AccountModal`
 * (disconnect, last-synced time, "Sync now") once `driveStore.ts`/`driveSync.ts`
 * exist -- see docs/google-account-sync.md.
 */
export const useGoogleConnect = () => {
  const { t } = useTranslation()
  const [connecting, setConnecting] = useState(() => Boolean(getAccessToken()))
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null)

  useEffect(() => {
    const restoreSession = async () => {
      const token = getAccessToken()
      if (!token) {
        return
      }
      try {
        setConnectedEmail(await fetchConnectedEmail(token))
      } catch {
        // Keep the stored token; a later boot path silently re-issues it.
      } finally {
        setConnecting(false)
      }
    }
    void restoreSession()
  }, [])

  const handleSuccess = async (tokenResponse: ImplicitTokenResponse) => {
    // Granular consent lets the user grant only some of the requested
    // scopes; without this check a partial grant would look "connected"
    // while Drive sync silently has no permission to write.
    if (
      !hasGrantedAllScopesGoogle(
        tokenResponse,
        GOOGLE_DRIVE_SCOPE,
        GOOGLE_EMAIL_SCOPE,
      )
    ) {
      notifications.show({
        color: "red",
        message: t("common.googleConnectError"),
      })
      return
    }
    setAccessToken(tokenResponse.access_token)
    setConnecting(true)
    try {
      setConnectedEmail(await fetchConnectedEmail(tokenResponse.access_token))
    } catch {
      notifications.show({
        color: "red",
        message: t("common.googleConnectError"),
      })
    } finally {
      setConnecting(false)
    }
  }

  const login = useGoogleLogin({
    scope: GOOGLE_SCOPES,
    onSuccess: tokenResponse => {
      void handleSuccess(tokenResponse)
    },
    onError: () => {
      notifications.show({
        color: "red",
        message: t("common.googleConnectError"),
      })
    },
  })

  const disconnect = () => {
    setAccessToken(null)
    setConnectedEmail(null)
  }

  const connect = () => {
    login()
  }

  return { connecting, connectedEmail, connect, disconnect }
}
