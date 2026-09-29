import { useState } from "react"
import { screen, waitFor } from "@testing-library/react"
import { useGoogleLogin } from "@react-oauth/google"
import type {
  TokenResponse,
  UseGoogleLoginOptionsImplicitFlow,
} from "@react-oauth/google"
import i18next from "i18next"
import { storeTestLocale } from "@test/helpers"
import { renderWithProviders } from "@test/render"
import { useAppSelector } from "@/store/hooks"
import { selectDyslexiaFont } from "@/store/slices/settingsSlice"
import { getAccessToken, setAccessToken } from "@/utils/sync/google/googleAuth"
import {
  readLocalPersistedState,
  selectPersistedState,
} from "@/store/persistedState"
import { makeStore } from "@/store/store"
import type { PersistedState } from "@/types/schemas/persistedState"
import { V2_ACTIVATED_KEY } from "@/utils/sync/legacy/migrateToV2"
import { toVersionedValue } from "@/utils/sync/versionedValue"
import { useGoogleConnect } from "./useGoogleConnect"

/** Captured by the `useGoogleLogin` mock below, so tests can fire `onSuccess`/`onError` directly. */
let latestLoginOptions: UseGoogleLoginOptionsImplicitFlow | undefined
/**
 * The mocked `login` callable, kept as one stable spy across re-renders (like
 * the real hook's memoized callback) -- a fresh mock per render would drift
 * out of sync with whichever render's closure a background retry actually
 * calls, e.g. once a boot restore's own `setConnectedEmail` triggers a
 * re-render before its Drive call rejects.
 */
const latestLoginFn = vi.fn()

vi.mock("@react-oauth/google", () => ({
  useGoogleLogin: vi.fn((options: UseGoogleLoginOptionsImplicitFlow) => {
    latestLoginOptions = options
    return latestLoginFn
  }),
  hasGrantedAllScopesGoogle: vi.fn(() => true),
}))

const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files"

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status })

const filesResponse = (files: { id: string; modifiedTime: string }[]) =>
  jsonResponse({ files })

const withDyslexiaFont = (value: boolean): PersistedState => {
  const state = selectPersistedState(makeStore().getState())
  return {
    ...state,
    preferences: {
      ...state.preferences,
      dyslexiaFont: toVersionedValue(value, "2026-09-27T10:00:00.000+03:00"),
    },
  }
}

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

/** Simulates a popup/ad blocker preventing GIS's popup from opening at all. */
const triggerPopupBlocked = () => {
  latestLoginOptions?.onNonOAuthError?.({ type: "popup_failed_to_open" })
}

const Host = () => {
  const { connecting, connectedEmail, disconnect, reissueForSync } =
    useGoogleConnect()
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
  storeTestLocale()
  vi.mocked(useGoogleLogin).mockClear()
  latestLoginFn.mockClear()
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
  // Surfaced even though the user didn't trigger this reconnect attempt --
  // otherwise sync silently stops until they notice the Google button looks disconnected.
  expect(
    screen.getByText(i18next.t("common.googleReconnectNeeded")),
  ).toBeInTheDocument()
})

test("a 401 from the Drive pull (after the email fetch already succeeded) also falls back to signed-out when the re-issue fails", async () => {
  setAccessToken("ya29.expired")
  vi.mocked(fetch)
    .mockResolvedValueOnce(jsonResponse({ email: "chen@example.com" })) // boot's email fetch succeeds
    .mockResolvedValueOnce(jsonResponse({}, 401)) // then the Drive pull itself 401s

  renderWithProviders(<Host />)

  await waitFor(() => {
    expect(screen.getByText("chen@example.com")).toBeInTheDocument()
  })
  await waitFor(() => {
    expect(latestLoginFn).toHaveBeenCalledWith({ prompt: "none" })
  })
  triggerLoginError()

  await waitFor(() => {
    expect(screen.getByText("idle")).toBeInTheDocument()
  })
  // The already-fetched email must not linger once the token is gone --
  // otherwise the UI looks connected while every subsequent Drive call fails.
  expect(screen.getByText("signed-out")).toBeInTheDocument()
  expect(getAccessToken()).toBeNull()
})

