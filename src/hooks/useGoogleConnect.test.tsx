import { useState } from "react"
import { screen, waitFor } from "@testing-library/react"
import { useGoogleLogin } from "@react-oauth/google"
import type {
  TokenResponse,
  UseGoogleLoginOptionsImplicitFlow,
} from "@react-oauth/google"
import i18next from "i18next"
import { renderWithProviders } from "@test/render"
import { useAppSelector } from "@/store/hooks"
import { selectDyslexiaFont } from "@/store/slices/settingsSlice"
import { getAccessToken, setAccessToken } from "@/utils/sync/google/googleAuth"
import { StorageKeys } from "@/utils/sync/storageKeys"
import { useGoogleConnect } from "./useGoogleConnect"

/** Captured by the `useGoogleLogin` mock below, so tests can fire `onSuccess`/`onError` directly. */
let latestLoginOptions: UseGoogleLoginOptionsImplicitFlow | undefined
/** The mocked `login` callable itself, so tests can assert a silent re-issue was attempted. */
let latestLoginFn: ReturnType<typeof vi.fn> | undefined

vi.mock("@react-oauth/google", () => ({
  useGoogleLogin: vi.fn((options: UseGoogleLoginOptionsImplicitFlow) => {
    latestLoginOptions = options
    latestLoginFn = vi.fn()
    return latestLoginFn
  }),
  hasGrantedAllScopesGoogle: vi.fn(() => true),
}))

const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files"

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status })

const filesResponse = (files: { id: string; modifiedTime: string }[]) =>
  jsonResponse({ files })

/** `init.headers` is a `Headers` instance -- `toEqual` can't diff those, so pull the value out instead. */
const authorizationHeader = (init: RequestInit | undefined) =>
  new Headers(init?.headers).get("Authorization")

/** Simulates a successful GIS popup: `useGoogleLogin` is mocked, so `onSuccess` is called directly. */
const triggerLoginSuccess = (accessToken: string) => {
  latestLoginOptions?.onSuccess?.({
    access_token: accessToken,
  } as TokenResponse)
}

/** Simulates GIS failing to issue a token, e.g. a silent re-issue with no live session. */
const triggerLoginError = () => {
  latestLoginOptions?.onError?.({})
}

const Host = ({ skipBootSync = false }: { skipBootSync?: boolean }) => {
  const { connecting, connectedEmail, disconnect, reissueForSync } =
    useGoogleConnect(skipBootSync)
  const dyslexiaFont = useAppSelector(selectDyslexiaFont)
  const [reissueResult, setReissueResult] = useState("untried")
  return (
    <div>
      <span>{connecting ? "connecting" : "idle"}</span>
      <span>{connectedEmail ?? "signed-out"}</span>
      <span>{dyslexiaFont ? "dyslexia-on" : "dyslexia-off"}</span>
      <span>{reissueResult}</span>
      <button type="button" onClick={disconnect}>
        Disconnect
      </button>
      <button
        type="button"
        onClick={() => {
          reissueForSync(success => {
            setReissueResult(success ? "reissue-ok" : "reissue-failed")
          })
        }}
      >
        Reissue
      </button>
    </div>
  )
}

beforeEach(() => {
  localStorage.clear()
  vi.mocked(useGoogleLogin).mockClear()
  latestLoginOptions = undefined
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
  const [url, init] = vi.mocked(fetch).mock.calls[0] ?? []
  expect(url).toBe("https://www.googleapis.com/oauth2/v3/userinfo")
  expect(authorizationHeader(init)).toBe("Bearer ya29.token")
})

