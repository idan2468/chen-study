import { screen, waitFor } from "@testing-library/react"
import { useGoogleLogin } from "@react-oauth/google"
import { renderWithProviders } from "@test/render"
import { getAccessToken, setAccessToken } from "@/utils/google/googleAuth"
import { useGoogleConnect } from "./useGoogleConnect"

vi.mock("@react-oauth/google", () => ({
  useGoogleLogin: vi.fn(() => vi.fn()),
  hasGrantedAllScopesGoogle: vi.fn(() => true),
}))

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status })

const Host = () => {
  const { connecting, connectedEmail, disconnect } = useGoogleConnect()
  return (
    <div>
      <span>{connecting ? "connecting" : "idle"}</span>
      <span>{connectedEmail ?? "signed-out"}</span>
      <button type="button" onClick={disconnect}>
        Disconnect
      </button>
    </div>
  )
}

beforeEach(() => {
  localStorage.clear()
  vi.mocked(useGoogleLogin).mockClear()
  vi.stubGlobal("fetch", vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test("restores the connected email from a stored token", async () => {
  setAccessToken("ya29.token")
  vi.mocked(fetch).mockResolvedValue(
    jsonResponse({ email: "chen@example.com" }),
  )

  renderWithProviders(<Host />)

  expect(screen.getByText("connecting")).toBeInTheDocument()
  await waitFor(() => {
    expect(screen.getByText("chen@example.com")).toBeInTheDocument()
  })
  expect(screen.getByText("idle")).toBeInTheDocument()
  expect(fetch).toHaveBeenCalledExactlyOnceWith(
    "https://www.googleapis.com/oauth2/v3/userinfo",
    { headers: { Authorization: "Bearer ya29.token" } },
  )
})

test("a failed userinfo restore leaves the token and stays signed out", async () => {
  setAccessToken("ya29.expired")
  vi.mocked(fetch).mockResolvedValue(jsonResponse({}, 401))

  renderWithProviders(<Host />)

  await waitFor(() => {
    expect(screen.getByText("idle")).toBeInTheDocument()
  })
  expect(screen.getByText("signed-out")).toBeInTheDocument()
  expect(getAccessToken()).toBe("ya29.expired")
})

test("disconnect clears the stored token", async () => {
  setAccessToken("ya29.token")
  vi.mocked(fetch).mockResolvedValue(
    jsonResponse({ email: "chen@example.com" }),
  )

  const { user } = renderWithProviders(<Host />)
  await waitFor(() => {
    expect(screen.getByText("chen@example.com")).toBeInTheDocument()
  })

  await user.click(screen.getByRole("button", { name: "Disconnect" }))

  expect(screen.getByText("signed-out")).toBeInTheDocument()
  expect(getAccessToken()).toBeNull()
})
