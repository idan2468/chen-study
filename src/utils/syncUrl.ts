/**
 * "Send my progress to another device" links.
 *
 * Replaces `getSyncPayload`, `generateSyncURL` and `checkURLSync`, which were
 * duplicated verbatim in both original HTML files. The payload is the raw
 * localStorage key/value pairs, which is why `src/utils/storageKeys.ts` must
 * keep those key names stable.
 */
import { isSyncableKey } from "./storageKeys"
import { listKeys, readString } from "@/store/storage"

export type SyncPayload = Record<string, string>

/** New links use `?sync=`; `#sync=` is the legacy form (see `parseSyncUrl`). */
const SYNC_PARAM = "sync"

export const buildSyncPayload = (): SyncPayload => {
  const payload: SyncPayload = {}
  for (const key of listKeys()) {
    if (isSyncableKey(key)) {
      payload[key] = readString(key)
    }
  }
  return payload
}

export const encodeSyncPayload = (payload: SyncPayload) =>
  btoa(encodeURIComponent(JSON.stringify(payload)))

export const decodeSyncPayload = (encoded: string): SyncPayload | null => {
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(atob(encoded)))
    if (typeof parsed !== "object" || parsed === null) {
      return null
    }
    // Only carry string values; anything else is not a localStorage entry.
    const payload: SyncPayload = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string") {
        payload[key] = value
      }
    }
    return payload
  } catch {
    return null
  }
}

export const buildSyncUrl = () => {
  const { origin, pathname } = window.location
  return `${origin}${pathname}?${SYNC_PARAM}=${encodeSyncPayload(buildSyncPayload())}`
}

/**
 * Pulls the payload out of a URL.
 *
 * Accepts both `?sync=` (current) and `#sync=` (links shared by the original
 * HTML apps). The hash form has to be handled specially because the app now
 * uses `HashRouter`, so `#` is a route.
 */
export const parseSyncUrl = (href: string): SyncPayload | null => {
  let url: URL
  try {
    url = new URL(href)
  } catch {
    return null
  }

  const fromQuery = url.searchParams.get(SYNC_PARAM)
  if (fromQuery) {
    return decodeSyncPayload(fromQuery)
  }

  // Legacy: `#sync=<base64>`, which HashRouter would otherwise read as a route.
  const hash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash
  if (hash.startsWith(`${SYNC_PARAM}=`)) {
    return decodeSyncPayload(hash.slice(SYNC_PARAM.length + 1))
  }

  return null
}

/** Writes an imported payload straight into localStorage. Returns the count. */
export const applySyncPayload = (payload: SyncPayload) => {
  let applied = 0
  for (const [key, value] of Object.entries(payload)) {
    try {
      window.localStorage.setItem(key, value)
      applied += 1
    } catch (error) {
      console.warn(`Could not import "${key}"`, error)
    }
  }
  return applied
}

/**
 * Runs before the store is created and before React mounts, so the slices
 * hydrate from the imported data rather than the device's own. Strips the
 * parameter from the URL afterwards so a refresh does not re-import.
 *
 * @returns how many keys were imported, or `null` if the URL had no payload.
 */
export const importSyncFromUrl = (): number | null => {
  const payload = parseSyncUrl(window.location.href)
  if (!payload) {
    return null
  }

  const applied = applySyncPayload(payload)
  window.history.replaceState(
    null,
    "",
    `${window.location.origin}${window.location.pathname}`,
  )
  return applied
}
