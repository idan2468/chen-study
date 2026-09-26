import { z } from "zod"
import { isoTimestampSchema, versionedValueSchema } from "./versionedValue"

test.each(["2026-09-26T11:02:56.123+03:00", "2026-01-16T00:30:00.000+02:00"])(
  "accepts %s",
  timestamp => {
    expect(isoTimestampSchema.safeParse(timestamp).success).toBe(true)
  },
)

test.each([
  ["no offset", "2026-09-26T11:02:56.123"],
  ["an impossible date", "2026-13-40T11:02:56.123+03:00"],
  ["not a timestamp", "yesterday"],
])("rejects %s", (_, timestamp) => {
  expect(isoTimestampSchema.safeParse(timestamp).success).toBe(false)
})

test("validates the wrapped value and version metadata", () => {
  const schema = versionedValueSchema(z.object({ word: z.string() }))
  const entry = {
    value: { word: "HAT" },
    updatedAt: "2026-09-26T11:00:00.000+03:00",
    deleted: false,
  }

  expect(schema.parse(entry)).toStrictEqual(entry)
  expect(schema.safeParse({ ...entry, value: { word: 1 } }).success).toBe(false)
  expect(schema.safeParse({ ...entry, deleted: undefined }).success).toBe(false)
})
