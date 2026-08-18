/**
 * Deleting a computed key is exactly what the progress reducers need -- an
 * absent entry means "not marked yet", which is distinct from `false`
 * ("marked as unknown"). Setting `undefined` instead would leak the key into
 * `Object.keys` and into the persisted JSON, changing the shape the original
 * HTML apps read.
 *
 * Centralised here so the lint exemption lives in one audited place rather than
 * being repeated at every call site. Safe on Immer drafts, which are mutated by
 * reference.
 */
export const deleteEntry = <T>(record: Record<string, T>, key: string) => {
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
  delete record[key]
}
