import { z } from "zod"

/** @internal Exported for tests. */
export const isoTimestampSchema = z.iso.datetime({ offset: true })

export const versionedValueSchema = <T extends z.ZodType>(valueSchema: T) =>
  z.object({
    value: valueSchema,
    updatedAt: isoTimestampSchema,
    deleted: z.boolean(),
  })
