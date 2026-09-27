/**
 * Reads the legacy `progress.json` snapshot in Drive, which only the v2
 * migration still pulls -- see docs/sync/google-account-sync.md.
 */
import {
  downloadFileContent,
  locateAppDataFile,
  requireAccessToken,
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
