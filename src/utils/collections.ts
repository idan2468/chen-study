/**
 * Deduplicates by key, keeping each key's last value (a later import replaces an earlier one).
 * @param getKey Returns the identity to deduplicate by, e.g. `exercise => exercise.exerciseId`.
 */
export const keepLastBy = <T>(
  values: readonly T[],
  getKey: (value: T) => string,
): T[] => {
  const finalValuesByKey = Object.fromEntries(
    values.map(value => [getKey(value), value]),
  )
  return Object.values(finalValuesByKey)
}

export const hasWord = (word: string) => (record: { word: string }) =>
  record.word === word

/** Keeps a stored position inside a list that may have shrunk; 0 for an empty list. */
export const clampIndex = (index: number, length: number) =>
  Math.min(Math.max(index, 0), Math.max(length - 1, 0))
