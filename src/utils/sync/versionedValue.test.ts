import { markDeleted } from "./versionedValue"

test("marks an entry deleted at the given time and keeps its value", () => {
  const entry = {
    value: { word: "HAT" },
    updatedAt: "2026-09-26T11:00:00.000+03:00",
    deleted: false,
  }

  expect(markDeleted(entry, "2026-09-26T12:00:00.000+03:00")).toStrictEqual({
    value: { word: "HAT" },
    updatedAt: "2026-09-26T12:00:00.000+03:00",
    deleted: true,
  })
  expect(entry.deleted).toBe(false)
})