test("a 401 at boot triggers a silent re-issue that succeeds with a fresh token", async () => {
  setAccessToken("ya29.expired")
  vi.mocked(fetch)
    .mockResolvedValueOnce(jsonResponse({}, 401)) // boot's own fetchConnectedEmail
    .mockResolvedValueOnce(jsonResponse({ email: "chen@example.com" })) // after the re-issue
    .mockResolvedValueOnce(filesResponse([]))
    .mockResolvedValueOnce(filesResponse([]))
    .mockResolvedValueOnce(new Response(null, { status: 200 }))

  renderWithProviders(<Host />)

  await waitFor(() => {
    expect(latestLoginFn).toHaveBeenCalledWith({ prompt: "none" })
  })
  triggerLoginSuccess("ya29.refreshed")

  await waitFor(() => {
    expect(screen.getByText("chen@example.com")).toBeInTheDocument()
  })
  expect(screen.getByText("idle")).toBeInTheDocument()
  expect(getAccessToken()).toBe("ya29.refreshed")
})

test("a 401 at boot falls back to signed-out when the silent re-issue fails", async () => {
  setAccessToken("ya29.expired")
  vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({}, 401))

  renderWithProviders(<Host />)

  await waitFor(() => {
    expect(latestLoginFn).toHaveBeenCalledWith({ prompt: "none" })
  })
  triggerLoginError()

  await waitFor(() => {
    expect(screen.getByText("idle")).toBeInTheDocument()
  })
  expect(screen.getByText("signed-out")).toBeInTheDocument()
  expect(getAccessToken()).toBeNull()
})

test("a re-issue succeeding at boot still skips the Drive pull when a sync link just won", async () => {
  setAccessToken("ya29.expired")
  vi.mocked(fetch)
    .mockResolvedValueOnce(jsonResponse({}, 401))
    .mockResolvedValueOnce(jsonResponse({ email: "chen@example.com" }))

  renderWithProviders(<Host skipBootSync />)

  await waitFor(() => {
    expect(latestLoginFn).toHaveBeenCalledWith({ prompt: "none" })
  })
  triggerLoginSuccess("ya29.refreshed")

  await waitFor(() => {
    expect(screen.getByText("chen@example.com")).toBeInTheDocument()
  })
  // Only the two userinfo calls above -- no Drive calls at all.
  expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2)
})

test("a valid token at boot skips the Drive pull when a sync link just won", async () => {
  setAccessToken("ya29.token")
  vi.mocked(fetch).mockResolvedValueOnce(
    jsonResponse({ email: "chen@example.com" }),
  )

  renderWithProviders(<Host skipBootSync />)

  await waitFor(() => {
    expect(screen.getByText("chen@example.com")).toBeInTheDocument()
  })
  expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1)
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

test("connecting pulls an existing Drive snapshot and rehydrates the app", async () => {
  vi.mocked(fetch)
    .mockResolvedValueOnce(jsonResponse({ email: "chen@example.com" }))
    .mockResolvedValueOnce(
      filesResponse([{ id: "f1", modifiedTime: "2024-01-01T00:00:00.000Z" }]),
    )
    .mockResolvedValueOnce(jsonResponse({ [StorageKeys.dyslexiaFont]: "1" }))

  renderWithProviders(<Host />)
  triggerLoginSuccess("ya29.new")

  await waitFor(() => {
    expect(screen.getByText("dyslexia-on")).toBeInTheDocument()
  })
  expect(localStorage.getItem(StorageKeys.dyslexiaFont)).toBe("1")
})

test("connecting pushes the local snapshot when Drive has none yet", async () => {
  localStorage.setItem(StorageKeys.dyslexiaFont, "1")
  vi.mocked(fetch)
    .mockResolvedValueOnce(jsonResponse({ email: "chen@example.com" }))
    // `readSnapshot` and `writeSnapshot` each locate the file independently --
    // no combined primitive exists yet, so an empty Drive means two `files.list`
    // calls before the upload.
    .mockResolvedValueOnce(filesResponse([]))
    .mockResolvedValueOnce(filesResponse([]))
    .mockResolvedValueOnce(new Response(null, { status: 200 }))

  renderWithProviders(<Host />)
  triggerLoginSuccess("ya29.new")

  await waitFor(() => {
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(4)
  })
  const [url, init] = vi.mocked(fetch).mock.calls[3] ?? []
  expect(url).toBe(`${DRIVE_UPLOAD_URL}?uploadType=multipart`)
  expect(init?.body as string).toContain(
    JSON.stringify({ [StorageKeys.dyslexiaFont]: "1" }),
  )
})

test("a failed email fetch during connect shows the error notification and stays signed out", async () => {
  vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 500 }))

  renderWithProviders(<Host />)
  triggerLoginSuccess("ya29.new")

  await waitFor(() => {
    expect(
      screen.getByText(i18next.t("common.googleConnectError")),
    ).toBeInTheDocument()
  })
  expect(screen.getByText("signed-out")).toBeInTheDocument()
  // The token from this login attempt is kept regardless -- same as the
  // boot-time restore path, a later boot silently re-issues it.
  expect(getAccessToken()).toBe("ya29.new")
})

