import { readJson, writeJson } from "@/store/storage"
import type { SyncDocumentV2 } from "@/types/schemas/syncDocument"
import { syncDocumentV2Schema } from "@/types/schemas/syncDocument"

export const SYNC_DOCUMENT_V2_KEY = "english_progress_v2"

/** `null` when missing or invalid, so the caller falls back to legacy storage. */
export const readSyncDocumentV2 = (): SyncDocumentV2 | null => {
  const stored = readJson<unknown>(SYNC_DOCUMENT_V2_KEY, null)
  if (stored === null) {
    return null
  }
  const parsed = syncDocumentV2Schema.safeParse(stored)
  if (!parsed.success) {
    console.warn(`Ignoring invalid "${SYNC_DOCUMENT_V2_KEY}"`, parsed.error)
    return null
  }
  return parsed.data
}

export const writeSyncDocumentV2 = (document: SyncDocumentV2) => {
  writeJson(SYNC_DOCUMENT_V2_KEY, document)
}
