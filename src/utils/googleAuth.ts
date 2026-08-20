/**
 * Google sign-in for Drive sync, entirely in the browser.
 *
 * Token acquisition itself is `@react-oauth/google`'s `useGoogleLogin` hook
 * (see `TopBar.tsx`), which wraps Google Identity Services' token client --
 * the implicit-style flow that never issues a refresh token, see
 * `docs/google-account-sync.md#why-there-is-no-refresh-token` for why that is
 * unavoidable without a backend. The access token it resolves lives in
 * memory only (via `setAccessToken` below) and is gone on reload; callers
 * are expected to trigger `login()` again (with `prompt: ""`) to renew it
 * silently.
 *
 * Two things the library doesn't cover, so they stay here: revoking the
 * token on disconnect (no wrapper for `google.accounts.oauth2.revoke`), and
 * looking up the connected email (the implicit flow only returns an access
 * token, not identity claims).
 */

declare global {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- augmenting the global Window requires an interface for declaration merging
  interface Window {
    google?: {
      accounts: {
        oauth2: { revoke: (token: string, callback: () => void) => void }
      }
    }
  }
}

const USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"

export const GOOGLE_DRIVE_SCOPE =
  "https://www.googleapis.com/auth/drive.appdata"
export const GOOGLE_EMAIL_SCOPE =
  "https://www.googleapis.com/auth/userinfo.email"
export const GOOGLE_SCOPES = `${GOOGLE_DRIVE_SCOPE} ${GOOGLE_EMAIL_SCOPE}`

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

/** Whether Drive sync can be offered at all -- false with no client ID configured. */
export const isGoogleSyncAvailable = () => Boolean(GOOGLE_CLIENT_ID)

let accessToken: string | null = null

export const getAccessToken = () => accessToken
export const setAccessToken = (token: string | null) => {
  accessToken = token
}

export const signOut = () => {
  if (accessToken) {
    window.google?.accounts.oauth2.revoke(accessToken, () => undefined)
  }
  accessToken = null
}

/** Requires the `userinfo.email` scope, requested alongside `drive.appdata`. */
export const fetchConnectedEmail = async (token: string): Promise<string> => {
  const response = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) {
    throw new Error(`userinfo request failed: ${String(response.status)}`)
  }
  const data: unknown = await response.json()
  const email =
    typeof data === "object" && data !== null && "email" in data
      ? data.email
      : undefined
  if (typeof email !== "string") {
    throw new Error("userinfo response did not include an email")
  }
  return email
}
