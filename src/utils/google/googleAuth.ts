/**
 * Google sign-in for Drive sync, entirely in the browser -- see
 * docs/google-account-sync.md for the full design.
 *
 * The access token lives in memory only and is gone on reload; disconnect
 * only clears it locally, without revoking Google's consent, since
 * `useGoogleLogin`'s default `select_account` prompt already lets a user
 * switch accounts without one.
 */

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
