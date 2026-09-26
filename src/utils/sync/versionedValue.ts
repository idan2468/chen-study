import type { VersionedValue } from "@/types/versionedValue"
import type { IsraelIsoTimestamp } from "@/utils/sync/israelTimestamp"
import { toIsraelIsoTimestamp } from "@/utils/sync/israelTimestamp"

/** Older than any real edit, for values that predate versioning (built-ins, legacy storage). */
export const INITIAL_UPDATED_AT = toIsraelIsoTimestamp(new Date(0))

export const toVersionedValue = <T>(
  value: T,
  updatedAt: IsraelIsoTimestamp = INITIAL_UPDATED_AT,
): VersionedValue<T> => ({ value, updatedAt, deleted: false })

export const markDeleted = <T>(
  entry: VersionedValue<T>,
  updatedAt: IsraelIsoTimestamp,
): VersionedValue<T> => ({ ...entry, updatedAt, deleted: true })

export const liveValues = <T>(entries: readonly VersionedValue<T>[]): T[] =>
  entries.filter(entry => !entry.deleted).map(entry => entry.value)

export const findLiveValue = <T>(
  entries: readonly VersionedValue<T>[],
  matches: (value: T) => boolean,
): T | undefined =>
  entries.find(entry => !entry.deleted && matches(entry.value))?.value

/** Replaces a live entry in place; a new or previously deleted value is appended at the end. */
export const putValue = <T>(
  entries: VersionedValue<T>[],
  matches: (value: T) => boolean,
  value: T,
  updatedAt: IsraelIsoTimestamp,
) => {
  const index = entries.findIndex(entry => matches(entry.value))
  const existing = entries[index]
  if (existing && !existing.deleted) {
    entries[index] = toVersionedValue(value, updatedAt)
    return
  }
  if (existing) {
    entries.splice(index, 1)
  }
  entries.push(toVersionedValue(value, updatedAt))
}

export const deleteValue = <T>(
  entries: VersionedValue<T>[],
  matches: (value: T) => boolean,
  updatedAt: IsraelIsoTimestamp,
) => {
  const index = entries.findIndex(
    entry => !entry.deleted && matches(entry.value),
  )
  const existing = entries[index]
  if (existing) {
    entries[index] = markDeleted(existing, updatedAt)
  }
}

/** Leaves `updatedAt` alone when the value is unchanged, so no-op navigation never wins a merge. */
export const setVersionedValue = <T>(
  entry: VersionedValue<T>,
  value: T,
  updatedAt: IsraelIsoTimestamp,
) => {
  if (entry.value !== value) {
    entry.value = value
    entry.updatedAt = updatedAt
  }
}
