import { useEffect, useRef, useState } from "react"
import { notifications } from "@mantine/notifications"
import type { TokenResponse } from "@react-oauth/google"
import { hasGrantedAllScopesGoogle, useGoogleLogin } from "@react-oauth/google"
import { useTranslation } from "react-i18next"
import { useLatest } from "@/hooks/useLatest"
import { useRehydrateFromStorage } from "@/hooks/useRehydrateFromStorage"
import { applySyncPayload } from "@/utils/sync/syncPayload"
import {
  fetchConnectedEmail,
  getAccessToken,
  GoogleAuthError,
  GOOGLE_DRIVE_SCOPE,
  GOOGLE_EMAIL_SCOPE,
  GOOGLE_SCOPES,
  setAccessToken,
} from "@/utils/sync/google/googleAuth"
import { readSnapshot } from "@/utils/sync/google/driveStore"
import { recordSynced, syncIfDirty } from "@/utils/sync/google/driveSync"

type ImplicitTokenResponse = Omit<
  TokenResponse,
  "error" | "error_description" | "error_uri"
>

type PendingLogin =
  | { kind: "bootReissue" }
  | { kind: "syncReissue"; onSettled: (success: boolean) => void }

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
  /** `login()` has three callers sharing one `onSuccess`/`onError` pair below; this records which one is awaiting a result so the shared callback can dispatch to it. */
  const pendingLoginRef = useRef<PendingLogin | null>(null)

  const settle = () => {
    setConnecting(false)
    setRestoring(false)
  }

  const syncNow = async () => {
    const payload = await readSnapshot()
    if (payload) {
      applySyncPayload(payload)
      rehydrate()
      recordSynced(payload)
    } else {
      await syncIfDirty()
    }
  }

  /** Shared consent/token-storage/email-fetch/sync steps behind both the interactive Connect and boot-reissue scenarios below -- they differ only in `skipSync`. */
  const connectWithToken = async (
    tokenResponse: ImplicitTokenResponse,
    skipSync: boolean,
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
        await syncNow()
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

  const handleConnectResult = (tokenResponse: ImplicitTokenResponse | null) => {
    if (tokenResponse) {
      void connectWithToken(tokenResponse, false)
    } else {
      notifications.show({
        color: "red",
        message: t("common.googleConnectError"),
      })
    }
  }

  const handleBootReissueResult = (
    tokenResponse: ImplicitTokenResponse | null,
  ) => {
    if (tokenResponse) {
      void connectWithToken(tokenResponse, skipBootSync)
    } else {
      // Quietly falls back to signed-out rather than nagging with a toast for something the user didn't trigger.
      // connectedEmail may already be set if the email fetch succeeded before
      // a later Drive call 401'd -- clear it too, or the UI would still look
      // connected with no token to back it.
      setAccessToken(null)
      setConnectedEmail(null)
      settle()
    }
  }

  const handleSyncReissueResult = (
    tokenResponse: ImplicitTokenResponse | null,
    onSettled: (success: boolean) => void,
  ) => {
    if (tokenResponse) {
      setAccessToken(tokenResponse.access_token)
    }
    onSettled(Boolean(tokenResponse))
  }

  const handleLoginResult = (tokenResponse: ImplicitTokenResponse | null) => {
    const pending = pendingLoginRef.current
    pendingLoginRef.current = null
    if (pending?.kind === "syncReissue") {
      handleSyncReissueResult(tokenResponse, pending.onSettled)
    } else if (pending?.kind === "bootReissue") {
      handleBootReissueResult(tokenResponse)
    } else {
      handleConnectResult(tokenResponse)
    }
  }

  const login = useGoogleLogin({
    scope: GOOGLE_SCOPES,
    onSuccess: tokenResponse => {
      handleLoginResult(tokenResponse)
    },
    onError: () => {
      handleLoginResult(null)
    },
    // GIS's token client always opens a popup, even for a silent `prompt:
    // "none"` re-issue -- a popup/ad blocker can block it outright, which
    // fires neither onSuccess nor onError and would hang forever without
    // this (e.g. the boot restore spinner stuck until the blocker is off).
    onNonOAuthError: () => {
      handleLoginResult(null)
    },
  })

  /** A silent GIS re-issue for `useDriveSync.ts`'s mid-session 401s -- only refreshes the token, never pulls, since only Connect and boot may (see docs/google-account-sync.md). */
  const reissueForSync = (onSettled: (success: boolean) => void) => {
    pendingLoginRef.current = { kind: "syncReissue", onSettled }
    login({ prompt: "none" })
  }

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
          await latest.current.syncNow()
        }
      } catch (error) {
        if (error instanceof GoogleAuthError) {
          pendingLoginRef.current = { kind: "bootReissue" }
          latest.current.login({ prompt: "none" })
          return
        }
      } finally {
        // A re-issue in flight settles this itself, via its own onSuccess/onError.
        if (!pendingLoginRef.current) {
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

  return {
    connecting,
    connectedEmail,
    restoring,
    connect,
    disconnect,
    reissueForSync,
  }
}
