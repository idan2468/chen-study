/**
 * Safe localStorage access. Replaces the ~12 ad-hoc try/catch
 * `JSON.parse(localStorage.getItem(...))` sites in the original HTML apps.
 *
 * Every function swallows failures (private browsing, quota, malformed JSON)
 * and falls back to the supplied default, matching the originals' behaviour of
 * never letting a storage error break the page.
 */

export const readJson = <T>(key: string, fallback: T): T => {
  try {
    const raw = window.localStorage.getItem(key)
    if (raw === null) {
      return fallback
    }
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export const writeJson = (key: string, value: unknown) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    console.warn(`Could not persist "${key}"`, error)
  }
}

export const readString = (key: string, fallback = "") => {
  try {
    return window.localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

export const writeString = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value)
  } catch (error) {
    console.warn(`Could not persist "${key}"`, error)
  }
}

export const removeKey = (key: string) => {
  try {
    window.localStorage.removeItem(key)
  } catch (error) {
    console.warn(`Could not remove "${key}"`, error)
  }
}

/** The originals store booleans as the strings `'1'` and `'0'`. */
export const readFlag = (key: string, fallback: boolean) => {
  const raw = readString(key, "")
  return raw === "" ? fallback : raw === "1"
}

export const writeFlag = (key: string, value: boolean) => {
  writeString(key, value ? "1" : "0")
}

export const listKeys = () => {
  try {
    return Object.keys(window.localStorage)
  } catch {
    return []
  }
}
