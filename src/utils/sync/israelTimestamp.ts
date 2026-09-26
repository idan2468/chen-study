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
