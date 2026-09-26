import {
  compareIsraelTimestamps,
  toIsraelIsoTimestamp,
} from "./israelTimestamp"

test("formats summer time with the +03:00 offset", () => {
  expect(toIsraelIsoTimestamp(new Date("2026-09-26T08:02:56.123Z"))).toBe(
    "2026-09-26T11:02:56.123+03:00",
  )
})

test("formats winter time with the +02:00 offset", () => {
  expect(toIsraelIsoTimestamp(new Date("2026-01-15T22:30:00.000Z"))).toBe(
    "2026-01-16T00:30:00.000+02:00",
  )
})

test("switches offset exactly at the daylight-saving transition", () => {
  expect(toIsraelIsoTimestamp(new Date("2026-03-26T23:59:59.999Z"))).toBe(
    "2026-03-27T01:59:59.999+02:00",
  )
  expect(toIsraelIsoTimestamp(new Date("2026-03-27T00:00:00.000Z"))).toBe(
    "2026-03-27T03:00:00.000+03:00",
  )
})

test("round-trips to the same instant", () => {
  const date = new Date("2026-03-27T00:15:42.007Z")

  expect(Date.parse(toIsraelIsoTimestamp(date))).toBe(date.getTime())
})

test("compares parsed instants across different offsets", () => {
  const winterEarlier = "2026-03-27T01:59:00.000+02:00"
  const summerLater = "2026-03-27T03:00:00.000+03:00"

  expect(compareIsraelTimestamps(winterEarlier, summerLater)).toBeLessThan(0)
  expect(compareIsraelTimestamps(summerLater, winterEarlier)).toBeGreaterThan(0)
  expect(
    compareIsraelTimestamps(
      "2026-03-27T02:00:00.000+02:00",
      "2026-03-27T03:00:00.000+03:00",
    ),
  ).toBe(0)
})
