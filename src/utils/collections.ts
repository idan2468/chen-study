export const keepFinalOccurrencesBy = <T>(
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
