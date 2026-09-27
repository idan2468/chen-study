import { selectPersistedState } from "@/store/persistedState"
import { makeStore } from "@/store/store"
import { StorageKeys } from "@/utils/sync/legacy/legacyStorage"
import {
  readDrivePersistedState,
  writeDrivePersistedState,
} from "./drivePersistedState"
import { GoogleAuthError } from "./googleAuth"

const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files"
const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files"

/** Mirrors the query the source builds, so assertions aren't duplicating its encoding logic by hand. */
const locateUrl = () => {
  const url = new URL(DRIVE_FILES_URL)
  url.searchParams.set("spaces", "appDataFolder")
  url.searchParams.set("q", "name='progress-v2.json'")
  url.searchParams.set("fields", "files(id,modifiedTime)")
  return url.toString()
}

const filesResponse = (files: { id: string; modifiedTime: string }[]) =>
  new Response(JSON.stringify({ files }), { status: 200 })

const textResponse = (body: string) => new Response(body, { status: 200 })

const okResponse = () => new Response(null, { status: 200 })

const fetchCall = (index: number) => {
  const [url, init] = vi.mocked(fetch).mock.calls[index] ?? []
  return { url, init }
}

const defaultState = () => selectPersistedState(makeStore().getState())

beforeEach(() => {
  localStorage.setItem(StorageKeys.googleAccessToken, "ya29.token")
  vi.stubGlobal("fetch", vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("readDrivePersistedState", () => {
  test("reports a missing progress-v2.json", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(filesResponse([]))

    await expect(readDrivePersistedState()).resolves.toStrictEqual({
      status: "missing",
    })
    expect(fetchCall(0).url).toBe(locateUrl())
  })

  test("returns the validated state from the newest duplicate", async () => {
    const state = defaultState()
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        filesResponse([
          { id: "older", modifiedTime: "2026-01-01T00:00:00.000Z" },
          { id: "newer", modifiedTime: "2026-06-01T00:00:00.000Z" },
        ]),
      )
      .mockResolvedValueOnce(textResponse(JSON.stringify(state)))

    await expect(readDrivePersistedState()).resolves.toStrictEqual({
      status: "valid",
      fileId: "newer",
      state,
    })
    expect(fetchCall(1).url).toBe(`${DRIVE_FILES_URL}/newer?alt=media`)
  })

  test.each([
    ["unparsable JSON", "{not json"],
    [
      "a newer schema version",
      JSON.stringify({ ...defaultState(), schemaVersion: 3 }),
    ],
  ])("reports %s as invalid, keeping its file ID", async (_label, body) => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        filesResponse([
          { id: "abc", modifiedTime: "2026-01-01T00:00:00.000Z" },
        ]),
      )
      .mockResolvedValueOnce(textResponse(body))

    await expect(readDrivePersistedState()).resolves.toStrictEqual({
      status: "invalid",
      fileId: "abc",
    })
  })

  test("throws GoogleAuthError on a 401", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 401 }))

    await expect(readDrivePersistedState()).rejects.toBeInstanceOf(
      GoogleAuthError,
    )
  })

  test("throws instead of calling fetch when there is no access token", async () => {
    localStorage.removeItem(StorageKeys.googleAccessToken)

    await expect(readDrivePersistedState()).rejects.toThrow(
      "No Google access token",
    )
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe("writeDrivePersistedState", () => {
  test("skips the upload when the state equals the Drive copy, whatever its key order", async () => {
    const state = defaultState()
    const reordered = {
      preferences: state.preferences,
      modules: state.modules,
      unseen: state.unseen,
      schemaVersion: state.schemaVersion,
    }

    await writeDrivePersistedState(
      { status: "valid", fileId: "abc", state },
      reordered,
    )

    expect(fetch).not.toHaveBeenCalled()
  })

  test("overwrites the file that was read, without locating it again", async () => {
    const state = defaultState()
    const changed = {
      ...state,
      preferences: {
        ...state.preferences,
        dyslexiaFont: { ...state.preferences.dyslexiaFont, value: true },
      },
    }
    vi.mocked(fetch).mockResolvedValueOnce(okResponse())

    await writeDrivePersistedState(
      { status: "valid", fileId: "abc", state },
      changed,
    )

    expect(fetch).toHaveBeenCalledOnce()
    expect(fetchCall(0).url).toBe(`${DRIVE_UPLOAD_URL}/abc?uploadType=media`)
    expect(fetchCall(0).init).toMatchObject({
      method: "PATCH",
      body: JSON.stringify(changed),
    })
  })

  test("creates progress-v2.json when Drive has none", async () => {
    const state = defaultState()
    vi.mocked(fetch).mockResolvedValueOnce(okResponse())

    await writeDrivePersistedState({ status: "missing" }, state)

    expect(fetch).toHaveBeenCalledOnce()
    const { url, init } = fetchCall(0)
    expect(url).toBe(`${DRIVE_UPLOAD_URL}?uploadType=multipart`)
    expect(init?.method).toBe("POST")
    expect(init?.body).toContain(
      JSON.stringify({ name: "progress-v2.json", parents: ["appDataFolder"] }),
    )
    expect(init?.body).toContain(JSON.stringify(state))
  })

  describe("over an invalid file", () => {
    beforeEach(() => {
      vi.useFakeTimers({ now: new Date("2026-09-27T09:00:00.000Z") })
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    test("renames it aside, then creates a fresh file", async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(okResponse())
        .mockResolvedValueOnce(okResponse())

      await writeDrivePersistedState(
        { status: "invalid", fileId: "abc" },
        defaultState(),
      )

      expect(fetchCall(0).url).toBe(`${DRIVE_FILES_URL}/abc`)
      expect(fetchCall(0).init).toMatchObject({
        method: "PATCH",
        body: JSON.stringify({
          name: "progress-v2.invalid-2026-09-27T12:00:00.000+03:00.json",
        }),
      })
      expect(fetchCall(1).url).toBe(`${DRIVE_UPLOAD_URL}?uploadType=multipart`)
    })

    test("creates nothing when the rename fails", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(null, { status: 500 }),
      )

      await expect(
        writeDrivePersistedState(
          { status: "invalid", fileId: "abc" },
          defaultState(),
        ),
      ).rejects.toThrow("Google API request failed: 500")
      expect(fetch).toHaveBeenCalledOnce()
    })
  })

  test("throws instead of calling fetch when there is no access token", async () => {
    localStorage.removeItem(StorageKeys.googleAccessToken)

    await expect(
      writeDrivePersistedState({ status: "missing" }, defaultState()),
    ).rejects.toThrow("No Google access token")
    expect(fetch).not.toHaveBeenCalled()
  })
})
