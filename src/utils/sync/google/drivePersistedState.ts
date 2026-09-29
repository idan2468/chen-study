import objectHash from "object-hash"
import {
  createAppDataFile,
  downloadFileContent,
  locateAppDataFile,
  renameFile,
  requireAccessToken,
  updateFileContent,
} from "@/utils/sync/google/driveFiles"
import type { PersistedState } from "@/types/schemas/persistedState"
import { persistedStateSchema } from "@/types/schemas/persistedState"
import { toIsoTimestamp } from "@/utils/sync/timestamp"

const PERSISTED_STATE_FILE_BASE = "progress-v2"
const PERSISTED_STATE_FILE_NAME = `${PERSISTED_STATE_FILE_BASE}.json`

export type DrivePersistedState =
  | { status: "missing" }
  | { status: "invalid"; fileId: string }
  | { status: "valid"; fileId: string; state: PersistedState }

const parsePersistedState = (text: string): PersistedState | null => {
  try {
    const result = persistedStateSchema.safeParse(JSON.parse(text))
    return result.success ? result.data : null
  } catch {
    return null
  }
}

/** A failed request or missing token throws; an unreadable file is reported as `invalid`, not thrown. */
export const readDrivePersistedState =
  async (): Promise<DrivePersistedState> => {
    const token = requireAccessToken()
    const file = await locateAppDataFile(token, PERSISTED_STATE_FILE_NAME)
    if (!file) {
      return { status: "missing" }
    }
    const state = parsePersistedState(await downloadFileContent(token, file.id))
    return state
      ? { status: "valid", fileId: file.id, state }
      : { status: "invalid", fileId: file.id }
  }

const invalidBackupName = () =>
  `${PERSISTED_STATE_FILE_BASE}.invalid-${toIsoTimestamp(new Date())}.json.bck`

/**
 * Writes `state` over the Drive copy that `read` returned. Skips the upload when
 * nothing changed, and moves an invalid file aside instead of overwriting it.
 * @param read This sync's `readDrivePersistedState()` result; decides whether to update, create, or back up first.
 * @param state The full state to upload, usually the merge of local and `read.state`.
 */
export const writeDrivePersistedState = async (
  read: DrivePersistedState,
  state: PersistedState,
) => {
  const content = JSON.stringify(state)
  switch (read.status) {
    case "valid":
      if (objectHash(read.state) !== objectHash(state)) {
        await updateFileContent(requireAccessToken(), read.fileId, content)
      }
      return
    case "invalid": {
      const token = requireAccessToken()
      await renameFile(token, read.fileId, invalidBackupName())
      await createAppDataFile(token, PERSISTED_STATE_FILE_NAME, content)
      return
    }
    case "missing":
      await createAppDataFile(
        requireAccessToken(),
        PERSISTED_STATE_FILE_NAME,
        content,
      )
  }
}
