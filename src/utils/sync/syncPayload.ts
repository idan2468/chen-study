/**
 * The localStorage snapshot shared between `?s=` links (`syncUrl.ts`) and
 * Drive sync (`google/driveStore.ts`) -- see docs/google-account-sync.md.
 */
import { isSyncableKey } from "./storageKeys"
import { listKeys, readString } from "@/store/storage"
import type { SyncPayload } from "@/types/schemas/syncPayload"

export const buildSyncPayload = (): SyncPayload => {
  const payload: SyncPayload = {}
  for (const key of listKeys()) {
    if (isSyncableKey(key)) {
      payload[key] = readString(key)
    }
  }
  return payload
}

/**
 * Writes an imported payload straight into localStorage. Returns the count.
 *
 * Only ever writes syncable keys -- a `?s=` link or Drive file is untrusted
 * input, and without this check a crafted payload could overwrite a
 * device-local value like the Google access token, redirecting this
 * device's Drive sync to an attacker's account.
 */
export const applySyncPayload = (payload: SyncPayload) => {
  let applied = 0
  for (const [key, value] of Object.entries(payload)) {
    if (!isSyncableKey(key)) {
      continue
    }
    try {
      window.localStorage.setItem(key, value)
      applied += 1
    } catch (error) {
      console.warn(`Could not import "${key}"`, error)
    }
  }
  return applied
}
