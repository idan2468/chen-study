import type { VersionedValue } from "@/types/versionedValue"
import type { IsoTimestamp } from "@/utils/sync/timestamp"
import { compareTimestamps, toIsoTimestamp } from "@/utils/sync/timestamp"

/** Older than any real edit, for values that predate versioning (built-ins, legacy storage). */
export const INITIAL_UPDATED_AT = toIsoTimestamp(new Date(0))

export const toVersionedValue = <T>(
  value: T,
  updatedAt: IsoTimestamp = INITIAL_UPDATED_AT,
): VersionedValue<T> => ({ value, updatedAt, deleted: false })

export const markDeleted = <T>(
  entry: VersionedValue<T>,
  updatedAt: IsoTimestamp,
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
  updatedAt: IsoTimestamp,
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
  updatedAt: IsoTimestamp,
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
  updatedAt: IsoTimestamp,
) => {
  if (entry.value !== value) {
    entry.value = value
    entry.updatedAt = updatedAt
  }
}

export const isNewer = <T>(
  candidate: VersionedValue<T>,
  other: VersionedValue<T>,
) => compareTimestamps(candidate.updatedAt, other.updatedAt) > 0

/** Newest `updatedAt` wins; Drive wins ties so every device converges on the shared copy. */
export const pickNewer = <T>(
  local: VersionedValue<T>,
  remote: VersionedValue<T>,
): VersionedValue<T> => (isNewer(local, remote) ? local : remote)

/** Keeps Drive's order, then appends local-only IDs in local order. */
export const mergeVersionedArrays = <T>(
  local: readonly VersionedValue<T>[],
  remote: readonly VersionedValue<T>[],
  getId: (value: T) => string,
  mergeEntries: (
    local: VersionedValue<T>,
    remote: VersionedValue<T>,
  ) => VersionedValue<T> = pickNewer,
): VersionedValue<T>[] => {
  const merged = new Map(remote.map(entry => [getId(entry.value), entry]))
  for (const localEntry of local) {
    const id = getId(localEntry.value)
    const remoteEntry = merged.get(id)
    merged.set(
      id,
      remoteEntry ? mergeEntries(localEntry, remoteEntry) : localEntry,
    )
  }
  return [...merged.values()]
}
