import { StorageKeys } from "./storageKeys"
import { applySyncPayload, buildSyncPayload } from "./syncPayload"

beforeEach(() => {
  localStorage.clear()
})

test("collects progress from localStorage, but never device-local keys", () => {
  localStorage.setItem(
    StorageKeys.modulesProgress,
    JSON.stringify({ HAT: "known" }),
  )
  localStorage.setItem(StorageKeys.darkMode, "1")
  localStorage.setItem(StorageKeys.systemVoice, "Microsoft David - English")
  localStorage.setItem(StorageKeys.googleAccessToken, "ya29.secret")
  localStorage.setItem(StorageKeys.googleLastSyncedHash, "abc123")

  expect(buildSyncPayload()).toStrictEqual({
    [StorageKeys.modulesProgress]: JSON.stringify({ HAT: "known" }),
    [StorageKeys.darkMode]: "1",
  })
})

describe("applySyncPayload", () => {
  test("writes syncable keys into localStorage and reports how many applied", () => {
    const applied = applySyncPayload({
      [StorageKeys.modulesProgress]: JSON.stringify({ HAT: "known" }),
      [StorageKeys.darkMode]: "1",
    })

    expect(applied).toBe(2)
    expect(localStorage.getItem(StorageKeys.modulesProgress)).toBe(
      JSON.stringify({ HAT: "known" }),
    )
    expect(localStorage.getItem(StorageKeys.darkMode)).toBe("1")
  })

  test("ignores a device-local key rather than overwriting it, e.g. a crafted sync link cannot hijack the stored Google token", () => {
    localStorage.setItem(StorageKeys.googleAccessToken, "victims-real-token")

    const applied = applySyncPayload({
      [StorageKeys.googleAccessToken]: "attackers-token",
      [StorageKeys.darkMode]: "1",
    })

    expect(applied).toBe(1)
    expect(localStorage.getItem(StorageKeys.googleAccessToken)).toBe(
      "victims-real-token",
    )
    expect(localStorage.getItem(StorageKeys.darkMode)).toBe("1")
  })
})
