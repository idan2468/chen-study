import { useEffect, useState } from "react"
import { notifications } from "@mantine/notifications"
import type { TokenResponse } from "@react-oauth/google"
import { hasGrantedAllScopesGoogle, useGoogleLogin } from "@react-oauth/google"
import { useTranslation } from "react-i18next"
import { useRehydrateFromStorage } from "@/hooks/useRehydrateFromStorage"
import { buildSyncPayload, applySyncPayload } from "@/utils/sync/syncPayload"
import {
  fetchConnectedEmail,
  getAccessToken,
  GOOGLE_DRIVE_SCOPE,
  GOOGLE_EMAIL_SCOPE,
  GOOGLE_SCOPES,
  setAccessToken,
} from "@/utils/sync/google/googleAuth"
import { readSnapshot, writeSnapshot } from "@/utils/sync/google/driveStore"

type ImplicitTokenResponse = Omit<
  TokenResponse,
  "error" | "error_description" | "error_uri"
>

/**
 * Connecting pulls the Drive snapshot if one exists, applying it and
 * rehydrating the running app, or pushes the local snapshot if Drive has
 * none yet -- a first-sync-only pull-or-push, with no dirty check (that
 * policy lives in the still-to-come `driveSync.ts`). Reloading restores the
 * session from localStorage; boot-time sync is wired in a later commit. See
 * docs/google-account-sync.md.
 */
export const useGoogleConnect = () => {
  const { t } = useTranslation()
  const rehydrate = useRehydrateFromStorage()
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

  const syncNow = async (token: string) => {
    const payload = await readSnapshot(token)
    if (payload) {
      applySyncPayload(payload)
      rehydrate()
    } else {
      await writeSnapshot(token, buildSyncPayload())
    }
  }

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
      await syncNow(tokenResponse.access_token)
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
