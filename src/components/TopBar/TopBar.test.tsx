import { act, fireEvent, screen, waitFor } from "@testing-library/react"
import i18next from "i18next"
import type { UseGoogleLoginOptionsImplicitFlow } from "@react-oauth/google"
import { renderWithProviders } from "@test/render"
import { GoogleConnectProvider } from "@/hooks/GoogleConnectContext"
import type * as GoogleAuthModule from "@/utils/sync/google/googleAuth"
import * as googleAuth from "@/utils/sync/google/googleAuth"
import { getAccessToken, setAccessToken } from "@/utils/sync/google/googleAuth"
import { StorageKeys } from "@/utils/sync/storageKeys"
import { TopBar } from "./TopBar"

/** Captured by the `useGoogleLogin` mock below, so tests can fire `onSuccess`/`onError` directly. */
let latestLoginOptions: UseGoogleLoginOptionsImplicitFlow | undefined
/** The mocked `login` callable itself, so tests can assert which kind of login was requested. */
let latestLoginFn: ReturnType<typeof vi.fn> | undefined

vi.mock("@react-oauth/google", () => ({
  useGoogleLogin: vi.fn((options: UseGoogleLoginOptionsImplicitFlow) => {
    latestLoginOptions = options
    latestLoginFn = vi.fn()
    return latestLoginFn
  }),
  hasGrantedAllScopesGoogle: vi.fn(() => true),
}))

vi.mock("@/utils/sync/google/googleAuth", async importOriginal => {
  const actual = await importOriginal<typeof GoogleAuthModule>()
  return { ...actual, isGoogleSyncAvailable: () => true }
})

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status })

const filesResponse = (files: { id: string; modifiedTime: string }[]) =>
  jsonResponse({ files })

const okResponse = () => new Response(null, { status: 200 })

const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files"

const renderTopBar = () =>
  renderWithProviders(
    <GoogleConnectProvider skipBootSync={false}>
      <TopBar />
    </GoogleConnectProvider>,
  )

beforeEach(() => {
  localStorage.clear()
  latestLoginOptions = undefined
  vi.stubGlobal("fetch", vi.fn())
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

test("shows a Connect button when signed out, which triggers GIS login on click", async () => {
  const { user } = renderTopBar()

  const connectButton = screen.getByRole("button", {
    name: i18next.t("common.connectGoogle"),
  })
  await user.click(connectButton)

  expect(latestLoginFn).toHaveBeenCalled()
})

test("shows the connected email and disconnects on click", async () => {
  setAccessToken("ya29.token")
  vi.mocked(fetch).mockResolvedValueOnce(
    jsonResponse({ email: "chen@example.com" }),
  )

  const { user } = renderTopBar()

  const connectedButton = await screen.findByRole("button", {
    name: i18next.t("common.googleConnected", { email: "chen@example.com" }),
  })
  await user.click(connectedButton)

  await waitFor(() => {
    expect(
      screen.getByRole("button", { name: i18next.t("common.connectGoogle") }),
    ).toBeInTheDocument()
  })
  expect(getAccessToken()).toBeNull()
})

test("hides the Google button entirely when sync is unavailable", () => {
  vi.spyOn(googleAuth, "isGoogleSyncAvailable").mockReturnValue(false)

  renderTopBar()

  expect(
    screen.queryByRole("button", { name: i18next.t("common.connectGoogle") }),
  ).not.toBeInTheDocument()
})

test("hides the Sync now button while signed out", () => {
  renderTopBar()

  expect(
    screen.queryByRole("button", { name: i18next.t("common.syncNowTooltip") }),
  ).not.toBeInTheDocument()
})

test("shows a Sync now button once connected, which pushes the local snapshot on click", async () => {
  setAccessToken("ya29.token")
  vi.mocked(fetch)
    .mockResolvedValueOnce(jsonResponse({ email: "chen@example.com" })) // boot's email fetch
    // `readSnapshot` and `writeSnapshot` each locate the file independently --
    // an empty Drive means two `files.list` calls before boot's own upload.
    .mockResolvedValueOnce(filesResponse([]))
    .mockResolvedValueOnce(filesResponse([]))
    .mockResolvedValueOnce(okResponse())

  const { user } = renderTopBar()
  const syncButton = await screen.findByRole("button", {
    name: i18next.t("common.syncNowTooltip"),
  })
  expect(fetch).toHaveBeenCalledTimes(4)

  localStorage.setItem(StorageKeys.speechRate, "1.5")
  vi.mocked(fetch)
    .mockResolvedValueOnce(filesResponse([])) // syncNow's own locate
    .mockResolvedValueOnce(okResponse()) // syncNow's own push
  await user.click(syncButton)

  await waitFor(() => {
    expect(fetch).toHaveBeenCalledTimes(6)
  })
  const [url, init] = vi.mocked(fetch).mock.calls[5] ?? []
  expect(url).toBe(`${DRIVE_UPLOAD_URL}?uploadType=multipart`)
  expect(init?.body as string).toContain(
    JSON.stringify({ [StorageKeys.speechRate]: "1.5" }),
  )
})

test("switches to tap-to-reconnect after a failed silent reissue, and tapping it starts an interactive reconnect", async () => {
  // `shouldAdvanceTime` lets fake time still tick forward on its own (so the
  // boot restore's `waitFor` polling and awaits below keep working), while
  // still letting us jump forward explicitly for the 30-second timer.
  vi.useFakeTimers({ shouldAdvanceTime: true })
  setAccessToken("ya29.token")
  vi.mocked(fetch)
    .mockResolvedValueOnce(jsonResponse({ email: "chen@example.com" }))
    .mockResolvedValueOnce(filesResponse([]))
    .mockResolvedValueOnce(filesResponse([]))
    .mockResolvedValueOnce(okResponse())

  renderTopBar()
  await waitFor(() => {
    expect(
      screen.getByRole("button", {
        name: i18next.t("common.googleConnected", {
          email: "chen@example.com",
        }),
      }),
    ).toBeInTheDocument()
  })

  // A local change after boot's baseline gives the 30-second timer something dirty to push.
  localStorage.setItem(StorageKeys.dyslexiaFont, "1")
  vi.mocked(fetch)
    .mockResolvedValueOnce(filesResponse([]))
    .mockResolvedValueOnce(new Response(null, { status: 401 }))
  await vi.advanceTimersByTimeAsync(30_000)
  expect(latestLoginFn).toHaveBeenCalledWith({ prompt: "none" })
  act(() => {
    latestLoginOptions?.onError?.({})
  })

  const reconnectButton = screen.getByRole("button", {
    name: i18next.t("common.reconnectTooltip"),
  })
  fireEvent.click(reconnectButton)

  expect(latestLoginFn).toHaveBeenLastCalledWith()
})
