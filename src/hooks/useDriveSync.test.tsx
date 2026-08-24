import { act, fireEvent, screen, waitFor } from "@testing-library/react"
import i18next from "i18next"
import { renderWithProviders } from "@test/render"
import { setAccessToken } from "@/utils/sync/google/googleAuth"
import { StorageKeys } from "@/utils/sync/storageKeys"
import { useDriveSync } from "./useDriveSync"

const filesResponse = (files: { id: string; modifiedTime: string }[]) =>
  new Response(JSON.stringify({ files }), { status: 200 })

const okResponse = () => new Response(null, { status: 200 })

/** Captured whenever the hook asks for a silent re-issue, so tests can settle it like GIS would. */
let pendingReissueSettled: ((success: boolean) => void) | undefined
const reissueForSync = vi.fn((onSettled: (success: boolean) => void) => {
  pendingReissueSettled = onSettled
})

const Host = ({ connected }: { connected: boolean }) => {
  const { needsReconnect, syncNow } = useDriveSync(connected, reissueForSync)
  return (
    <div>
      <span>{needsReconnect ? "needs-reconnect" : "ok"}</span>
      <button type="button" onClick={syncNow}>
        Sync now
      </button>
    </div>
  )
}

beforeEach(() => {
  localStorage.clear()
  setAccessToken("ya29.token")
  vi.stubGlobal("fetch", vi.fn())
  reissueForSync.mockClear()
  pendingReissueSettled = undefined
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

test("pushes once the 30-second timer fires while connected", async () => {
  vi.useFakeTimers()
  localStorage.setItem(StorageKeys.dyslexiaFont, "1")
  vi.mocked(fetch)
    .mockResolvedValueOnce(filesResponse([]))
    .mockResolvedValueOnce(okResponse())

  renderWithProviders(<Host connected />)
  await vi.advanceTimersByTimeAsync(30_000)

  expect(fetch).toHaveBeenCalledTimes(2)
})

test("does not push while not connected, even once 30 seconds elapse", async () => {
  vi.useFakeTimers()
  localStorage.setItem(StorageKeys.dyslexiaFont, "1")

  renderWithProviders(<Host connected={false} />)
  await vi.advanceTimersByTimeAsync(30_000)

  expect(fetch).not.toHaveBeenCalled()
})

test("syncNow pushes immediately, without waiting for the timer", async () => {
  localStorage.setItem(StorageKeys.dyslexiaFont, "1")
  vi.mocked(fetch)
    .mockResolvedValueOnce(filesResponse([]))
    .mockResolvedValueOnce(okResponse())

  renderWithProviders(<Host connected />)
  fireEvent.click(screen.getByRole("button", { name: "Sync now" }))

  await waitFor(() => {
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})

test("pushes with keepalive when the tab becomes hidden", async () => {
  localStorage.setItem(StorageKeys.dyslexiaFont, "1")
  vi.mocked(fetch)
    .mockResolvedValueOnce(filesResponse([]))
    .mockResolvedValueOnce(okResponse())

  renderWithProviders(<Host connected />)
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden")
  document.dispatchEvent(new Event("visibilitychange"))

  await waitFor(() => {
    expect(fetch).toHaveBeenCalledTimes(2)
  })
  const [, writeInit] = vi.mocked(fetch).mock.calls[1] ?? []
  expect(writeInit?.keepalive).toBe(true)
})

test("does not push when the tab becomes visible -- only hiding it is a trigger", async () => {
  localStorage.setItem(StorageKeys.dyslexiaFont, "1")

  renderWithProviders(<Host connected />)
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible")
  document.dispatchEvent(new Event("visibilitychange"))

  await new Promise(resolve => setTimeout(resolve, 0))
  expect(fetch).not.toHaveBeenCalled()
})

test("the 30-second timer keeps pushing after the tab goes hidden, independent of the immediate hide-triggered push", async () => {
  vi.useFakeTimers()
  localStorage.setItem(StorageKeys.dyslexiaFont, "1")
  vi.mocked(fetch)
    .mockResolvedValueOnce(filesResponse([]))
    .mockResolvedValueOnce(okResponse())

  renderWithProviders(<Host connected />)
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden")
  document.dispatchEvent(new Event("visibilitychange"))
  await vi.advanceTimersByTimeAsync(0)
  expect(fetch).toHaveBeenCalledTimes(2)

  // A later change, still hidden, gives the next tick something dirty to push.
  localStorage.setItem(StorageKeys.speechRate, "1.5")
  vi.mocked(fetch)
    .mockResolvedValueOnce(filesResponse([]))
    .mockResolvedValueOnce(okResponse())
  await vi.advanceTimersByTimeAsync(30_000)

  expect(fetch).toHaveBeenCalledTimes(4)
})

test("a 401 during syncNow triggers a silent reissue and retries the push once it succeeds", async () => {
  localStorage.setItem(StorageKeys.dyslexiaFont, "1")
  vi.mocked(fetch)
    .mockResolvedValueOnce(filesResponse([]))
    .mockResolvedValueOnce(new Response(null, { status: 401 }))
    .mockResolvedValueOnce(filesResponse([]))
    .mockResolvedValueOnce(okResponse())

  renderWithProviders(<Host connected />)
  fireEvent.click(screen.getByRole("button", { name: "Sync now" }))
  await waitFor(() => {
    expect(reissueForSync).toHaveBeenCalledTimes(1)
  })
  act(() => {
    pendingReissueSettled?.(true)
  })

  await waitFor(() => {
    expect(fetch).toHaveBeenCalledTimes(4)
  })
})

test("a failed reissue sets needsReconnect", async () => {
  localStorage.setItem(StorageKeys.dyslexiaFont, "1")
  vi.mocked(fetch)
    .mockResolvedValueOnce(filesResponse([]))
    .mockResolvedValueOnce(new Response(null, { status: 401 }))

  renderWithProviders(<Host connected />)
  fireEvent.click(screen.getByRole("button", { name: "Sync now" }))
  await waitFor(() => {
    expect(reissueForSync).toHaveBeenCalledTimes(1)
  })
  act(() => {
    pendingReissueSettled?.(false)
  })

  await waitFor(() => {
    expect(screen.getByText("needs-reconnect")).toBeInTheDocument()
  })
})

test("the background timer pauses once needsReconnect is set", async () => {
  vi.useFakeTimers()
  localStorage.setItem(StorageKeys.dyslexiaFont, "1")
  vi.mocked(fetch)
    .mockResolvedValueOnce(filesResponse([]))
    .mockResolvedValueOnce(new Response(null, { status: 401 }))

  renderWithProviders(<Host connected />)
  await vi.advanceTimersByTimeAsync(30_000)
  expect(reissueForSync).toHaveBeenCalledTimes(1)
  act(() => {
    pendingReissueSettled?.(false)
  })

  vi.mocked(fetch).mockClear()
  await vi.advanceTimersByTimeAsync(30_000)

  expect(fetch).not.toHaveBeenCalled()
})

test("the background timer and page-hide push both stay paused after a failed reissue, even while the tab is hidden", async () => {
  vi.useFakeTimers()
  localStorage.setItem(StorageKeys.dyslexiaFont, "1")
  vi.mocked(fetch)
    .mockResolvedValueOnce(filesResponse([]))
    .mockResolvedValueOnce(new Response(null, { status: 401 }))

  renderWithProviders(<Host connected />)
  await vi.advanceTimersByTimeAsync(30_000)
  expect(reissueForSync).toHaveBeenCalledTimes(1)
  act(() => {
    pendingReissueSettled?.(false)
  })

  vi.mocked(fetch).mockClear()
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden")
  document.dispatchEvent(new Event("visibilitychange"))
  await vi.advanceTimersByTimeAsync(30_000)

  expect(fetch).not.toHaveBeenCalled()
})

test("syncNow retries the reissue path while needsReconnect is true, clearing it on success", async () => {
  localStorage.setItem(StorageKeys.dyslexiaFont, "1")
  vi.mocked(fetch)
    .mockResolvedValueOnce(filesResponse([]))
    .mockResolvedValueOnce(new Response(null, { status: 401 }))

  renderWithProviders(<Host connected />)
  fireEvent.click(screen.getByRole("button", { name: "Sync now" }))
  await waitFor(() => {
    expect(reissueForSync).toHaveBeenCalledTimes(1)
  })
  act(() => {
    pendingReissueSettled?.(false)
  })
  await waitFor(() => {
    expect(screen.getByText("needs-reconnect")).toBeInTheDocument()
  })

  vi.mocked(fetch)
    .mockResolvedValueOnce(filesResponse([]))
    .mockResolvedValueOnce(okResponse())
  fireEvent.click(screen.getByRole("button", { name: "Sync now" }))

  await waitFor(() => {
    expect(screen.getByText("ok")).toBeInTheDocument()
  })
})

test("a non-auth error during syncNow shows an error toast", async () => {
  localStorage.setItem(StorageKeys.dyslexiaFont, "1")
  vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 500 }))

  renderWithProviders(<Host connected />)
  fireEvent.click(screen.getByRole("button", { name: "Sync now" }))

  await waitFor(() => {
    expect(
      screen.getByText(i18next.t("common.googleSyncError")),
    ).toBeInTheDocument()
  })
})

test("a non-auth error during the background timer stays silent", async () => {
  vi.useFakeTimers()
  localStorage.setItem(StorageKeys.dyslexiaFont, "1")
  vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 500 }))

  renderWithProviders(<Host connected />)
  await vi.advanceTimersByTimeAsync(30_000)

  expect(
    screen.queryByText(i18next.t("common.googleSyncError")),
  ).not.toBeInTheDocument()
})
