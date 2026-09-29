/**
 * Small helpers for the test suite.
 *
 * They exist mainly to keep assertions out of `if` blocks: narrowing a
 * discriminated result with `if (result.ok)` and asserting inside it trips
 * `vitest/no-conditional-expect`, and a test that silently skips its assertions
 * when the guard is false is worse than one that fails loudly.
 */

/**
 * Narrows a `{ ok: true, ... } | { ok: false, ... }` result to its success
 * branch, or throws.
 *
 * A single type parameter plus `Extract` rather than two parameters: given one
 * union argument, TypeScript cannot split it across `TOk | TErr` and falls back
 * to the constraints, losing the payload.
 */
export const expectOk = <T extends { ok: boolean }>(
  result: T,
): Extract<T, { ok: true }> => {
  if (!result.ok) {
    throw new Error(
      `expected a successful result, got: ${JSON.stringify(result)}`,
    )
  }
  return result as Extract<T, { ok: true }>
}

/** Narrows to the failure branch, or throws. */
export const expectFailure = <T extends { ok: boolean }>(
  result: T,
): Extract<T, { ok: false }> => {
  if (result.ok) {
    throw new Error("expected a failed result, but it succeeded")
  }
  return result as Extract<T, { ok: false }>
}

/** Indexed access without a non-null assertion; throws if the item is missing. */
export const at = <T>(items: readonly T[], index: number): T => {
  const item = items[index]
  if (item === undefined) {
    throw new Error(`no item at index ${String(index)}`)
  }
  return item
}

/** Returns a copy of `source` without `key`, for testing missing-field cases. */
export const omitKey = <T extends object, K extends keyof T>(
  source: T,
  key: K,
): Omit<T, K> => {
  const clone = { ...source }
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
  delete clone[key]
  return clone
}
