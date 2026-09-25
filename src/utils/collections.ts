export const keepFinalOccurrencesBy = <T>(
  values: readonly T[],
  getKey: (value: T) => string,
): T[] => {
  const finalValuesByKey = new Map<string, T>()

  for (const value of values) {
    const key = getKey(value)
    finalValuesByKey.delete(key)
    finalValuesByKey.set(key, value)
  }

  return [...finalValuesByKey.values()]
}
