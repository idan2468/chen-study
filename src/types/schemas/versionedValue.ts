import { DateTime } from "luxon"
import { z } from "zod"
import { ISRAEL_TIME_ZONE } from "@/utils/sync/israelTimestamp"

const EXPLICIT_UTC_OFFSET = /[+-]\d{2}:\d{2}$/

const hasIsraelOffset = (timestamp: string) => {
  const parsed = DateTime.fromISO(timestamp, { setZone: true })
  return (
    parsed.isValid &&
    EXPLICIT_UTC_OFFSET.test(timestamp) &&
    parsed.offset === parsed.setZone(ISRAEL_TIME_ZONE).offset
  )
}

export const israelIsoTimestampSchema = z.string().refine(hasIsraelOffset, {
  error: "Expected an ISO timestamp with Israel's UTC offset",
})

export const versionedValueSchema = <T extends z.ZodType>(valueSchema: T) =>
  z.object({
    value: valueSchema,
    updatedAt: israelIsoTimestampSchema,
    deleted: z.boolean(),
  })