test("a Drive failure during connect shows the error notification but keeps the fetched email", async () => {
  vi.mocked(fetch)
    .mockResolvedValueOnce(jsonResponse({ email: "chen@example.com" }))
    .mockResolvedValueOnce(new Response(null, { status: 500 }))

  renderWithProviders(<Host />)
  triggerLoginSuccess("ya29.new")

  await waitFor(() => {
    expect(
      screen.getByText(i18next.t("common.googleConnectError")),
    ).toBeInTheDocument()
  })
  // The email fetch already succeeded before Drive failed -- the user still
  // looks connected, just with a toast saying the sync itself didn't land.
  expect(screen.getByText("chen@example.com")).toBeInTheDocument()
  expect(getAccessToken()).toBe("ya29.new")
})

test("an unparsable Drive snapshot is treated as none, so connecting pushes local data instead", async () => {
  localStorage.setItem(StorageKeys.dyslexiaFont, "1")
  const existingFile = { id: "f1", modifiedTime: "2024-01-01T00:00:00.000Z" }
  vi.mocked(fetch)
    .mockResolvedValueOnce(jsonResponse({ email: "chen@example.com" }))
    .mockResolvedValueOnce(filesResponse([existingFile]))
    .mockResolvedValueOnce(new Response("not json", { status: 200 }))
    .mockResolvedValueOnce(filesResponse([existingFile]))
    .mockResolvedValueOnce(new Response(null, { status: 200 }))

  renderWithProviders(<Host />)
  triggerLoginSuccess("ya29.new")

  await waitFor(() => {
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(5)
  })
  const [url, init] = vi.mocked(fetch).mock.calls[4] ?? []
  expect(url).toBe(`${DRIVE_UPLOAD_URL}/f1?uploadType=media`)
  expect(init).toMatchObject({
    method: "PATCH",
    body: JSON.stringify({ [StorageKeys.dyslexiaFont]: "1" }),
  })
})

test("reissueForSync refreshes the token and reports success, without fetching email or syncing", async () => {
  const { user } = renderWithProviders(<Host />)

  await user.click(screen.getByRole("button", { name: "Reissue" }))
  await waitFor(() => {
    expect(latestLoginFn).toHaveBeenCalledWith({ prompt: "none" })
  })
  triggerLoginSuccess("ya29.refreshed")

  await waitFor(() => {
    expect(screen.getByText("reissue-ok")).toBeInTheDocument()
  })
  expect(getAccessToken()).toBe("ya29.refreshed")
  expect(fetch).not.toHaveBeenCalled()
})

test("reissueForSync reports failure without clearing an existing token", async () => {
  setAccessToken("ya29.token")
  vi.mocked(fetch).mockResolvedValueOnce(
    jsonResponse({ email: "chen@example.com" }),
  )
  const { user } = renderWithProviders(<Host />)
  await waitFor(() => {
    expect(screen.getByText("chen@example.com")).toBeInTheDocument()
  })

  await user.click(screen.getByRole("button", { name: "Reissue" }))
  await waitFor(() => {
    expect(latestLoginFn).toHaveBeenCalledWith({ prompt: "none" })
  })
  triggerLoginError()

  await waitFor(() => {
    expect(screen.getByText("reissue-failed")).toBeInTheDocument()
  })
  expect(getAccessToken()).toBe("ya29.token")
})
