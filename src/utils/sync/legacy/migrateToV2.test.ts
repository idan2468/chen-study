import {
  PERSISTED_STATE_KEY,
  readLocalPersistedState,
  selectPersistedState,
  writeLocalPersistedState,
} from "@/store/persistedState"
import { makeStore } from "@/store/store"
import type { PersistedState } from "@/types/schemas/persistedState"
import { CardStatus } from "@/types/moduleExercise"
import {
  readDrivePersistedState,
  writeDrivePersistedState,
} from "@/utils/sync/google/drivePersistedState"
import { readSnapshot } from "@/utils/sync/google/driveStore"
import { flashcardStatusKey, StorageKeys } from "./legacyStorage"
import { isV2Activated, migrateToV2, V2_ACTIVATED_KEY } from "./migrateToV2"
import { mergePersistedState } from "@/utils/sync/mergePersistedState"
import { toVersionedValue } from "@/utils/sync/versionedValue"

vi.mock("@/utils/sync/google/drivePersistedState")
vi.mock("@/utils/sync/google/driveStore")

const EDITED_AT = "2026-09-27T10:00:00.000+03:00"

const DEVICE_SETTINGS = {
  [StorageKeys.darkMode]: "1",
  [StorageKeys.locale]: "he",
  [StorageKeys.systemVoice]: "voice-uri",
  [StorageKeys.googleAccessToken]: "ya29.token",
}

const seedLegacyStorage = () => {
  localStorage.setItem(
    StorageKeys.modulesProgress,
    JSON.stringify({ HAT: CardStatus.Known }),
  )
  localStorage.setItem(flashcardStatusKey("u1"), JSON.stringify({ cat: true }))
  localStorage.setItem(StorageKeys.googleLastSyncedHash, "hash")
  for (const [key, value] of Object.entries(DEVICE_SETTINGS)) {
    localStorage.setItem(key, value)
  }
}

const convertedLegacyState = () => selectPersistedState(makeStore().getState())

const withModuleProgress = (
  state: PersistedState,
  progress: PersistedState["modules"]["progress"],
): PersistedState => ({ ...state, modules: { ...state.modules, progress } })

const expectLegacyDataDeleted = () => {
  expect(Object.keys(localStorage).sort()).toStrictEqual(
    [
      PERSISTED_STATE_KEY,
      V2_ACTIVATED_KEY,
      ...Object.keys(DEVICE_SETTINGS),
    ].sort(),
  )
}

const expectNotActivated = () => {
  expect(isV2Activated()).toBe(false)
  expect(localStorage.getItem(StorageKeys.modulesProgress)).not.toBeNull()
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  vi.mocked(readDrivePersistedState).mockResolvedValue({ status: "missing" })
  vi.mocked(writeDrivePersistedState).mockResolvedValue()
  vi.mocked(readSnapshot).mockResolvedValue(null)
})

describe("a device that never connected Google", () => {
  test("converts legacy data locally, activates, and deletes only legacy data", async () => {
    seedLegacyStorage()
    const converted = convertedLegacyState()

    await migrateToV2(false)

    expect(readLocalPersistedState()).toStrictEqual(converted)
    expect(isV2Activated()).toBe(true)
    expectLegacyDataDeleted()
    expect(readDrivePersistedState).not.toHaveBeenCalled()
    expect(readSnapshot).not.toHaveBeenCalled()
  })
})

describe("a connected device", () => {
  test.each(["missing", "invalid"] as const)(
    "with %s Drive v2, pulls progress.json before converting and uploads the result",
    async status => {
      seedLegacyStorage()
      const drive =
        status === "missing"
          ? ({ status } as const)
          : ({ status, fileId: "bad" } as const)
      vi.mocked(readDrivePersistedState).mockResolvedValue(drive)
      vi.mocked(readSnapshot).mockResolvedValue({
        [StorageKeys.modulesProgress]: JSON.stringify({
          FOX: CardStatus.Unknown,
        }),
      })

      await migrateToV2(true)

      const local = readLocalPersistedState()
      expect(local?.modules.progress).toStrictEqual([
        toVersionedValue({ word: "FOX", status: CardStatus.Unknown }),
      ])
      expect(writeDrivePersistedState).toHaveBeenCalledWith(drive, local)
      expect(isV2Activated()).toBe(true)
      expectLegacyDataDeleted()
    },
  )

  test("with valid Drive v2, skips the legacy pull and merges into it", async () => {
    seedLegacyStorage()
    const driveState = withModuleProgress(convertedLegacyState(), [
      toVersionedValue({ word: "HAT", status: CardStatus.Unknown }),
      toVersionedValue({ word: "FOX", status: CardStatus.Known }, EDITED_AT),
    ])
    const drive = { status: "valid", fileId: "abc", state: driveState } as const
    vi.mocked(readDrivePersistedState).mockResolvedValue(drive)
    const expected = mergePersistedState(convertedLegacyState(), driveState)

    await migrateToV2(true)

    expect(readSnapshot).not.toHaveBeenCalled()
    expect(readLocalPersistedState()).toStrictEqual(expected)
    expect(writeDrivePersistedState).toHaveBeenCalledWith(drive, expected)
    expect(isV2Activated()).toBe(true)
  })

  test("keeps legacy data and stays inactive when the Drive read fails", async () => {
    seedLegacyStorage()
    vi.mocked(readDrivePersistedState).mockRejectedValue(new Error("offline"))

    await expect(migrateToV2(true)).rejects.toThrow("offline")

    expect(localStorage.getItem(PERSISTED_STATE_KEY)).toBeNull()
    expectNotActivated()
  })

  test("checkpoints local v2 but stays inactive when the Drive write fails", async () => {
    seedLegacyStorage()
    const converted = convertedLegacyState()
    vi.mocked(writeDrivePersistedState).mockRejectedValue(new Error("offline"))

    await expect(migrateToV2(true)).rejects.toThrow("offline")

    expect(readLocalPersistedState()).toStrictEqual(converted)
    expectNotActivated()
  })

  test("a retry resumes from the local v2 checkpoint, keeping its timestamps", async () => {
    seedLegacyStorage()
    const checkpoint = withModuleProgress(convertedLegacyState(), [
      toVersionedValue({ word: "HAT", status: CardStatus.Unknown }, EDITED_AT),
    ])
    writeLocalPersistedState(checkpoint)
    vi.mocked(readSnapshot).mockResolvedValue({
      [StorageKeys.modulesProgress]: JSON.stringify({ FOX: CardStatus.Known }),
    })

    await migrateToV2(true)

    expect(readSnapshot).not.toHaveBeenCalled()
    expect(readLocalPersistedState()).toStrictEqual(checkpoint)
    expect(writeDrivePersistedState).toHaveBeenCalledWith(
      { status: "missing" },
      checkpoint,
    )
    expect(isV2Activated()).toBe(true)
  })
})

describe("an already activated device", () => {
  test("only reruns cleanup, whether connected or not", async () => {
    await migrateToV2(false)
    const activated = readLocalPersistedState()
    localStorage.setItem(StorageKeys.quizAnswers, "{}")

    await migrateToV2(true)

    expect(readDrivePersistedState).not.toHaveBeenCalled()
    expect(readLocalPersistedState()).toStrictEqual(activated)
    expect(localStorage.getItem(StorageKeys.quizAnswers)).toBeNull()
  })
})
