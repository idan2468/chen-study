import { screen, waitFor } from "@testing-library/react"
import i18next from "i18next"
import { renderWithProviders } from "@test/render"
import { setAccessToken } from "@/utils/sync/google/googleAuth"
import { App } from "./App"

vi.mock("@react-oauth/google", () => ({
  useGoogleLogin: vi.fn(() => vi.fn()),
  hasGrantedAllScopesGoogle: vi.fn(() => true),
}))

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status })

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal("fetch", vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test("renders the hub immediately when there's no saved token", () => {
  renderWithProviders(<App importedKeyCount={null} />)

  expect(screen.getByText(i18next.t("hub.title"))).toBeInTheDocument()
})

test("shows the restore spinner then the hub when a saved token needs restoring", async () => {
  setAccessToken("ya29.token")
  vi.mocked(fetch).mockResolvedValueOnce(
    jsonResponse({ email: "chen@example.com" }),
  )

  renderWithProviders(<App importedKeyCount={null} />)

  expect(
    screen.getByLabelText(i18next.t("common.restoringSync")),
  ).toBeInTheDocument()
  expect(screen.queryByText(i18next.t("hub.title"))).not.toBeInTheDocument()

  await waitFor(() => {
    expect(screen.getByText(i18next.t("hub.title"))).toBeInTheDocument()
  })
})

test("skips the restore spinner when a sync link just won this load, even with a saved token", () => {
  setAccessToken("ya29.token")
  vi.mocked(fetch).mockResolvedValueOnce(
    jsonResponse({ email: "chen@example.com" }),
  )

  renderWithProviders(<App importedKeyCount={3} />)

  expect(screen.getByText(i18next.t("hub.title"))).toBeInTheDocument()
  expect(
    screen.queryByLabelText(i18next.t("common.restoringSync")),
  ).not.toBeInTheDocument()
})
