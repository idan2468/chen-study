import type { VersionedValue } from "@/types/versionedValue"
import type { IsraelIsoTimestamp } from "@/utils/sync/israelTimestamp"

export const markDeleted = <T>(
  entry: VersionedValue<T>,
  updatedAt: IsraelIsoTimestamp,
): VersionedValue<T> => ({ ...entry, updatedAt, deleted: true })
