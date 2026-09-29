/**
 * Safe localStorage access. Every function swallows failures (private
 * browsing, quota), so a storage error never breaks the page; reads fall back
 * to the supplied default.
 */

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
