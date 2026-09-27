/**
 * Two devices syncing through one fake Drive, running the real migration,
 * transport, and merge code. Only Google itself is faked (see
 * `test/fakeDrive.ts`); signing in is just a stored access token.
 */
import { createFakeDrive } from "@test/fakeDrive"
import type { FakeDrive } from "@test/fakeDrive"
import {
  readLocalPersistedState,
  reloadFromStorage,
  selectPersistedState,
} from "@/store/persistedState"
import { markCard, selectModulesProgress } from "@/store/slices/modulesSlice"
import type { AppStore } from "@/store/store"
import { makeStore } from "@/store/store"
import type { PersistedState } from "@/types/schemas/persistedState"
import { StorageKeys } from "@/utils/sync/legacy/legacyStorage"
import { isV2Activated } from "@/utils/sync/legacy/migrateToV2"
import { syncWithDrive } from "./driveSync"

const TOKEN = "fake-token"
const V2_FILE = "progress-v2.json"
const LEGACY_FILE = "progress.json"

type Device = { storage: Record<string, string>; store?: AppStore }

/** A device signed in to Google, with its own legacy localStorage. */
const createDevice = (legacyProgress: Record<string, string>): Device => ({
  storage: {
    [StorageKeys.googleAccessToken]: TOKEN,
    [StorageKeys.modulesProgress]: JSON.stringify(legacyProgress),
  },
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

const progressOf = (device: Device) =>
  onDevice(device, store => selectModulesProgress(store.getState()))

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
  // Production's legacy snapshot, pushed by the old app before this release.
  drive.addFile(
    LEGACY_FILE,
    JSON.stringify({
      [StorageKeys.modulesProgress]: JSON.stringify({ HAT: "known" }),
    }),
  )
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("migrating two legacy devices", () => {
  test("the first device pulls progress.json and creates progress-v2.json", async () => {
    const laptop = createDevice({ FOX: "unknown" })

    await onDevice(laptop, sync)

    expect(drive.calls()).toStrictEqual([
      "GET /drive/v3/files", // locate progress-v2.json: none
      "GET /drive/v3/files", // locate progress.json
      "GET /drive/v3/files/file-1", // download it
      "POST /upload/drive/v3/files", // create progress-v2.json
    ])
    expect(drive.requests[0]?.url).toContain("spaces=appDataFolder")
    // The legacy pull replaces the whole legacy key, as connect always did.
    expect(driveProgress()).toStrictEqual({ HAT: "known" })
    expect(await progressOf(laptop)).toStrictEqual({ HAT: "known" })
    await onDevice(laptop, () => {
      expect(isV2Activated()).toBe(true)
      expect(localStorage.getItem(StorageKeys.modulesProgress)).toBeNull()
      expect(localStorage.getItem(StorageKeys.googleAccessToken)).toBe(TOKEN)
    })
  })

  test("the second device merges into progress-v2.json and never reads progress.json", async () => {
    const laptop = createDevice({})
    const phone = createDevice({ CAT: "known" })
    await onDevice(laptop, sync)
    drive.clearRequests()

    await onDevice(phone, sync)

    expect(drive.calls()).toStrictEqual([
      "GET /drive/v3/files", // locate progress-v2.json
      "GET /drive/v3/files/file-2", // download it
      "PATCH /upload/drive/v3/files/file-2", // upload the merge
    ])
    expect(driveProgress()).toStrictEqual({ HAT: "known", CAT: "known" })
    expect(await progressOf(phone)).toStrictEqual({
      HAT: "known",
      CAT: "known",
    })
  })

  test("progress.json is only ever read, never written", async () => {
    const legacyContent = drive.fileNamed(LEGACY_FILE)?.content
    await onDevice(createDevice({}), sync)
    await onDevice(createDevice({ CAT: "known" }), sync)

    expect(drive.fileNamed(LEGACY_FILE)?.content).toBe(legacyContent)
    expect(
      drive.requests.filter(
        request => request.method !== "GET" && request.url.includes("file-1"),
      ),
    ).toStrictEqual([])
  })
})

describe("two activated devices", () => {
  let laptop: Device
  let phone: Device

  beforeEach(async () => {
    laptop = createDevice({})
    phone = createDevice({})
    await onDevice(laptop, sync)
    await onDevice(phone, sync)
    drive.clearRequests()
  })

  test("an edit on one device reaches the other on its next sync", async () => {
    nextMinute()
    await onDevice(laptop, async store => {
      store.dispatch(markCard({ word: "FOX", isKnown: true }))
      await sync(store)
    })
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
      "GET /drive/v3/files/file-2",
    ])
  })

  test("a corrupt progress-v2.json is kept as a .bck backup, not overwritten", async () => {
    const corrupt = drive.fileNamed(V2_FILE)
    if (corrupt) {
      corrupt.content = "{not json"
    }

    await onDevice(laptop, sync)

    expect(drive.calls().slice(-2)).toStrictEqual([
      "PATCH /drive/v3/files/file-2", // rename aside
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
    laptop.storage[StorageKeys.googleAccessToken] = "expired"

    await expect(onDevice(laptop, sync)).rejects.toThrow("token expired")

    expect(drive.calls()).toStrictEqual(["GET /drive/v3/files"])
  })
})
