import { renderHook, screen, waitFor } from "@testing-library/react"
import i18next from "i18next"
import { renderWithProviders } from "@test/render"
import { setAccessToken } from "@/utils/sync/google/googleAuth"
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

const Consumer = () => {
  const { connectedEmail } = useGoogleConnectContext()
  return <span>{connectedEmail ?? "signed-out"}</span>
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
