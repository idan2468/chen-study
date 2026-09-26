import type { IsraelIsoTimestamp } from "@/utils/sync/israelTimestamp"

export type VersionedValue<T> = {
  value: T
  updatedAt: IsraelIsoTimestamp
  deleted: boolean
}