test("a 401 at boot falls back to signed-out when the silent re-issue's popup is blocked", async () => {
  setAccessToken("ya29.expired")
  vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({}, 401))

  renderWithProviders(<Host />)

  await waitFor(() => {
    expect(latestLoginFn).toHaveBeenCalledWith({ prompt: "none" })
  })
  triggerPopupBlocked()

  await waitFor(() => {
    expect(screen.getByText("idle")).toBeInTheDocument()
  })
  expect(screen.getByText("signed-out")).toBeInTheDocument()
  expect(getAccessToken()).toBeNull()
  expect(
    screen.getByText(i18next.t("common.googleReconnectNeeded")),
  ).toBeInTheDocument()
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

test("connecting merges newer Drive v2 changes and rehydrates the app", async () => {
  localStorage.setItem(V2_ACTIVATED_KEY, "1")
  const driveState = withDyslexiaFont(true)
  vi.mocked(fetch)
    .mockResolvedValueOnce(jsonResponse({ email: "chen@example.com" }))
    .mockResolvedValueOnce(
      filesResponse([{ id: "f1", modifiedTime: "2026-01-01T00:00:00.000Z" }]),
    )
    .mockResolvedValueOnce(jsonResponse(driveState))

  renderWithProviders(<Host />)
  triggerLoginSuccess("ya29.new")

  await waitFor(() => {
    expect(screen.getByText("dyslexia-on")).toBeInTheDocument()
  })
  expect(readLocalPersistedState()).toStrictEqual(driveState)
  // Drive already holds the merged state, so nothing is uploaded.
  expect(fetch).toHaveBeenCalledTimes(3)
})

test("connecting uploads local state when Drive has no v2 yet", async () => {
  localStorage.setItem(V2_ACTIVATED_KEY, "1")
  vi.mocked(fetch)
    .mockResolvedValueOnce(jsonResponse({ email: "chen@example.com" }))
    .mockResolvedValueOnce(filesResponse([]))
    .mockResolvedValueOnce(new Response(null, { status: 200 }))

  renderWithProviders(<Host />)
  triggerLoginSuccess("ya29.new")

  await waitFor(() => {
    expect(fetch).toHaveBeenCalledTimes(3)
  })
  const [url, init] = vi.mocked(fetch).mock.calls[2] ?? []
  expect(url).toBe(`${DRIVE_UPLOAD_URL}?uploadType=multipart`)
  expect(init?.body as string).toContain('"name":"progress-v2.json"')
})

test("connecting an unactivated device migrates it and creates Drive v2", async () => {
  vi.mocked(fetch)
    .mockResolvedValueOnce(jsonResponse({ email: "chen@example.com" }))
    .mockResolvedValueOnce(filesResponse([])) // progress-v2.json
    .mockResolvedValueOnce(filesResponse([])) // legacy progress.json
    .mockResolvedValueOnce(new Response(null, { status: 200 }))

  renderWithProviders(<Host />)
  triggerLoginSuccess("ya29.new")

  await waitFor(() => {
    expect(localStorage.getItem(V2_ACTIVATED_KEY)).toBe("1")
  })
  const [url] = vi.mocked(fetch).mock.calls[3] ?? []
  expect(url).toBe(`${DRIVE_UPLOAD_URL}?uploadType=multipart`)
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

test("an invalid Drive v2 file is renamed aside, not overwritten", async () => {
  localStorage.setItem(V2_ACTIVATED_KEY, "1")
  vi.mocked(fetch)
    .mockResolvedValueOnce(jsonResponse({ email: "chen@example.com" }))
    .mockResolvedValueOnce(
      filesResponse([{ id: "f1", modifiedTime: "2026-01-01T00:00:00.000Z" }]),
    )
    .mockResolvedValueOnce(new Response("not json", { status: 200 }))
    .mockResolvedValueOnce(new Response(null, { status: 200 }))
    .mockResolvedValueOnce(new Response(null, { status: 200 }))

  renderWithProviders(<Host />)
  triggerLoginSuccess("ya29.new")

  await waitFor(() => {
    expect(fetch).toHaveBeenCalledTimes(5)
  })
  const [renameUrl, renameInit] = vi.mocked(fetch).mock.calls[3] ?? []
  expect(renameUrl).toBe("https://www.googleapis.com/drive/v3/files/f1")
  expect(renameInit?.body as string).toMatch(
    /progress-v2\.invalid-.+\.json\.bck/,
  )
  const [createUrl] = vi.mocked(fetch).mock.calls[4] ?? []
  expect(createUrl).toBe(`${DRIVE_UPLOAD_URL}?uploadType=multipart`)
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

test("reissueForSync reports failure without clearing an existing token when the popup is blocked", async () => {
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
  triggerPopupBlocked()

  await waitFor(() => {
    expect(screen.getByText("reissue-failed")).toBeInTheDocument()
  })
  expect(getAccessToken()).toBe("ya29.token")
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

describe("connect failure debug info", () => {
  const copyDebugInfo = async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    })
    const button = await screen.findByRole("button", {
      name: i18next.t("common.copyDebugInfo"),
    })
    button.click()
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1)
    })
    return String(writeText.mock.calls[0]?.[0])
  }

  test("a blocked popup offers the GIS error for copying", async () => {
    renderWithProviders(<Host />)
    triggerPopupBlocked()

    const debugInfo = JSON.parse(await copyDebugInfo()) as Record<
      string,
      unknown
    >
    expect(debugInfo).toMatchObject({
      stage: "login",
      detail: { type: "popup_failed_to_open" },
    })
  })

  test("a failed sync offers the thrown error, without the access token", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 500 }))
    renderWithProviders(<Host />)
    triggerLoginSuccess("ya29.secret")

    const debugInfo = await copyDebugInfo()
    expect(JSON.parse(debugInfo)).toMatchObject({
      stage: "connect",
      detail: { message: "Google API request failed: 500" },
    })
    expect(debugInfo).not.toContain("ya29.secret")
  })
})
