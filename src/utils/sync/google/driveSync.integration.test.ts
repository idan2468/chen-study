/**
 * Two devices syncing through one fake Drive, running the real transport
 * and merge code. Only Google itself is faked (see
 * `test/fakeDrive.ts`); signing in is just a stored access token.
 */
import { DeviceStorageKeys } from "@/store/deviceStorageKeys"
import { createFakeDrive } from "@test/fakeDrive"
import type { FakeDrive } from "@test/fakeDrive"
import {
  readLocalPersistedState,
  reloadFromStorage,
  selectPersistedState,
} from "@/store/persistedState"
import { markCard, selectDisplayedProgress } from "@/store/slices/modulesSlice"
import type { AppStore } from "@/store/store"
import { makeStore } from "@/store/store"
import type { PersistedState } from "@/types/schemas/persistedState"
import { syncWithDrive } from "@/utils/sync/google/driveSync"

const TOKEN = "fake-token"
const V2_FILE = "progress-v2.json"

type Device = { storage: Record<string, string>; store?: AppStore }

/** A device signed in to Google, starting from the defaults. */
const createDevice = (): Device => ({
  storage: { [DeviceStorageKeys.googleAccessToken]: TOKEN },
})

/**
 * jsdom has one localStorage, so each device's keys are swapped in for the
 * duration of `run` and saved back afterwards. The store is created on first
 * use, like a boot.
 */
const onDevice = async <T>(
  device: Device,
  run: (store: AppStore) => T | Promise<T>,
): Promise<T> => {
  localStorage.clear()
  for (const [key, value] of Object.entries(device.storage)) {
    localStorage.setItem(key, value)
  }
  device.store ??= makeStore()
  try {
    return await run(device.store)
  } finally {
    device.storage = Object.fromEntries(
      Object.keys(localStorage).map(key => [
        key,
        localStorage.getItem(key) ?? "",
      ]),
    )
  }
}

const sync = (store: AppStore) =>
  syncWithDrive(
    () => selectPersistedState(store.getState()),
    () => store.dispatch(reloadFromStorage()),
  )

const markAndSync = (device: Device, word: string, isKnown: boolean) =>
  onDevice(device, async store => {
    store.dispatch(markCard({ word, isKnown }))
    await sync(store)
  })

const progressOf = (device: Device) =>
  onDevice(device, store => selectDisplayedProgress(store.getState()))

const driveState = () => drive.readJson(V2_FILE) as PersistedState | undefined

const driveProgress = () =>
  Object.fromEntries(
    (driveState()?.modules.progress ?? [])
      .filter(entry => !entry.deleted)
      .map(entry => [entry.value.word, entry.value.status]),
  )

/** Each step is a minute later, so edits have strictly increasing timestamps. */
const nextMinute = () => {
  vi.setSystemTime(Date.now() + 60_000)
}

let drive: FakeDrive

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-09-27T09:00:00Z") })
  drive = createFakeDrive({ token: TOKEN })
  vi.stubGlobal("fetch", drive.fetch)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("the first sync of each device", () => {
  test("the first device creates progress-v2.json", async () => {
    const laptop = createDevice()

    await markAndSync(laptop, "FOX", false)

    expect(drive.calls()).toStrictEqual([
      "GET /drive/v3/files", // locate progress-v2.json: none
      "POST /upload/drive/v3/files", // create it
    ])
    expect(drive.requests[0]?.url).toContain("spaces=appDataFolder")
    expect(driveProgress()).toStrictEqual({ FOX: "unknown" })
  })

  test("the second device merges into progress-v2.json", async () => {
    const laptop = createDevice()
    const phone = createDevice()
    await markAndSync(laptop, "HAT", true)
    drive.clearRequests()

    await markAndSync(phone, "CAT", true)

    expect(drive.calls()).toStrictEqual([
      "GET /drive/v3/files", // locate progress-v2.json
      "GET /drive/v3/files/file-1", // download it
      "PATCH /upload/drive/v3/files/file-1", // upload the merge
    ])
    expect(driveProgress()).toStrictEqual({ HAT: "known", CAT: "known" })
    expect(await progressOf(phone)).toStrictEqual({
      HAT: "known",
      CAT: "known",
    })
  })
})

