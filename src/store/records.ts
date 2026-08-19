/**
 * An absent entry means "not marked yet", distinct from `false` ("marked
 * unknown") -- setting `undefined` would leak the key into persisted JSON
 * instead. Centralised so the lint exemption lives in one place.
 */
export const deleteEntry = <T>(record: Record<string, T>, key: string) => {
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
  delete record[key]
}
