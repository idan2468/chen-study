import { DateTime } from "luxon"

export type IsoTimestamp = string

const DEFAULT_TIME_ZONE = "Asia/Jerusalem"

/**
 * @param zone IANA time zone whose offset the ISO string carries; the instant is the same in any zone.
 * @throws RangeError for an invalid `date`.
 */
export const toIsoTimestamp = (
  date: Date,
  zone: string = DEFAULT_TIME_ZONE,
): IsoTimestamp => {
  const timestamp = DateTime.fromJSDate(date, { zone }).toISO()
  if (timestamp === null) {
    throw new RangeError("Cannot timestamp an invalid date")
  }
  return timestamp
}

/** Orders timestamps by the instant they represent, not by their string form; negative when `a` is earlier, like a sort comparator. */
export const compareTimestamps = (a: IsoTimestamp, b: IsoTimestamp): number =>
  DateTime.fromISO(a).toMillis() - DateTime.fromISO(b).toMillis()
