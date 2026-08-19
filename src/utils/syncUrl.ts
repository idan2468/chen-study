/**
 * "Send my progress to another device" links.
 *
 * Replaces `getSyncPayload`, `generateSyncURL` and `checkURLSync`, which were
 * duplicated verbatim in both original HTML files. The payload is the raw
 * localStorage key/value pairs, which is why `src/utils/storageKeys.ts` must
 * keep those key names stable.
 *
 * The payload is gzipped before it is base64'd. Earlier builds instead ran
 * `encodeURIComponent` before `btoa`, which turned every Hebrew letter into
 * `%D7%9E` and inflated a 5 KB snapshot into a 14,000-character link. Their
 * links can no longer be decoded, hence the parameter rename from `sync`: an old
 * link is now ignored outright rather than failing halfway through an import.
 */
import { isSyncableKey } from "./storageKeys"
import { listKeys, readString } from "@/store/storage"

export type SyncPayload = Record<string, string>

const SYNC_PARAM = "s"

export const buildSyncPayload = (): SyncPayload => {
  const payload: SyncPayload = {}
  for (const key of listKeys()) {
    if (isSyncableKey(key)) {
      payload[key] = readString(key)
    }
  }
  return payload
}

/** `+`, `/` and `=` all need escaping in a query string; base64url does not. */
const toBase64Url = (bytes: Uint8Array) => {
  let binary = ""
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

const fromBase64Url = (encoded: string) => {
  const binary = atob(encoded.replace(/-/g, "+").replace(/_/g, "/"))
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

/** `Response` is the terse way to collect a stream back into a buffer. */
const pipeBytes = async (
  bytes: Uint8Array<ArrayBuffer>,
  transform: TransformStream<BufferSource, Uint8Array>,
) => {
  const source = new ReadableStream<BufferSource>({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    },
  })
  return new Uint8Array(
    await new Response(source.pipeThrough(transform)).arrayBuffer(),
  )
}

export const encodeSyncPayload = async (payload: SyncPayload) => {
  const json = new TextEncoder().encode(JSON.stringify(payload))
  return toBase64Url(await pipeBytes(json, new CompressionStream("gzip")))
}

export const decodeSyncPayload = async (
  encoded: string,
): Promise<SyncPayload | null> => {
  try {
    const bytes = await pipeBytes(
      fromBase64Url(encoded),
      new DecompressionStream("gzip"),
    )
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes))
    if (typeof parsed !== "object" || parsed === null) {
      return null
    }
    // Only carry string values; anything else is not a localStorage entry.
    const payload: SyncPayload = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string") {
        payload[key] = value
      }
    }
    return payload
  } catch {
    return null
  }
}

export const buildSyncUrl = async () => {
  const { origin, pathname } = window.location
  const encoded = await encodeSyncPayload(buildSyncPayload())
  return `${origin}${pathname}?${SYNC_PARAM}=${encoded}`
}

/** Pulls the payload out of a URL. */
export const parseSyncUrl = async (
  href: string,
): Promise<SyncPayload | null> => {
  let url: URL
  try {
    url = new URL(href)
  } catch {
    return null
  }

  const encoded = url.searchParams.get(SYNC_PARAM)
  return encoded ? decodeSyncPayload(encoded) : null
}

/** Writes an imported payload straight into localStorage. Returns the count. */
export const applySyncPayload = (payload: SyncPayload) => {
  let applied = 0
  for (const [key, value] of Object.entries(payload)) {
    try {
      window.localStorage.setItem(key, value)
      applied += 1
    } catch (error) {
      console.warn(`Could not import "${key}"`, error)
    }
  }
  return applied
}

/**
 * Runs before the store is created and before React mounts, so the slices
 * hydrate from the imported data rather than the device's own. Strips the
 * parameter from the URL afterwards so a refresh does not re-import.
 *
 * @returns how many keys were imported, or `null` if the URL had no payload.
 */
export const importSyncFromUrl = async (): Promise<number | null> => {
  const payload = await parseSyncUrl(window.location.href)
  if (!payload) {
    return null
  }

  const applied = applySyncPayload(payload)
  window.history.replaceState(
    null,
    "",
    `${window.location.origin}${window.location.pathname}`,
  )
  return applied
}
