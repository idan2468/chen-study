/**
 * The one sync every trigger runs -- connect, boot, the visible-tab timer,
 * return-to-visible, and "Sync now" (see docs/sync/google-merge-sync-plan.md).
 */
import objectHash from "object-hash"
import { writeLocalPersistedState } from "@/store/persistedState"
import type { PersistedState } from "@/types/schemas/persistedState"
import { isV2Activated, migrateToV2 } from "@/utils/sync/legacy/migrateToV2"
import { mergePersistedState } from "@/utils/sync/mergePersistedState"
import type { DrivePersistedState } from "./drivePersistedState"
import {
  readDrivePersistedState,
  writeDrivePersistedState,
} from "./drivePersistedState"

const mergeWithDrive = (local: PersistedState, drive: DrivePersistedState) =>
  drive.status === "valid" ? mergePersistedState(local, drive.state) : local

/** Skips the write and reload when the merge brought nothing new, so view-only state survives. */
const applyLocallyIfChanged = (
  local: PersistedState,
  merged: PersistedState,
  reloadApp: () => void,
) => {
  if (objectHash(merged) !== objectHash(local)) {
    writeLocalPersistedState(merged)
    reloadApp()
  }
}

const syncActivatedDevice = async (
  readLocalState: () => PersistedState,
  reloadApp: () => void,
) => {
  const drive = await readDrivePersistedState()
  const local = readLocalState()
  const merged = mergeWithDrive(local, drive)
  applyLocallyIfChanged(local, merged, reloadApp)
  await writeDrivePersistedState(drive, merged)
}

const runSync = async (
  readLocalState: () => PersistedState,
  reloadApp: () => void,
) => {
  if (isV2Activated()) {
    await syncActivatedDevice(readLocalState, reloadApp)
  } else {
    await migrateToV2(true)
    reloadApp()
  }
}

let inFlight: Promise<void> | null = null

/**
 * Reads Drive, merges it with the running app's state, applies the result
 * locally, then uploads it (skipped when Drive already matches). A device
 * that hasn't activated v2 yet runs the migration instead, which resumes
 * from its checkpoint. A call made while a sync is running shares that run,
 * so overlapping triggers never both create `progress-v2.json`.
 * @param readLocalState Returns the running app's state. Called right after the Drive read, so edits made while it was in flight are merged, not lost.
 * @param reloadApp Reloads the running app from local storage; called only when local state changed.
 */
export const syncWithDrive = (
  readLocalState: () => PersistedState,
  reloadApp: () => void,
): Promise<void> => {
  inFlight ??= runSync(readLocalState, reloadApp).finally(() => {
    inFlight = null
  })
  return inFlight
}
