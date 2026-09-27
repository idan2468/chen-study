/**
 * The one sync every trigger runs -- connect, boot, the visible-tab timer,
 * return-to-visible, and "Sync now" (see docs/sync/google-merge-sync-plan.md).
 */
import objectHash from "object-hash"
import { writeLocalPersistedState } from "@/store/persistedState"
import type { PersistedState } from "@/types/schemas/persistedState"
import { isV2Activated, migrateToV2 } from "@/utils/sync/legacy/migrateToV2"
import { mergePersistedState } from "@/utils/sync/mergePersistedState"
import {
  readDrivePersistedState,
  writeDrivePersistedState,
} from "./drivePersistedState"

/**
 * Reads Drive, merges it with the running app's state, applies the result
 * locally, then uploads it (skipped when Drive already matches). A device
 * that hasn't activated v2 yet runs the migration instead, which resumes
 * from its checkpoint.
 * @param readLocalState Returns the running app's state. Called right after the Drive read, so edits made while it was in flight are merged, not lost.
 * @param reloadApp Reloads the running app from local storage; called only when local state changed.
 */
export const syncWithDrive = async (
  readLocalState: () => PersistedState,
  reloadApp: () => void,
) => {
  if (!isV2Activated()) {
    await migrateToV2(true)
    reloadApp()
    return
  }
  const drive = await readDrivePersistedState()
  const local = readLocalState()
  const merged =
    drive.status === "valid" ? mergePersistedState(local, drive.state) : local
  if (objectHash(merged) !== objectHash(local)) {
    writeLocalPersistedState(merged)
    reloadApp()
  }
  await writeDrivePersistedState(drive, merged)
}
