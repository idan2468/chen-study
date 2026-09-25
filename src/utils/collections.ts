export const keepFinalOccurrencesBy = <T>(
  values: readonly T[],
  getKey: (value: T) => string,
): T[] => {
  const seen = new Set<string>()
  const reversedResult: T[] = []

  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = values[index]
    if (value === undefined) {
      continue
    }

    const key = getKey(value)
    if (!seen.has(key)) {
      seen.add(key)
      reversedResult.push(value)
    }
  }

  return reversedResult.reverse()
}
