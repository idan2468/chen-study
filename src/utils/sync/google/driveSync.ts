/**
 * The dirty-check policy on top of `driveStore.ts` -- see
 * "The dirty check" in docs/google-account-sync.md. An idle device re-hashes
 * localStorage every tick instead of always re-pushing it, so it can't
 * clobber a device that's actively syncing.
 */
import objectHash from "object-hash"
import { writeSnapshot } from "./driveStore"
import type { SyncPayload } from "@/types/schemas/syncPayload"
import { readString, writeString } from "@/store/storage"
import { StorageKeys } from "@/utils/sync/storageKeys"
import { buildSyncPayload } from "@/utils/sync/syncPayload"

/**
 * object-hash sorts object keys by default, so localStorage's key order can't
 * change the result. Only needs to detect "did anything change", not resist
 * tampering.
 */
const hashPayload = (payload: SyncPayload): string => objectHash(payload)

/** Marks `payload` as the current Drive state, so a later dirty check treats it as clean. */
export const recordSynced = (payload: SyncPayload) => {
  writeString(StorageKeys.googleLastSyncedHash, hashPayload(payload))
}

/**
 * Pushes the local snapshot to Drive only if it differs from the last
 * successful sync. A failed push does not record the new hash, so the next
 * call retries instead of silently giving up. `keepalive` is set for the
 * page-hide trigger only -- see "Trigger mechanics" in
 * docs/google-account-sync.md.
 */
export const syncIfDirty = async (keepalive = false) => {
  const payload = buildSyncPayload()
  const hash = hashPayload(payload)
  if (hash === readString(StorageKeys.googleLastSyncedHash)) {
    return
  }
  await writeSnapshot(payload, keepalive)
  recordSynced(payload)
}
