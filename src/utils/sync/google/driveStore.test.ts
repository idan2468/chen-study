import { GoogleAuthError } from "./googleAuth"
import type { SyncPayload } from "@/types/schemas/syncPayload"
import { readSnapshot, writeSnapshot } from "./driveStore"

const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files"
const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files"

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

const okResponse = () => new Response(null, { status: 200 })

/** `init.headers` is a `Headers` instance -- `toEqual` can't diff those, so pull the value out instead. */
const authorizationHeader = (init: RequestInit | undefined) =>
  new Headers(init?.headers).get("Authorization")

const payload: SyncPayload = { english_marked_words: "{}" }

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("readSnapshot", () => {
  test("returns null when Drive has no progress.json", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(filesResponse([]))

    await expect(readSnapshot("ya29.token")).resolves.toBeNull()
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

    await expect(readSnapshot("ya29.token")).resolves.toStrictEqual(payload)
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

    await expect(readSnapshot("ya29.token")).resolves.toBeNull()
  })

  test("returns null for valid JSON that is not a string-to-string map", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        filesResponse([
          { id: "abc", modifiedTime: "2024-01-01T00:00:00.000Z" },
        ]),
      )
      .mockResolvedValueOnce(textResponse(JSON.stringify({ count: 1 })))

    await expect(readSnapshot("ya29.token")).resolves.toBeNull()
  })

  test("throws GoogleAuthError on a 401", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 401 }))

    await expect(readSnapshot("ya29.expired")).rejects.toBeInstanceOf(
      GoogleAuthError,
    )
  })

  test("throws a plain error on other failures", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 500 }))

    await expect(readSnapshot("ya29.token")).rejects.toThrow(
      "Google API request failed: 500",
    )
  })
})

describe("writeSnapshot", () => {
  test("creates the file with a multipart upload when none exists", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(filesResponse([]))
      .mockResolvedValueOnce(okResponse())

    await writeSnapshot("ya29.token", payload)

    const [url, init] = vi.mocked(fetch).mock.calls[1] ?? []
    expect(url).toBe(`${DRIVE_UPLOAD_URL}?uploadType=multipart`)
    expect(init).toMatchObject({ method: "POST" })
    const form = init?.body as FormData
    const metadata: unknown = JSON.parse(
      await (form.get("metadata") as Blob).text(),
    )
    expect(metadata).toStrictEqual({
      name: "progress.json",
      parents: ["appDataFolder"],
    })
    expect(await (form.get("file") as Blob).text()).toBe(
      JSON.stringify(payload),
    )
  })

  test("overwrites the existing file with a media PATCH", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        filesResponse([
          { id: "abc", modifiedTime: "2024-01-01T00:00:00.000Z" },
        ]),
      )
      .mockResolvedValueOnce(okResponse())

    await writeSnapshot("ya29.token", payload)

    const [url, init] = vi.mocked(fetch).mock.calls[1] ?? []
    expect(url).toBe(`${DRIVE_UPLOAD_URL}/abc?uploadType=media`)
    expect(init).toMatchObject({
      method: "PATCH",
      body: JSON.stringify(payload),
    })
  })
})
