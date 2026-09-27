import {
  readLocalPersistedState,
  selectPersistedState,
} from "@/store/persistedState"
import { makeStore } from "@/store/store"
import type { PersistedState } from "@/types/schemas/persistedState"
import { isV2Activated, migrateToV2 } from "@/utils/sync/legacy/migrateToV2"
import { toVersionedValue } from "@/utils/sync/versionedValue"
import {
  readDrivePersistedState,
  writeDrivePersistedState,
} from "./drivePersistedState"
import { syncWithDrive } from "./driveSync"

vi.mock("./drivePersistedState")
vi.mock("@/utils/sync/legacy/migrateToV2")

const EDITED_AT = "2026-09-27T10:00:00.000+03:00"

const localState = () => selectPersistedState(makeStore().getState())

const withDyslexiaFont = (
  state: PersistedState,
  value: boolean,
): PersistedState => ({
  ...state,
  preferences: {
    ...state.preferences,
    dyslexiaFont: toVersionedValue(value, EDITED_AT),
  },
})

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  vi.mocked(isV2Activated).mockReturnValue(true)
  vi.mocked(readDrivePersistedState).mockResolvedValue({ status: "missing" })
  vi.mocked(writeDrivePersistedState).mockResolvedValue()
  vi.mocked(migrateToV2).mockResolvedValue()
})

test("an unactivated device migrates, reloads, and skips the v2 sync", async () => {
  vi.mocked(isV2Activated).mockReturnValue(false)
  const reloadApp = vi.fn()

  await syncWithDrive(localState, reloadApp)

  expect(migrateToV2).toHaveBeenCalledWith(true)
  expect(reloadApp).toHaveBeenCalledOnce()
  expect(readDrivePersistedState).not.toHaveBeenCalled()
})

test("uploads local state as-is when Drive has none, without reloading", async () => {
  const local = localState()
  const reloadApp = vi.fn()

  await syncWithDrive(() => local, reloadApp)

  expect(writeDrivePersistedState).toHaveBeenCalledWith(
    { status: "missing" },
    local,
  )
  expect(reloadApp).not.toHaveBeenCalled()
  expect(readLocalPersistedState()).toBeNull()
})

test("applies newer Drive changes locally, then uploads the merge", async () => {
  const local = localState()
  const drive = {
    status: "valid",
    fileId: "abc",
    state: withDyslexiaFont(local, true),
  } as const
  vi.mocked(readDrivePersistedState).mockResolvedValue(drive)
  const reloadApp = vi.fn()

  await syncWithDrive(() => local, reloadApp)

  expect(readLocalPersistedState()).toStrictEqual(drive.state)
  expect(reloadApp).toHaveBeenCalledOnce()
  expect(writeDrivePersistedState).toHaveBeenCalledWith(drive, drive.state)
})

test("reads local state only after the Drive read, so in-flight edits are merged", async () => {
  const beforeRead = localState()
  const editedDuringRead = withDyslexiaFont(beforeRead, true)
  let current = beforeRead
  vi.mocked(readDrivePersistedState).mockImplementation(() => {
    current = editedDuringRead
    return Promise.resolve({
      status: "valid",
      fileId: "abc",
      state: beforeRead,
    })
  })

  await syncWithDrive(() => current, vi.fn())

  expect(writeDrivePersistedState).toHaveBeenCalledWith(
    expect.anything(),
    editedDuringRead,
  )
})

test("a failed Drive read changes nothing locally", async () => {
  vi.mocked(readDrivePersistedState).mockRejectedValue(new Error("offline"))
  const reloadApp = vi.fn()

  await expect(syncWithDrive(localState, reloadApp)).rejects.toThrow("offline")

  expect(reloadApp).not.toHaveBeenCalled()
  expect(writeDrivePersistedState).not.toHaveBeenCalled()
})

test("a sync started while one is running shares it instead of reading Drive again", async () => {
  const local = localState()

  await Promise.all([
    syncWithDrive(() => local, vi.fn()),
    syncWithDrive(() => local, vi.fn()),
  ])
  await syncWithDrive(() => local, vi.fn())

  expect(readDrivePersistedState).toHaveBeenCalledTimes(2)
})
