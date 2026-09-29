import { DeviceStorageKeys } from "@/store/deviceStorageKeys"
import { GoogleAuthError } from "./googleAuth"
import { type SyncPayload } from "@/utils/sync/legacy/legacyStorage"
import { readSnapshot } from "./driveStore"

const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files"

/** Mirrors the query the source builds, so assertions aren't duplicating its encoding logic by hand. */
const locateUrl = () => {
  const url = new URL(DRIVE_FILES_URL)
  url.searchParams.set("spaces", "appDataFolder")
  url.searchParams.set("q", "name='progress.json'")
  url.searchParams.set("fields", "files(id,modifiedTime)")
  return url.toString()
}

const filesResponse = (files: { id: string; modifiedTime: string }[]) =>
  new Response(JSON.stringify({ files }), { status: 200 })

const textResponse = (body: string, status = 200) =>
  new Response(body, { status })

/** `init.headers` is a `Headers` instance -- `toEqual` can't diff those, so pull the value out instead. */
const authorizationHeader = (init: RequestInit | undefined) =>
  new Headers(init?.headers).get("Authorization")

const payload: SyncPayload = { english_marked_words: "{}" }

beforeEach(() => {
  localStorage.setItem(DeviceStorageKeys.googleAccessToken, "ya29.token")
  vi.stubGlobal("fetch", vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("readSnapshot", () => {
  test("returns null when Drive has no progress.json", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(filesResponse([]))

    await expect(readSnapshot()).resolves.toBeNull()
    const [url, init] = vi.mocked(fetch).mock.calls[0] ?? []
    expect(url).toBe(locateUrl())
    expect(authorizationHeader(init)).toBe("Bearer ya29.token")
  })

  test("downloads the file with the newest modifiedTime among duplicates", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        filesResponse([
          { id: "older", modifiedTime: "2024-01-01T00:00:00.000Z" },
          { id: "newer", modifiedTime: "2024-06-01T00:00:00.000Z" },
        ]),
      )
      .mockResolvedValueOnce(textResponse(JSON.stringify(payload)))

    await expect(readSnapshot()).resolves.toStrictEqual(payload)
    const [url] = vi.mocked(fetch).mock.calls[1] ?? []
    expect(url).toBe(`${DRIVE_FILES_URL}/newer?alt=media`)
  })

  test("returns null for a body that is not valid JSON", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        filesResponse([
          { id: "abc", modifiedTime: "2024-01-01T00:00:00.000Z" },
        ]),
      )
      .mockResolvedValueOnce(textResponse("not json"))

    await expect(readSnapshot()).resolves.toBeNull()
  })

  test("returns null for valid JSON that is not a string-to-string map", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        filesResponse([
          { id: "abc", modifiedTime: "2024-01-01T00:00:00.000Z" },
        ]),
      )
      .mockResolvedValueOnce(textResponse(JSON.stringify({ count: 1 })))

    await expect(readSnapshot()).resolves.toBeNull()
  })

  test("throws GoogleAuthError on a 401", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 401 }))

    await expect(readSnapshot()).rejects.toBeInstanceOf(GoogleAuthError)
  })

  test("throws a plain error on other failures", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 500 }))

    await expect(readSnapshot()).rejects.toThrow(
      "Google API request failed: 500",
    )
  })

  test("throws a plain error instead of calling fetch when there is no access token", async () => {
    localStorage.removeItem(DeviceStorageKeys.googleAccessToken)

    await expect(readSnapshot()).rejects.toThrow("No Google access token")
    expect(fetch).not.toHaveBeenCalled()
  })
})
