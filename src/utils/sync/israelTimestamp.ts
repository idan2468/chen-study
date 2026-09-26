export type IsraelIsoTimestamp = string

type WallClockPart = "year" | "month" | "day" | "hour" | "minute" | "second"

const israelWallClockFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Jerusalem",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
})

const padNumber = (value: number, length: number): string =>
  String(value).padStart(length, "0")

const getIsraelWallClock = (date: Date): Record<WallClockPart, string> =>
  Object.fromEntries(
    israelWallClockFormat
      .formatToParts(date)
      .map(part => [part.type, part.value]),
  ) as Record<WallClockPart, string>

const formatUtcOffset = (offsetMinutes: number): string => {
  const sign = offsetMinutes < 0 ? "-" : "+"
  const absoluteMinutes = Math.abs(offsetMinutes)
  return `${sign}${padNumber(Math.floor(absoluteMinutes / 60), 2)}:${padNumber(absoluteMinutes % 60, 2)}`
}

/** Formats an instant as Israel wall-clock time with its UTC offset, e.g. `2026-09-26T11:02:56.123+03:00`. */
export const toIsraelIsoTimestamp = (date: Date): IsraelIsoTimestamp => {
  const { year, month, day, hour, minute, second } = getIsraelWallClock(date)
  const milliseconds = date.getUTCMilliseconds()
  const wallClockAsUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
    milliseconds,
  )
  const offsetMinutes = (wallClockAsUtc - date.getTime()) / 60_000
  return `${year}-${month}-${day}T${hour}:${minute}:${second}.${padNumber(milliseconds, 3)}${formatUtcOffset(offsetMinutes)}`
}

/** Orders timestamps by the instant they represent, not by their string form. */
export const compareIsraelTimestamps = (
  a: IsraelIsoTimestamp,
  b: IsraelIsoTimestamp,
): number => Date.parse(a) - Date.parse(b)
