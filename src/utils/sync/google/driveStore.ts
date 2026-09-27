/**
 * The legacy `progress.json` snapshot in Drive -- see
 * docs/sync/google-account-sync.md. No dirty check, no triggers: that policy
 * lives in `driveSync.ts`.
 */
import {
  createAppDataFile,
  downloadFileContent,
  locateAppDataFile,
  requireAccessToken,
  updateFileContent,
} from "./driveFiles"
import {
  type SyncPayload,
  syncPayloadSchema,
} from "@/utils/sync/legacy/legacyStorage"

const PROGRESS_FILE_NAME = "progress.json"

/** A malformed body is treated the same as no file at all -- see [Decisions taken](../../../../docs/sync/google-account-sync.md#decisions-taken). */
const parseSnapshot = (text: string): SyncPayload | null => {
  try {
    const parsed: unknown = JSON.parse(text)
    const result = syncPayloadSchema.safeParse(parsed)
    return result.success ? result.data : null
  } catch {
    return null
  }
}

/** `null` covers both "no file yet" and "file exists but is unreadable". */
export const readSnapshot = async (): Promise<SyncPayload | null> => {
  const token = requireAccessToken()
  const file = await locateAppDataFile(token, PROGRESS_FILE_NAME)
  return file ? parseSnapshot(await downloadFileContent(token, file.id)) : null
}

/**
 * Overwrites whichever file `progress.json` currently resolves to, or
 * creates it. `keepalive` is set for the page-hide push, so it survives the
 * tab closing -- see "Trigger mechanics" in docs/sync/google-account-sync.md.
 */
export const writeSnapshot = async (
  payload: SyncPayload,
  keepalive = false,
) => {
  const token = requireAccessToken()
  const file = await locateAppDataFile(token, PROGRESS_FILE_NAME, keepalive)
  const content = JSON.stringify(payload)
  if (file) {
    await updateFileContent(token, file.id, content, keepalive)
  } else {
    await createAppDataFile(token, PROGRESS_FILE_NAME, content, keepalive)
  }
}
