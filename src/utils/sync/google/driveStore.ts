/**
 * Plain wrapper around the Drive REST API for the `progress.json` snapshot --
 * see docs/google-account-sync.md. No dirty check, no triggers: that policy
 * lives in `driveSync.ts`.
 *
 * `drive.appdata` scope only ever sees this app's own hidden folder, so a
 * single well-known filename is enough; no folder bookkeeping is needed.
 */
import { z } from "zod"
import { authorizedFetch, getAccessToken } from "./googleAuth"
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
const locateProgressFile = async (
  token: string,
  keepalive = false,
): Promise<DriveFile | null> => {
  const url = new URL(DRIVE_FILES_URL)
  url.searchParams.set("spaces", "appDataFolder")
  url.searchParams.set("q", `name='${PROGRESS_FILE_NAME}'`)
  url.searchParams.set("fields", "files(id,modifiedTime)")

  const response = await authorizedFetch(token, url.toString(), { keepalive })
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

/** Both public functions below run only once `useGoogleConnect.ts` has already set a token. */
const requireAccessToken = () => {
  const token = getAccessToken()
  if (!token) {
    throw new Error("No Google access token")
  }
  return token
}

/** `null` covers both "no file yet" and "file exists but is unreadable". */
export const readSnapshot = async (): Promise<SyncPayload | null> => {
  const token = requireAccessToken()
  const file = await locateProgressFile(token)
  return file ? downloadSnapshot(token, file.id) : null
}

/**
 * Drive's multipart upload is RFC 2387 `multipart/related` -- two parts
 * (JSON metadata, then media) joined by a boundary, closed with `--boundary--`.
 * That's a different wire format from the browser's `FormData`, which sends
 * `multipart/form-data` and Drive's create endpoint rejects.
 */
const buildMultipartRelatedBody = (payload: SyncPayload) => {
  const boundary = crypto.randomUUID()
  const metadata = JSON.stringify({
    name: PROGRESS_FILE_NAME,
    parents: ["appDataFolder"],
  })

  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${metadata}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${JSON.stringify(payload)}\r\n` +
    `--${boundary}--`

  return { boundary, body }
}

const createSnapshot = async (
  token: string,
  payload: SyncPayload,
  keepalive = false,
) => {
  const { boundary, body } = buildMultipartRelatedBody(payload)

  await authorizedFetch(token, `${DRIVE_UPLOAD_URL}?uploadType=multipart`, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
    keepalive,
  })
}

const updateSnapshot = async (
  token: string,
  fileId: string,
  payload: SyncPayload,
  keepalive = false,
) => {
  await authorizedFetch(
    token,
    `${DRIVE_UPLOAD_URL}/${fileId}?uploadType=media`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive,
    },
  )
}

/**
 * Overwrites whichever file `progress.json` currently resolves to, or
 * creates it. `keepalive` is set for the page-hide push, so it survives the
 * tab closing -- see "Trigger mechanics" in docs/google-account-sync.md.
 */
export const writeSnapshot = async (
  payload: SyncPayload,
  keepalive = false,
) => {
  const token = requireAccessToken()
  const file = await locateProgressFile(token, keepalive)
  if (file) {
    await updateSnapshot(token, file.id, payload, keepalive)
  } else {
    await createSnapshot(token, payload, keepalive)
  }
}
