import objectHash from "object-hash"
import { GoogleAuthError } from "./googleAuth"
import { recordSynced, syncIfDirty } from "./driveSync"
import { StorageKeys } from "@/utils/sync/storageKeys"

const filesResponse = (files: { id: string; modifiedTime: string }[]) =>
  new Response(JSON.stringify({ files }), { status: 200 })

const okResponse = () => new Response(null, { status: 200 })

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem(StorageKeys.googleAccessToken, "ya29.token")
  vi.stubGlobal("fetch", vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("syncIfDirty", () => {
  test("pushes when there is no prior synced state", async () => {
    localStorage.setItem(StorageKeys.dyslexiaFont, "1")
    vi.mocked(fetch)
      .mockResolvedValueOnce(filesResponse([]))
      .mockResolvedValueOnce(okResponse())

    await syncIfDirty()

    expect(fetch).toHaveBeenCalledTimes(2)
  })

  test("is a no-op when the current payload matches the recorded synced baseline, regardless of key order", async () => {
    localStorage.setItem(StorageKeys.dyslexiaFont, "1")
    localStorage.setItem(StorageKeys.speechRate, "1.5")
    recordSynced({
      [StorageKeys.speechRate]: "1.5",
      [StorageKeys.dyslexiaFont]: "1",
    })

    await syncIfDirty()

    expect(fetch).not.toHaveBeenCalled()
  })

  test("pushes again once a synced key's value changes", async () => {
    localStorage.setItem(StorageKeys.dyslexiaFont, "1")
    recordSynced({ [StorageKeys.dyslexiaFont]: "0" })
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        filesResponse([
          { id: "abc", modifiedTime: "2024-01-01T00:00:00.000Z" },
        ]),
      )
      .mockResolvedValueOnce(okResponse())

    await syncIfDirty()

    expect(fetch).toHaveBeenCalledTimes(2)
  })

  test("does not record synced state when the push fails", async () => {
    localStorage.setItem(StorageKeys.dyslexiaFont, "1")
    vi.mocked(fetch)
      .mockResolvedValueOnce(filesResponse([]))
      .mockResolvedValueOnce(new Response(null, { status: 500 }))

    await expect(syncIfDirty()).rejects.toThrow()

    expect(localStorage.getItem(StorageKeys.googleLastSyncedHash)).toBeNull()
  })

  test("propagates a GoogleAuthError on a 401 without recording synced state", async () => {
    localStorage.setItem(StorageKeys.dyslexiaFont, "1")
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 401 }))

    await expect(syncIfDirty()).rejects.toBeInstanceOf(GoogleAuthError)
    expect(localStorage.getItem(StorageKeys.googleLastSyncedHash)).toBeNull()
  })

  test("passes keepalive through to the write request when requested", async () => {
    localStorage.setItem(StorageKeys.dyslexiaFont, "1")
    vi.mocked(fetch)
      .mockResolvedValueOnce(filesResponse([]))
      .mockResolvedValueOnce(okResponse())

    await syncIfDirty(true)

    const [, writeInit] = vi.mocked(fetch).mock.calls[1] ?? []
    expect(writeInit?.keepalive).toBe(true)
  })
})

describe("recordSynced", () => {
  test("writes the given payload's hash to storage", () => {
    const payload = { [StorageKeys.dyslexiaFont]: "1" }

    recordSynced(payload)

    expect(localStorage.getItem(StorageKeys.googleLastSyncedHash)).toBe(
      objectHash(payload),
    )
  })
})
