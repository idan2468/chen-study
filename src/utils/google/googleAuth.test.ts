import { StorageKeys } from "@/utils/storageKeys"
import {
  fetchConnectedEmail,
  getAccessToken,
  setAccessToken,
} from "./googleAuth"

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status })

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
  expect(fetch).toHaveBeenCalledExactlyOnceWith(
    "https://www.googleapis.com/oauth2/v3/userinfo",
    { headers: { Authorization: "Bearer ya29.token" } },
  )
})

test("fetchConnectedEmail throws when userinfo is not ok", async () => {
  vi.mocked(fetch).mockResolvedValue(jsonResponse({}, 401))

  await expect(fetchConnectedEmail("ya29.expired")).rejects.toThrow(
    "userinfo request failed: 401",
  )
})

test("fetchConnectedEmail throws when the body has no email", async () => {
  vi.mocked(fetch).mockResolvedValue(jsonResponse({}))

  await expect(fetchConnectedEmail("ya29.token")).rejects.toThrow(
    "userinfo response did not include an email",
  )
})
