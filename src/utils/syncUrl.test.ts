import { decodeSyncPayload, encodeSyncPayload, parseSyncUrl } from "./syncUrl"

const payload = {
  english_reading_practice_progress_v3: JSON.stringify({ HAT: "known" }),
  dark_mode_enabled: "1",
  dyslexia_font_enabled: "0",
}

test("encode -> decode round-trips a payload", () => {
  expect(decodeSyncPayload(encodeSyncPayload(payload))).toStrictEqual(payload)
})

test("decoding survives Hebrew content", () => {
  const withHebrew = {
    english_x: JSON.stringify({ he: "הַט", meaning: "כובע" }),
  }
  expect(decodeSyncPayload(encodeSyncPayload(withHebrew))).toStrictEqual(
    withHebrew,
  )
})

test("returns null for garbage rather than throwing", () => {
  expect(decodeSyncPayload("not-base64!!")).toBeNull()
  // Valid base64, but not JSON.
  expect(decodeSyncPayload(btoa("hello"))).toBeNull()
})

test("drops non-string values, which cannot be localStorage entries", () => {
  const encoded = btoa(encodeURIComponent(JSON.stringify({ a: "1", b: 2 })))
  expect(decodeSyncPayload(encoded)).toStrictEqual({ a: "1" })
})

test("parses the current `?sync=` form", () => {
  const url = `https://example.com/app/?sync=${encodeSyncPayload(payload)}`
  expect(parseSyncUrl(url)).toStrictEqual(payload)
})

test("parses the legacy `#sync=` form shared by the original HTML apps", () => {
  const url = `https://example.com/app/#sync=${encodeSyncPayload(payload)}`
  expect(parseSyncUrl(url)).toStrictEqual(payload)
})

test("ignores a HashRouter route that merely looks like a hash payload", () => {
  expect(parseSyncUrl("https://example.com/app/#/modules")).toBeNull()
  expect(parseSyncUrl("https://example.com/app/")).toBeNull()
})

test("returns null for a malformed URL", () => {
  expect(parseSyncUrl("not a url")).toBeNull()
})
