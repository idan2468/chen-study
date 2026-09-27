/**
 * File operations on the Drive REST API, shared by every file the app keeps in
 * Drive -- see docs/sync/google-account-sync.md.
 *
 * `drive.appdata` scope only ever sees this app's own hidden folder, so a
 * well-known filename is enough; no folder bookkeeping is needed.
 */
import { z } from "zod"
import { authorizedFetch, getAccessToken } from "./googleAuth"

const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files"
const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files"

const driveFileSchema = z.object({ id: z.string(), modifiedTime: z.string() })
type DriveFile = z.infer<typeof driveFileSchema>

const driveFilesResponseSchema = z.object({
  files: z.array(driveFileSchema).default([]),
})

/** Drive calls run only once `useGoogleConnect.ts` has already set a token. */
export const requireAccessToken = () => {
  const token = getAccessToken()
  if (!token) {
    throw new Error("No Google access token")
  }
  return token
}

/**
 * The newest `modifiedTime` wins if a failed create ever left duplicates
 * behind; the older copies are left alone (see docs/sync/google-account-sync.md).
 * @param name Exact file name in `appDataFolder`; other names (e.g. backups) never match.
 * @param keepalive Lets the request outlive a closing tab (legacy page-hide push only).
 * @returns `null` when no file has that name.
 */
export const locateAppDataFile = async (
  token: string,
  name: string,
  keepalive = false,
): Promise<DriveFile | null> => {
  const url = new URL(DRIVE_FILES_URL)
  url.searchParams.set("spaces", "appDataFolder")
  url.searchParams.set("q", `name='${name}'`)
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

export const downloadFileContent = async (
  token: string,
  fileId: string,
): Promise<string> => {
  const response = await authorizedFetch(
    token,
    `${DRIVE_FILES_URL}/${fileId}?alt=media`,
  )
  return response.text()
}

/**
 * Drive's multipart upload is RFC 2387 `multipart/related` -- two parts
 * (JSON metadata, then media) joined by a boundary, closed with `--boundary--`.
 * That's a different wire format from the browser's `FormData`, which sends
 * `multipart/form-data` and Drive's create endpoint rejects.
 */
const buildMultipartRelatedBody = (name: string, content: string) => {
  const boundary = crypto.randomUUID()
  const metadata = JSON.stringify({ name, parents: ["appDataFolder"] })

  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${metadata}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${content}\r\n` +
    `--${boundary}--`

  return { boundary, body }
}

/**
 * @param content The file body, already serialized as JSON.
 * @param keepalive Lets the request outlive a closing tab (legacy page-hide push only).
 */
export const createAppDataFile = async (
  token: string,
  name: string,
  content: string,
  keepalive = false,
) => {
  const { boundary, body } = buildMultipartRelatedBody(name, content)

  await authorizedFetch(token, `${DRIVE_UPLOAD_URL}?uploadType=multipart`, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
    keepalive,
  })
}

/**
 * Replaces the body of an existing file, keeping its ID and name.
 * @param content The new body, already serialized as JSON.
 * @param keepalive Lets the request outlive a closing tab (legacy page-hide push only).
 */
export const updateFileContent = async (
  token: string,
  fileId: string,
  content: string,
  keepalive = false,
) => {
  await authorizedFetch(
    token,
    `${DRIVE_UPLOAD_URL}/${fileId}?uploadType=media`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: content,
      keepalive,
    },
  )
}

/** Metadata-only update: the file's content is untouched. */
export const renameFile = async (
  token: string,
  fileId: string,
  name: string,
) => {
  await authorizedFetch(token, `${DRIVE_FILES_URL}/${fileId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  })
}
