import { makeStore } from "@/store/store"
import { selectSyncDocumentV2 } from "@/store/syncDocument"
import {
  readSyncDocumentV2,
  SYNC_DOCUMENT_V2_KEY,
  writeSyncDocumentV2,
} from "./syncDocumentStorage"

beforeEach(() => {
  localStorage.clear()
})

const defaultDocument = () => selectSyncDocumentV2(makeStore().getState())

test("round-trips the document built from the default state", () => {
  const document = defaultDocument()

  writeSyncDocumentV2(document)

  expect(readSyncDocumentV2()).toStrictEqual(document)
})

test("returns null when nothing is stored", () => {
  expect(readSyncDocumentV2()).toBeNull()
})

test("returns null for malformed JSON", () => {
  localStorage.setItem(SYNC_DOCUMENT_V2_KEY, "{not json")

  expect(readSyncDocumentV2()).toBeNull()
})

test("returns null and warns for a document that fails validation", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
  localStorage.setItem(
    SYNC_DOCUMENT_V2_KEY,
    JSON.stringify({ ...defaultDocument(), schemaVersion: 1 }),
  )

  expect(readSyncDocumentV2()).toBeNull()
  expect(warn).toHaveBeenCalledOnce()
})
