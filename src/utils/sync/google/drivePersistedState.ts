import objectHash from "object-hash"
import {
  createAppDataFile,
  downloadFileText,
  locateAppDataFile,
  renameFile,
  requireAccessToken,
  updateFileContent,
} from "./driveFiles"
import type { PersistedState } from "@/types/schemas/persistedState"
import { persistedStateSchema } from "@/types/schemas/persistedState"
import { toIsoTimestamp } from "@/utils/sync/timestamp"

const PERSISTED_STATE_FILE_NAME = "progress-v2.json"

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

export const readDrivePersistedState =
  async (): Promise<DrivePersistedState> => {
    const token = requireAccessToken()
    const file = await locateAppDataFile(token, PERSISTED_STATE_FILE_NAME)
    if (!file) {
      return { status: "missing" }
    }
    const state = parsePersistedState(await downloadFileText(token, file.id))
    return state
      ? { status: "valid", fileId: file.id, state }
      : { status: "invalid", fileId: file.id }
  }

const invalidBackupName = () =>
  `progress-v2.invalid-${toIsoTimestamp(new Date())}.json`

/**
 * Writes `state` over the Drive copy that `read` returned. Skips the upload when
 * nothing changed, and moves an invalid file aside instead of overwriting it.
 */
export const writeDrivePersistedState = async (
  read: DrivePersistedState,
  state: PersistedState,
) => {
  if (read.status === "valid" && objectHash(read.state) === objectHash(state)) {
    return
  }
  const token = requireAccessToken()
  const content = JSON.stringify(state)
  if (read.status === "valid") {
    await updateFileContent(token, read.fileId, content)
    return
  }
  if (read.status === "invalid") {
    await renameFile(token, read.fileId, invalidBackupName())
  }
  await createAppDataFile(token, PERSISTED_STATE_FILE_NAME, content)
}
