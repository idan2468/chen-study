import { DateTime } from "luxon"

export type IsraelIsoTimestamp = string

export const toIsraelIsoTimestamp = (date: Date): IsraelIsoTimestamp => {
  const timestamp = DateTime.fromJSDate(date, {
    zone: "Asia/Jerusalem",
  }).toISO()
  if (timestamp === null) {
    throw new RangeError("Cannot timestamp an invalid date")
  }
  return timestamp
}
