import { useEffect, useRef, useState } from "react"
import { notifications } from "@mantine/notifications"
import type { TokenResponse } from "@react-oauth/google"
import { hasGrantedAllScopesGoogle, useGoogleLogin } from "@react-oauth/google"
import { useTranslation } from "react-i18next"
import { useLatest } from "@/hooks/useLatest"
import { useRehydrateFromStorage } from "@/hooks/useRehydrateFromStorage"
import { buildSyncPayload, applySyncPayload } from "@/utils/sync/syncPayload"
import {
  fetchConnectedEmail,
  getAccessToken,
  GoogleAuthError,
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
 * Connecting (by click, or silently at boot with a saved token) pulls the
 * Drive snapshot if one exists and rehydrates the running app, or pushes the
 * local snapshot if Drive has none yet. A 401 at boot triggers one silent
 * GIS re-issue before falling back to signed-out. See
 * docs/google-account-sync.md.
 *
 * @param skipBootSync - True once a `?s=` link has already imported this
 * load, so boot skips the Drive pull and leaves the next sync to push it.
 */
export const useGoogleConnect = (skipBootSync: boolean) => {
  const { t } = useTranslation()
  const rehydrate = useRehydrateFromStorage()
  const [connecting, setConnecting] = useState(() => Boolean(getAccessToken()))
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null)
  /** True only until the boot flow (including any re-issue) first settles; never set true again after that. */
  const [restoring, setRestoring] = useState(
    () => Boolean(getAccessToken()) && !skipBootSync,
  )
  /** Distinguishes a boot-triggered silent re-issue from an interactive Connect click in the shared `onSuccess`/`onError` below. */
  const bootReissueRef = useRef(false)

  const settle = () => {
    setConnecting(false)
    setRestoring(false)
  }

  const syncNow = async (token: string) => {
    const payload = await readSnapshot(token)
    if (payload) {
      applySyncPayload(payload)
      rehydrate()
    } else {
      await writeSnapshot(token, buildSyncPayload())
    }
  }

  const handleSuccess = async (
    tokenResponse: ImplicitTokenResponse,
    { skipSync = false } = {},
  ) => {
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
      if (!skipSync) {
        await syncNow(tokenResponse.access_token)
      }
    } catch {
      notifications.show({
        color: "red",
        message: t("common.googleConnectError"),
      })
    } finally {
      settle()
    }
  }

  const login = useGoogleLogin({
    scope: GOOGLE_SCOPES,
    onSuccess: tokenResponse => {
      const wasBootReissue = bootReissueRef.current
      bootReissueRef.current = false
      void handleSuccess(tokenResponse, {
        skipSync: wasBootReissue && skipBootSync,
      })
    },
    onError: () => {
      // A silent re-issue quietly falls back to signed-out rather than nagging with a toast for something the user didn't trigger.
      if (bootReissueRef.current) {
        bootReissueRef.current = false
        setAccessToken(null)
        settle()
        return
      }
      notifications.show({
        color: "red",
        message: t("common.googleConnectError"),
      })
    },
  })

  const latest = useLatest({ login, syncNow, settle })

  useEffect(() => {
    const restoreSession = async () => {
      const token = getAccessToken()
      if (!token) {
        return
      }
      try {
        setConnectedEmail(await fetchConnectedEmail(token))
        if (!skipBootSync) {
          await latest.current.syncNow(token)
        }
      } catch (error) {
        if (error instanceof GoogleAuthError) {
          bootReissueRef.current = true
          latest.current.login({ prompt: "" })
          return
        }
      } finally {
        // A re-issue in flight settles this itself, via its own onSuccess/onError.
        if (!bootReissueRef.current) {
          latest.current.settle()
        }
      }
    }
    void restoreSession()
  }, [skipBootSync, latest])

  const disconnect = () => {
    setAccessToken(null)
    setConnectedEmail(null)
  }

  const connect = () => {
    login()
  }

  return { connecting, connectedEmail, restoring, connect, disconnect }
}
