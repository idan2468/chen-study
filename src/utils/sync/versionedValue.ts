import type { VersionedValue } from "@/types/versionedValue"
import type { IsoTimestamp } from "@/utils/sync/timestamp"
import { compareTimestamps, toIsoTimestamp } from "@/utils/sync/timestamp"

/**
 * Older than any real edit, for the defaults a new user starts from.
 * @internal Exported for tests.
 */
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

/** IDs of the live entries, in list order. */
export const liveIds = <T>(
  entries: readonly VersionedValue<T>[],
  getId: (value: T) => string,
) => liveValues(entries).map(getId)

export const findLiveValue = <T>(
  entries: readonly VersionedValue<T>[],
  matches: (value: T) => boolean,
): T | undefined =>
  entries.find(entry => !entry.deleted && matches(entry.value))?.value

/**
 * Replaces a live entry in place; a new or previously deleted value is appended at the end.
 * @param entries Mutated in place (an Immer draft inside reducers).
 * @param matches Identifies the entity by its semantic ID, e.g. `hasWord(word)`.
 * @param updatedAt Stamped on the stored entry.
 */
export const upsertValue = <T>(
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

/**
 * Tombstones the live entry `matches` finds; does nothing when it is missing or already deleted.
 * @param entries Mutated in place (an Immer draft inside reducers).
 */
export const tombstoneValue = <T>(
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

/**
 * Leaves `updatedAt` alone when the value is unchanged, so no-op navigation never wins a merge.
 * @param entry Mutated in place (an Immer draft inside reducers).
 */
export const setValueIfChanged = <T>(
  entry: VersionedValue<T>,
  value: T,
  updatedAt: IsoTimestamp,
) => {
  if (entry.value !== value) {
    entry.value = value
    entry.updatedAt = updatedAt
  }
}

/** Strictly later, so a tie is `false`. */
export const isNewer = <T>(
  candidate: VersionedValue<T>,
  other: VersionedValue<T>,
) => compareTimestamps(candidate.updatedAt, other.updatedAt) > 0

/**
 * Newest `updatedAt` wins; Drive wins ties so every device converges on the shared copy.
 * @param local This device's entry.
 * @param remote The Drive copy's entry for the same ID.
 */
export const pickNewer = <T>(
  local: VersionedValue<T>,
  remote: VersionedValue<T>,
): VersionedValue<T> => (isNewer(local, remote) ? local : remote)

/**
 * Keeps Drive's order, then appends local-only IDs in local order.
 * @param local This device's entries.
 * @param remote The Drive copy's entries.
 * @param getId Returns the semantic ID that pairs a local entry with its Drive counterpart.
 * @param mergeEntries Resolves an ID present on both sides; defaults to newest-wins.
 */
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
