/**
 * Google sign-in for Drive sync, entirely in the browser -- see
 * docs/google-account-sync.md for the full design.
 *
 * The access token is kept in localStorage so a reload stays connected.
 * Disconnect only clears it locally, without revoking Google's consent, since
 * `useGoogleLogin`'s default `select_account` prompt already lets a user
 * switch accounts without one.
 */

import { readString, removeKey, writeString } from "@/store/storage"
import { StorageKeys } from "@/utils/sync/storageKeys"

const USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"

export const GOOGLE_DRIVE_SCOPE =
  "https://www.googleapis.com/auth/drive.appdata"
export const GOOGLE_EMAIL_SCOPE =
  "https://www.googleapis.com/auth/userinfo.email"
export const GOOGLE_SCOPES = `${GOOGLE_DRIVE_SCOPE} ${GOOGLE_EMAIL_SCOPE}`

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

/** Whether Drive sync can be offered at all -- false with no client ID configured. */
export const isGoogleSyncAvailable = () => Boolean(GOOGLE_CLIENT_ID)

/**
 * Thrown for a 401 specifically, so callers (userinfo, Drive) can tell "token
 * needs a silent re-issue" apart from a real failure (offline, quota, 5xx)
 * worth surfacing.
 */
export class GoogleAuthError extends Error {
  constructor() {
    super("Google request failed: token expired or revoked")
  }
}

/** Attaches the bearer token to any Google API call; shared by `fetchConnectedEmail` and `driveStore.ts`. */
export const authorizedFetch = async (
  token: string,
  url: string,
  init: RequestInit = {},
): Promise<Response> => {
  const headers = new Headers(init.headers)
  headers.set("Authorization", `Bearer ${token}`)
  const response = await fetch(url, { ...init, headers })
  if (response.status === 401) {
    throw new GoogleAuthError()
  }
  if (!response.ok) {
    throw new Error(`Google API request failed: ${String(response.status)}`)
  }
  return response
}

export const getAccessToken = () => {
  const stored = readString(StorageKeys.googleAccessToken, "")
  return stored === "" ? null : stored
}

export const setAccessToken = (token: string | null) => {
  if (token) {
    writeString(StorageKeys.googleAccessToken, token)
  } else {
    removeKey(StorageKeys.googleAccessToken)
  }
}

/** Requires the `userinfo.email` scope, requested alongside `drive.appdata`. */
export const fetchConnectedEmail = async (token: string): Promise<string> => {
  const response = await authorizedFetch(token, USERINFO_URL)
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
