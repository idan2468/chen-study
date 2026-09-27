import { DateTime } from "luxon"

export type IsraelIsoTimestamp = string

const ISRAEL_TIME_ZONE = "Asia/Jerusalem"

export const toIsraelIsoTimestamp = (date: Date): IsraelIsoTimestamp => {
  const timestamp = DateTime.fromJSDate(date, {
    zone: ISRAEL_TIME_ZONE,
  }).toISO()
  if (timestamp === null) {
    throw new RangeError("Cannot timestamp an invalid date")
  }
  return timestamp
}

/** Orders timestamps by the instant they represent, not by their string form. */
export const compareIsraelTimestamps = (
  a: IsraelIsoTimestamp,
  b: IsraelIsoTimestamp,
): number => DateTime.fromISO(a).toMillis() - DateTime.fromISO(b).toMillis()
