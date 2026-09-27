import type { PayloadAction } from "@reduxjs/toolkit"
import type { IsoTimestamp } from "@/utils/sync/timestamp"
import { toIsoTimestamp } from "@/utils/sync/timestamp"

export type TimestampedAction<P = void> = PayloadAction<
  P,
  string,
  { updatedAt: IsoTimestamp }
>

/** `prepare` callback that stamps the action, keeping reducers pure. */
export const withUpdatedAt = <P>(payload: P) => ({
  payload,
  meta: { updatedAt: toIsoTimestamp(new Date()) },
})

export const withUpdatedAtOnly = () => withUpdatedAt(undefined)
