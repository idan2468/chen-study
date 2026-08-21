/**
 * Plain wrapper around the Drive REST API for the `progress.json` snapshot --
 * see docs/google-account-sync.md. No dirty check, no triggers: that policy
 * lives in `driveSync.ts`.
 *
 * `drive.appdata` scope only ever sees this app's own hidden folder, so a
 * single well-known filename is enough; no folder bookkeeping is needed.
 */
import { z } from "zod"
import { authorizedFetch } from "./googleAuth"
import {
  type SyncPayload,
  syncPayloadSchema,
} from "@/types/schemas/syncPayload"

const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files"
const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files"
const PROGRESS_FILE_NAME = "progress.json"

const driveFileSchema = z.object({ id: z.string(), modifiedTime: z.string() })
type DriveFile = z.infer<typeof driveFileSchema>

const driveFilesResponseSchema = z.object({
  files: z.array(driveFileSchema).default([]),
})

/**
 * The newest `modifiedTime` wins if a failed create ever left duplicates
 * behind; the older copies are left alone (see docs/google-account-sync.md).
 */
const locateProgressFile = async (token: string): Promise<DriveFile | null> => {
  const url = new URL(DRIVE_FILES_URL)
  url.searchParams.set("spaces", "appDataFolder")
  url.searchParams.set("q", `name='${PROGRESS_FILE_NAME}'`)
  url.searchParams.set("fields", "files(id,modifiedTime)")

  const response = await authorizedFetch(token, url.toString())
  const parsed = driveFilesResponseSchema.safeParse(await response.json())
  const files = parsed.success ? parsed.data.files : []

  return files.reduce<DriveFile | null>(
    (newest, file) =>
      !newest || file.modifiedTime > newest.modifiedTime ? file : newest,
    null,
  )
}

/** A malformed body is treated the same as no file at all -- see [Decisions taken](../../../../docs/google-account-sync.md#decisions-taken). */
const downloadSnapshot = async (
  token: string,
  fileId: string,
): Promise<SyncPayload | null> => {
  const response = await authorizedFetch(
    token,
    `${DRIVE_FILES_URL}/${fileId}?alt=media`,
  )
  try {
    const parsed: unknown = JSON.parse(await response.text())
    const result = syncPayloadSchema.safeParse(parsed)
    return result.success ? result.data : null
  } catch {
    return null
  }
}

/** `null` covers both "no file yet" and "file exists but is unreadable". */
export const readSnapshot = async (
  token: string,
): Promise<SyncPayload | null> => {
  const file = await locateProgressFile(token)
  return file ? downloadSnapshot(token, file.id) : null
}

const createSnapshot = async (token: string, payload: SyncPayload) => {
  const form = new FormData()
  form.append(
    "metadata",
    new Blob(
      [
        JSON.stringify({
          name: PROGRESS_FILE_NAME,
          parents: ["appDataFolder"],
        }),
      ],
      {
        type: "application/json",
      },
    ),
  )
  form.append(
    "file",
    new Blob([JSON.stringify(payload)], { type: "application/json" }),
  )
  await authorizedFetch(token, `${DRIVE_UPLOAD_URL}?uploadType=multipart`, {
    method: "POST",
    body: form,
  })
}

const updateSnapshot = async (
  token: string,
  fileId: string,
  payload: SyncPayload,
) => {
  await authorizedFetch(
    token,
    `${DRIVE_UPLOAD_URL}/${fileId}?uploadType=media`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  )
}

/** Overwrites whichever file `progress.json` currently resolves to, or creates it. */
export const writeSnapshot = async (token: string, payload: SyncPayload) => {
  const file = await locateProgressFile(token)
  if (file) {
    await updateSnapshot(token, file.id, payload)
  } else {
    await createSnapshot(token, payload)
  }
}