test("overlapping syncs on one device create progress-v2.json only once", async () => {
  const laptop = createDevice()
  await onDevice(laptop, store => Promise.all([sync(store), sync(store)]))

  expect(drive.files.filter(file => file.name === V2_FILE)).toHaveLength(1)
  expect(drive.calls().filter(call => call.startsWith("POST"))).toHaveLength(1)
})

describe("two synced devices", () => {
  let laptop: Device
  let phone: Device

  beforeEach(async () => {
    laptop = createDevice()
    phone = createDevice()
    await markAndSync(laptop, "HAT", true)
    await onDevice(phone, sync)
    drive.clearRequests()
  })

  test("an edit on one device reaches the other on its next sync", async () => {
    nextMinute()
    await markAndSync(laptop, "FOX", true)
    await onDevice(phone, sync)

    expect(await progressOf(phone)).toMatchObject({ FOX: "known" })
  })

  test("the newer of two edits to the same word wins on both devices", async () => {
    nextMinute()
    await onDevice(laptop, store => {
      store.dispatch(markCard({ word: "HAT", isKnown: false }))
    })
    nextMinute()
    await onDevice(phone, store => {
      store.dispatch(markCard({ word: "HAT", isKnown: true }))
    })

    await onDevice(phone, sync)
    await onDevice(laptop, sync)
    await onDevice(phone, sync)

    expect(await progressOf(laptop)).toMatchObject({ HAT: "known" })
    expect(await progressOf(phone)).toMatchObject({ HAT: "known" })
  })

  test("offline edits to different words on both devices all survive", async () => {
    nextMinute()
    await onDevice(laptop, store => {
      store.dispatch(markCard({ word: "FOX", isKnown: true }))
    })
    await onDevice(phone, store => {
      store.dispatch(markCard({ word: "CAT", isKnown: false }))
    })

    await onDevice(laptop, sync)
    await onDevice(phone, sync)
    await onDevice(laptop, sync)

    const expected = { HAT: "known", FOX: "known", CAT: "unknown" }
    expect(await progressOf(laptop)).toStrictEqual(expected)
    expect(await progressOf(phone)).toStrictEqual(expected)
    expect(driveProgress()).toStrictEqual(expected)
  })

  test("an idle sync reads Drive but uploads nothing", async () => {
    await onDevice(laptop, sync)

    expect(drive.calls()).toStrictEqual([
      "GET /drive/v3/files",
      "GET /drive/v3/files/file-1",
    ])
  })

  test("a corrupt progress-v2.json is kept as a .bck backup, not overwritten", async () => {
    const corrupt = drive.fileNamed(V2_FILE)
    if (corrupt) {
      corrupt.content = "{not json"
    }

    await onDevice(laptop, sync)

    expect(drive.calls().slice(-2)).toStrictEqual([
      "PATCH /drive/v3/files/file-1", // rename aside
      "POST /upload/drive/v3/files", // fresh progress-v2.json
    ])
    expect(corrupt?.name).toMatch(/^progress-v2\.invalid-.+\.json\.bck$/)
    expect(corrupt?.content).toBe("{not json")
    expect(driveProgress()).toStrictEqual({ HAT: "known" })
    await onDevice(laptop, () => {
      expect(readLocalPersistedState()).toStrictEqual(driveState())
    })
  })

  test("an expired token is rejected before anything is written", async () => {
    laptop.storage[DeviceStorageKeys.googleAccessToken] = "expired"

    await expect(onDevice(laptop, sync)).rejects.toThrow("token expired")

    expect(drive.calls()).toStrictEqual(["GET /drive/v3/files"])
  })
})
