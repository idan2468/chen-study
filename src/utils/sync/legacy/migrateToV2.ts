import {
  readLocalPersistedState,
  selectPersistedState,
  writeLocalPersistedState,
} from "@/store/persistedState"
import { listKeys, readFlag, removeKey, writeFlag } from "@/store/storage"
import { makeStore } from "@/store/store"
import type { PersistedState } from "@/types/schemas/persistedState"
import {
  readDrivePersistedState,
  writeDrivePersistedState,
} from "@/utils/sync/google/drivePersistedState"
import { readSnapshot } from "@/utils/sync/google/driveStore"
import {
  applySyncPayload,
  isLegacyDataKey,
} from "@/utils/sync/legacy/legacyStorage"
import { mergePersistedState } from "@/utils/sync/mergePersistedState"

/** Device-local; not `english_`-prefixed, so the legacy payload never syncs it. */
const V2_ACTIVATED_KEY = "sync_v2_activated"

export const isV2Activated = () => readFlag(V2_ACTIVATED_KEY, false)

const pullLegacySnapshot = async () => {
  const payload = await readSnapshot()
  if (payload) {
    applySyncPayload(payload)
  }
}

/** The slices' initializers read the legacy keys, so a fresh store is the conversion. */
const convertLegacyState = (): PersistedState =>
  selectPersistedState(makeStore().getState())

const deleteLegacyData = () => {
  for (const key of listKeys()) {
    if (isLegacyDataKey(key)) {
      removeKey(key)
    }
  }
}

/** Local v2 is written before Drive, so a retry resumes from it instead of converting again. */
const migrateWithDrive = async () => {
  const drive = await readDrivePersistedState()
  const hasDriveV2 = drive.status === "valid"
  let local = readLocalPersistedState()
  if (!local) {
    if (!hasDriveV2) {
      await pullLegacySnapshot()
    }
    local = convertLegacyState()
  }
  const state = hasDriveV2 ? mergePersistedState(local, drive.state) : local
  writeLocalPersistedState(state)
  await writeDrivePersistedState(drive, state)
}

const migrateLocally = () => {
  writeLocalPersistedState(readLocalPersistedState() ?? convertLegacyState())
}

/**
 * Moves this device onto the v2 persisted state; safe to rerun after any
 * failure. Activation is marked only once every write succeeded, and legacy
 * data is deleted only after activation.
 */
export const migrateToV2 = async (connected: boolean) => {
  if (!isV2Activated()) {
    if (connected) {
      await migrateWithDrive()
    } else {
      migrateLocally()
    }
    writeFlag(V2_ACTIVATED_KEY, true)
  }
  deleteLegacyData()
}
