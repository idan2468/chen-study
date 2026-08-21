import { StorageKeys } from "./storageKeys"
import { buildSyncPayload } from "./syncPayload"

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

  expect(buildSyncPayload()).toStrictEqual({
    [StorageKeys.modulesProgress]: JSON.stringify({ HAT: "known" }),
    [StorageKeys.darkMode]: "1",
  })
})
