import { renderHook, screen, waitFor } from "@testing-library/react"
import i18next from "i18next"
import { renderWithProviders } from "@test/render"
import { setAccessToken } from "@/utils/sync/google/googleAuth"
import { StorageKeys } from "@/utils/sync/storageKeys"
import {
  GoogleConnectProvider,
  useGoogleConnectContext,
} from "./GoogleConnectContext"

vi.mock("@react-oauth/google", () => ({
  useGoogleLogin: vi.fn(() => vi.fn()),
  hasGrantedAllScopesGoogle: vi.fn(() => true),
}))

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status })

const filesResponse = (files: { id: string; modifiedTime: string }[]) =>
  jsonResponse({ files })

const okResponse = () => new Response(null, { status: 200 })

const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files"

const Consumer = () => {
  const { connectedEmail, needsReconnect, syncNow } = useGoogleConnectContext()
  return (
    <div>
      <span>{connectedEmail ?? "signed-out"}</span>
      <span>{needsReconnect ? "needs-reconnect" : "ok"}</span>
      <button type="button" onClick={syncNow}>
        Sync now
      </button>
    </div>
  )
}

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal("fetch", vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test("renders children immediately with no saved token", () => {
  renderWithProviders(
    <GoogleConnectProvider skipBootSync={false}>
      <Consumer />
    </GoogleConnectProvider>,
  )

  expect(screen.getByText("signed-out")).toBeInTheDocument()
})

test("renders a spinner while a saved token is being restored, then swaps to children", async () => {
  setAccessToken("ya29.token")
  const existingFile = { id: "f1", modifiedTime: "2024-01-01T00:00:00.000Z" }
  vi.mocked(fetch)
    .mockResolvedValueOnce(jsonResponse({ email: "chen@example.com" }))
    .mockResolvedValueOnce(filesResponse([existingFile]))
    .mockResolvedValueOnce(jsonResponse({}))

  renderWithProviders(
    <GoogleConnectProvider skipBootSync={false}>
      <Consumer />
    </GoogleConnectProvider>,
  )

  expect(
    screen.getByLabelText(i18next.t("common.restoringSync")),
  ).toBeInTheDocument()
  expect(screen.queryByText("signed-out")).not.toBeInTheDocument()

  await waitFor(() => {
    expect(screen.getByText("chen@example.com")).toBeInTheDocument()
  })
})

test("skips the spinner when a sync link just won this load, even with a saved token", () => {
  setAccessToken("ya29.token")
  vi.mocked(fetch).mockResolvedValueOnce(
    jsonResponse({ email: "chen@example.com" }),
  )

  renderWithProviders(
    <GoogleConnectProvider skipBootSync>
      <Consumer />
    </GoogleConnectProvider>,
  )

  expect(screen.getByText("signed-out")).toBeInTheDocument()
})

test("useGoogleConnectContext throws when used outside the provider", () => {
  expect(() => renderHook(() => useGoogleConnectContext())).toThrow(
    "useGoogleConnectContext must be used within a GoogleConnectProvider",
  )
})

test("exposes syncNow, wired to useDriveSync and gated on being connected", async () => {
  setAccessToken("ya29.token")
  vi.mocked(fetch)
    .mockResolvedValueOnce(jsonResponse({ email: "chen@example.com" })) // boot's email fetch
    // `readSnapshot` and `writeSnapshot` each locate the file independently --
    // an empty Drive means two `files.list` calls before boot's own upload.
    .mockResolvedValueOnce(filesResponse([]))
    .mockResolvedValueOnce(filesResponse([]))
    .mockResolvedValueOnce(okResponse())

  const { user } = renderWithProviders(
    <GoogleConnectProvider skipBootSync={false}>
      <Consumer />
    </GoogleConnectProvider>,
  )
  await waitFor(() => {
    expect(screen.getByText("chen@example.com")).toBeInTheDocument()
  })
  expect(fetch).toHaveBeenCalledTimes(4)

  localStorage.setItem(StorageKeys.dyslexiaFont, "1")
  vi.mocked(fetch)
    .mockResolvedValueOnce(filesResponse([])) // syncNow's own locate
    .mockResolvedValueOnce(okResponse()) // syncNow's own push
  await user.click(screen.getByRole("button", { name: "Sync now" }))

  await waitFor(() => {
    expect(fetch).toHaveBeenCalledTimes(6)
  })
  const [url, init] = vi.mocked(fetch).mock.calls[5] ?? []
  expect(url).toBe(`${DRIVE_UPLOAD_URL}?uploadType=multipart`)
  expect(init?.body as string).toContain(
    JSON.stringify({ [StorageKeys.dyslexiaFont]: "1" }),
  )
})
