import type { PayloadAction } from "@reduxjs/toolkit"
import type { IsraelIsoTimestamp } from "@/utils/sync/israelTimestamp"
import { toIsraelIsoTimestamp } from "@/utils/sync/israelTimestamp"

export type TimestampedAction<P = void> = PayloadAction<
  P,
  string,
  { updatedAt: IsraelIsoTimestamp }
>

/** `prepare` callback that stamps the action, keeping reducers pure. */
export const withUpdatedAt = <P>(payload: P) => ({
  payload,
  meta: { updatedAt: toIsraelIsoTimestamp(new Date()) },
})
