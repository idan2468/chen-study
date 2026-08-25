import { StorageKeys } from "@/utils/sync/storageKeys"
import {
  fetchConnectedEmail,
  getAccessToken,
  GoogleAuthError,
  setAccessToken,
} from "./googleAuth"

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status })

/** `init.headers` is a `Headers` instance -- `toEqual` can't diff those, so pull the value out instead. */
const authorizationHeader = (init: RequestInit | undefined) =>
  new Headers(init?.headers).get("Authorization")

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal("fetch", vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test("setAccessToken round-trips through localStorage", () => {
  setAccessToken("ya29.token")

  expect(localStorage.getItem(StorageKeys.googleAccessToken)).toBe("ya29.token")
  expect(getAccessToken()).toBe("ya29.token")
})

test("setAccessToken(null) removes the stored token", () => {
  setAccessToken("ya29.token")
  setAccessToken(null)

  expect(localStorage.getItem(StorageKeys.googleAccessToken)).toBeNull()
  expect(getAccessToken()).toBeNull()
})

test("getAccessToken is null when nothing is stored", () => {
  expect(getAccessToken()).toBeNull()
})

test("fetchConnectedEmail returns the email from userinfo", async () => {
  vi.mocked(fetch).mockResolvedValue(
    jsonResponse({ email: "chen@example.com" }),
  )

  await expect(fetchConnectedEmail("ya29.token")).resolves.toBe(
    "chen@example.com",
  )
  const [url, init] = vi.mocked(fetch).mock.calls[0] ?? []
  expect(url).toBe("https://www.googleapis.com/oauth2/v3/userinfo")
  expect(authorizationHeader(init)).toBe("Bearer ya29.token")
})

test("fetchConnectedEmail throws GoogleAuthError on a 401", async () => {
  vi.mocked(fetch).mockResolvedValue(jsonResponse({}, 401))

  await expect(fetchConnectedEmail("ya29.expired")).rejects.toBeInstanceOf(
    GoogleAuthError,
  )
})

test("fetchConnectedEmail throws on other failures", async () => {
  vi.mocked(fetch).mockResolvedValue(jsonResponse({}, 500))

  await expect(fetchConnectedEmail("ya29.token")).rejects.toThrow(
    "Google API request failed: 500",
  )
})

test("fetchConnectedEmail throws when the body has no email", async () => {
  vi.mocked(fetch).mockResolvedValue(jsonResponse({}))

  await expect(fetchConnectedEmail("ya29.token")).rejects.toThrow(
    "userinfo response did not include an email",
  )
})
