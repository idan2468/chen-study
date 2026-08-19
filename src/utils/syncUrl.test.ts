import {
  buildSyncPayload,
  decodeSyncPayload,
  encodeSyncPayload,
  parseSyncUrl,
  type SyncPayload,
} from "./syncUrl"
import { StorageKeys } from "./storageKeys"

const payload = {
  english_reading_practice_progress_v3: JSON.stringify({ HAT: "known" }),
  dark_mode_enabled: "1",
  dyslexia_font_enabled: "0",
}

/** How the pre-gzip builds encoded a payload. */
const legacyEncode = (value: SyncPayload) =>
  btoa(encodeURIComponent(JSON.stringify(value)))

beforeEach(() => {
  localStorage.clear()
})

test("encode -> decode round-trips a payload", async () => {
  expect(
    await decodeSyncPayload(await encodeSyncPayload(payload)),
  ).toStrictEqual(payload)
})

test("decoding survives Hebrew content", async () => {
  const withHebrew = {
    english_x: JSON.stringify({ he: "הַט", meaning: "כובע" }),
  }
  expect(
    await decodeSyncPayload(await encodeSyncPayload(withHebrew)),
  ).toStrictEqual(withHebrew)
})

test("encodes Hebrew far more compactly than the pre-gzip builds", async () => {
  const hebrewHeavy = {
    english_exercise_library: JSON.stringify({
      title: "📖 תרגול קריאה באנגלית (Reading Practice)",
      paragraphs: Array.from(
        { length: 8 },
        () => "מאיה החליטה לאפות סופלה שוקולד, קינוח עדין ומאתגר במיוחד.",
      ),
    }),
  }

  const encoded = await encodeSyncPayload(hebrewHeavy)
  expect(encoded.length).toBeLessThan(legacyEncode(hebrewHeavy).length / 4)
})

test("returns null for garbage rather than throwing", async () => {
  expect(await decodeSyncPayload("not-base64!!")).toBeNull()
  // Valid base64, but not gzip.
  expect(await decodeSyncPayload(btoa("hello"))).toBeNull()
})

test("returns null for a link from a pre-gzip build", async () => {
  expect(await decodeSyncPayload(legacyEncode(payload))).toBeNull()
})

test("drops non-string values, which cannot be localStorage entries", async () => {
  const encoded = await encodeSyncPayload({
    a: "1",
    b: 2,
  } as unknown as SyncPayload)
  expect(await decodeSyncPayload(encoded)).toStrictEqual({ a: "1" })
})

test("parses the `?s=` form", async () => {
  const url = `https://example.com/app/?s=${await encodeSyncPayload(payload)}`
  expect(await parseSyncUrl(url)).toStrictEqual(payload)
})

test("ignores the `?sync=` and `#sync=` forms of pre-gzip builds", async () => {
  const legacy = legacyEncode(payload)
  expect(
    await parseSyncUrl(`https://example.com/app/?sync=${legacy}`),
  ).toBeNull()
  expect(
    await parseSyncUrl(`https://example.com/app/#sync=${legacy}`),
  ).toBeNull()
})

test("ignores a HashRouter route, and a URL with no payload at all", async () => {
  expect(await parseSyncUrl("https://example.com/app/#/modules")).toBeNull()
  expect(await parseSyncUrl("https://example.com/app/")).toBeNull()
})

test("returns null for a malformed URL", async () => {
  expect(await parseSyncUrl("not a url")).toBeNull()
})

test("collects progress from localStorage, but never the chosen voice", () => {
  localStorage.setItem(
    StorageKeys.modulesProgress,
    JSON.stringify({ HAT: "known" }),
  )
  localStorage.setItem(StorageKeys.darkMode, "1")
  localStorage.setItem(StorageKeys.systemVoice, "Microsoft David - English")

  expect(buildSyncPayload()).toStrictEqual({
    [StorageKeys.modulesProgress]: JSON.stringify({ HAT: "known" }),
    [StorageKeys.darkMode]: "1",
  })
})
