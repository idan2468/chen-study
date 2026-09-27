import type { IsoTimestamp } from "@/utils/sync/timestamp"

export type VersionedValue<T> = {
  value: T
  updatedAt: IsoTimestamp
  deleted: boolean
}
