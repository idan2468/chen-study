import { screen, waitFor } from "@testing-library/react"
import i18next from "i18next"
import { renderWithProviders } from "@test/render"
import { GoogleConnectProvider } from "@/hooks/GoogleConnectContext"
import type * as GoogleAuthModule from "@/utils/sync/google/googleAuth"
import * as googleAuth from "@/utils/sync/google/googleAuth"
import { getAccessToken, setAccessToken } from "@/utils/sync/google/googleAuth"
import { TopBar } from "./TopBar"

let latestLogin: ReturnType<typeof vi.fn> | undefined

vi.mock("@react-oauth/google", () => ({
  useGoogleLogin: vi.fn(() => {
    latestLogin = vi.fn()
    return latestLogin
  }),
  hasGrantedAllScopesGoogle: vi.fn(() => true),
}))

vi.mock("@/utils/sync/google/googleAuth", async importOriginal => {
  const actual = await importOriginal<typeof GoogleAuthModule>()
  return { ...actual, isGoogleSyncAvailable: () => true }
})

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status })

const renderTopBar = () =>
  renderWithProviders(
    <GoogleConnectProvider skipBootSync={false}>
      <TopBar />
    </GoogleConnectProvider>,
  )

beforeEach(() => {
  localStorage.clear()
  latestLogin = undefined
  vi.stubGlobal("fetch", vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test("shows a Connect button when signed out, which triggers GIS login on click", async () => {
  const { user } = renderTopBar()

  const connectButton = screen.getByRole("button", {
    name: i18next.t("common.connectGoogle"),
  })
  await user.click(connectButton)

  expect(latestLogin).toHaveBeenCalled()
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
