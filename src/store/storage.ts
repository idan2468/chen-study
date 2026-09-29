/**
 * Safe localStorage access. Every function swallows failures (private
 * browsing, quota), so a storage error never breaks the page.
 */

export const writeJson = (key: string, value: unknown) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    console.warn(`Could not persist "${key}"`, error)
  }
}

/** `""` when the key is missing or unreadable. */
export const readString = (key: string) => {
  try {
    return window.localStorage.getItem(key) ?? ""
  } catch {
    return ""
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
