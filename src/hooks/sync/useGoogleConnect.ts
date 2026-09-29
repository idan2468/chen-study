import { useEffect, useRef, useState } from "react"
import type { TokenResponse } from "@react-oauth/google"
import { hasGrantedAllScopesGoogle, useGoogleLogin } from "@react-oauth/google"
import { useTranslation } from "react-i18next"
import { useLatest } from "@/hooks/useLatest"
import { useSyncWithDrive } from "@/hooks/sync/useSyncWithDrive"
import { notifyErrorWithDebugInfo } from "@/utils/notifications.tsx"
import type { ConnectFailureStage } from "@/utils/sync/google/connectDebugInfo"
import { buildConnectDebugInfo } from "@/utils/sync/google/connectDebugInfo"
import {
  fetchConnectedEmail,
  getAccessToken,
  GoogleAuthError,
  GOOGLE_DRIVE_SCOPE,
  GOOGLE_EMAIL_SCOPE,
  GOOGLE_SCOPES,
  setAccessToken,
} from "@/utils/sync/google/googleAuth"

type ImplicitTokenResponse = Omit<
  TokenResponse,
  "error" | "error_description" | "error_uri"
>

type PendingLogin =
  | { kind: "bootReissue" }
  | { kind: "syncReissue"; onSettled: (success: boolean) => void }

/**
 * Connecting (by click, or silently at boot with a saved token) runs a full
 * `syncWithDrive`: merging with Drive and rehydrating the running app. A 401 at boot triggers one silent
 * GIS re-issue before falling back to signed-out. See
 * docs/sync/google-account-sync.md.
 */
export const useGoogleConnect = () => {
  const { t } = useTranslation()
  const syncNow = useSyncWithDrive()
  const [connecting, setConnecting] = useState(() => Boolean(getAccessToken()))
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null)
  /** True only until the boot flow (including any re-issue) first settles; never set true again after that. */
  const [restoring, setRestoring] = useState(() => Boolean(getAccessToken()))
  /** `login()` has three callers sharing one `onSuccess`/`onError` pair below; this records which one is awaiting a result so the shared callback can dispatch to it. */
  const pendingLoginRef = useRef<PendingLogin | null>(null)

  const settle = () => {
    setConnecting(false)
    setRestoring(false)
  }

  const notifyConnectFailure = (
    stage: ConnectFailureStage,
    detail: unknown,
    message: string = t("common.googleConnectError"),
  ) => {
    notifyErrorWithDebugInfo(message, buildConnectDebugInfo(stage, detail))
  }

  const connectWithToken = async (tokenResponse: ImplicitTokenResponse) => {
    // Granular consent lets the user grant only some scopes; without this
    // check a partial grant would look "connected" but can't write to Drive.
    if (
      !hasGrantedAllScopesGoogle(
        tokenResponse,
        GOOGLE_DRIVE_SCOPE,
        GOOGLE_EMAIL_SCOPE,
      )
    ) {
      notifyConnectFailure("scopesNotGranted", {
        grantedScopes: tokenResponse.scope,
      })
      return
    }
    setAccessToken(tokenResponse.access_token)
    setConnecting(true)
    try {
      setConnectedEmail(await fetchConnectedEmail(tokenResponse.access_token))
      await syncNow()
    } catch (error) {
      notifyConnectFailure("connect", error)
    } finally {
      settle()
    }
  }

  const handleConnectResult = (
    tokenResponse: ImplicitTokenResponse | null,
    loginError: unknown,
  ) => {
    if (tokenResponse) {
      void connectWithToken(tokenResponse)
    } else {
      notifyConnectFailure("login", loginError)
    }
  }

  const handleBootReissueResult = (
    tokenResponse: ImplicitTokenResponse | null,
    loginError: unknown,
  ) => {
    if (tokenResponse) {
      void connectWithToken(tokenResponse)
    } else {
      // Falls back to signed-out. Also clears connectedEmail in case the
      // email fetch had already succeeded before the Drive call 401'd. A
      // toast surfaces this even though the user didn't trigger it directly
      // -- otherwise sync silently stops until they notice the Google
      // button looks disconnected.
      setAccessToken(null)
      setConnectedEmail(null)
      notifyConnectFailure(
        "bootReissue",
        loginError,
        t("common.googleReconnectNeeded"),
      )
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

  /** @param loginError GIS's error response when there's no token, for the debug info. */
  const handleLoginResult = (
    tokenResponse: ImplicitTokenResponse | null,
    loginError?: unknown,
  ) => {
    const pending = pendingLoginRef.current
    pendingLoginRef.current = null
    if (pending?.kind === "syncReissue") {
      handleSyncReissueResult(tokenResponse, pending.onSettled)
    } else if (pending?.kind === "bootReissue") {
      handleBootReissueResult(tokenResponse, loginError)
    } else {
      handleConnectResult(tokenResponse, loginError)
    }
  }

  const login = useGoogleLogin({
    scope: GOOGLE_SCOPES,
    onSuccess: tokenResponse => {
      handleLoginResult(tokenResponse)
    },
    onError: errorResponse => {
      handleLoginResult(null, errorResponse)
    },
    // GIS's popup can get blocked outright, firing neither onSuccess nor
    // onError -- without this, that hangs forever instead of failing.
    onNonOAuthError: nonOAuthError => {
      handleLoginResult(null, nonOAuthError)
    },
  })

  /** A silent GIS re-issue for `useDriveSync.ts`'s mid-session 401s -- only refreshes the token; `useDriveSync` then retries its own sync. */
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
        await latest.current.syncNow()
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
  }, [latest])

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
