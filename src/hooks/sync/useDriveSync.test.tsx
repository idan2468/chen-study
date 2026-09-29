import { act, fireEvent, screen, waitFor } from "@testing-library/react"
import i18next from "i18next"
import { renderWithProviders } from "@test/render"
import { syncWithDrive } from "@/utils/sync/google/driveSync"
import { GoogleAuthError } from "@/utils/sync/google/googleAuth"
import { useDriveSync } from "@/hooks/sync/useDriveSync"

vi.mock("@/utils/sync/google/driveSync")

/** Captured whenever the hook asks for a silent re-issue, so tests can settle it like GIS would. */
let pendingReissueSettled: ((success: boolean) => void) | undefined
const reissueForSync = vi.fn((onSettled: (success: boolean) => void) => {
  pendingReissueSettled = onSettled
})

const Host = ({ connected }: { connected: boolean }) => {
  const { needsReconnect, syncing, syncNow } = useDriveSync(
    connected,
    reissueForSync,
  )
  return (
    <div>
      <span>{needsReconnect ? "needs-reconnect" : "ok"}</span>
      <span>{syncing ? "syncing" : "idle"}</span>
      <button type="button" onClick={syncNow}>
        Sync now
      </button>
    </div>
  )
}

const setVisibility = (state: DocumentVisibilityState) => {
  vi.spyOn(document, "visibilityState", "get").mockReturnValue(state)
  document.dispatchEvent(new Event("visibilitychange"))
}

const clickSyncNow = () => {
  fireEvent.click(screen.getByRole("button", { name: "Sync now" }))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(syncWithDrive).mockResolvedValue()
  pendingReissueSettled = undefined
})

afterEach(() => {
  vi.useRealTimers()
})

test("syncs once the 30-second timer fires while connected", async () => {
  vi.useFakeTimers()

  renderWithProviders(<Host connected />)
  await vi.advanceTimersByTimeAsync(30_000)

  expect(syncWithDrive).toHaveBeenCalledOnce()
})

test("does not sync while not connected, even once 30 seconds elapse", async () => {
  vi.useFakeTimers()

  renderWithProviders(<Host connected={false} />)
  await vi.advanceTimersByTimeAsync(30_000)

  expect(syncWithDrive).not.toHaveBeenCalled()
})

test("syncNow syncs immediately, without waiting for the timer", async () => {
  renderWithProviders(<Host connected />)
  clickSyncNow()

  await waitFor(() => {
    expect(syncWithDrive).toHaveBeenCalledOnce()
  })
})

test("hiding the tab does not sync", async () => {
  vi.useFakeTimers()

  renderWithProviders(<Host connected />)
  setVisibility("hidden")
  await vi.advanceTimersByTimeAsync(0)

  expect(syncWithDrive).not.toHaveBeenCalled()
})

test("syncs immediately and silently when the tab becomes visible", async () => {
  renderWithProviders(<Host connected />)
  setVisibility("visible")

  await waitFor(() => {
    expect(syncWithDrive).toHaveBeenCalledOnce()
  })
  expect(
    screen.queryByText(i18next.t("common.googleSyncSuccess")),
  ).not.toBeInTheDocument()
})

test("the 30-second timer does not sync while the tab is hidden", async () => {
  vi.useFakeTimers()

  renderWithProviders(<Host connected />)
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden")
  await vi.advanceTimersByTimeAsync(30_000)

  expect(syncWithDrive).not.toHaveBeenCalled()
})

test("a 401 during syncNow triggers a silent reissue and retries the sync once it succeeds", async () => {
  vi.mocked(syncWithDrive).mockRejectedValueOnce(new GoogleAuthError())

  renderWithProviders(<Host connected />)
  clickSyncNow()
  await waitFor(() => {
    expect(reissueForSync).toHaveBeenCalledOnce()
  })
  act(() => {
    pendingReissueSettled?.(true)
  })

  await waitFor(() => {
    expect(syncWithDrive).toHaveBeenCalledTimes(2)
  })
})

test("a failed reissue sets needsReconnect", async () => {
  vi.mocked(syncWithDrive).mockRejectedValueOnce(new GoogleAuthError())

  renderWithProviders(<Host connected />)
  clickSyncNow()
  await waitFor(() => {
    expect(reissueForSync).toHaveBeenCalledOnce()
  })
  act(() => {
    pendingReissueSettled?.(false)
  })

  await waitFor(() => {
    expect(screen.getByText("needs-reconnect")).toBeInTheDocument()
  })
})

test("the timer and return-to-visible both stay paused after a failed reissue", async () => {
  vi.useFakeTimers()
  vi.mocked(syncWithDrive).mockRejectedValueOnce(new GoogleAuthError())

  renderWithProviders(<Host connected />)
  await vi.advanceTimersByTimeAsync(30_000)
  expect(reissueForSync).toHaveBeenCalledOnce()
  act(() => {
    pendingReissueSettled?.(false)
  })

  vi.mocked(syncWithDrive).mockClear()
  setVisibility("visible")
  await vi.advanceTimersByTimeAsync(30_000)

  expect(syncWithDrive).not.toHaveBeenCalled()
})

test("syncNow retries while needsReconnect is true, clearing it on success", async () => {
  vi.mocked(syncWithDrive).mockRejectedValueOnce(new GoogleAuthError())

  renderWithProviders(<Host connected />)
  clickSyncNow()
  await waitFor(() => {
    expect(reissueForSync).toHaveBeenCalledOnce()
  })
  act(() => {
    pendingReissueSettled?.(false)
  })
  await waitFor(() => {
    expect(screen.getByText("needs-reconnect")).toBeInTheDocument()
  })

  clickSyncNow()

  await waitFor(() => {
    expect(screen.getByText("ok")).toBeInTheDocument()
  })
})

test("a non-auth error during syncNow shows an error toast", async () => {
  vi.mocked(syncWithDrive).mockRejectedValueOnce(new Error("offline"))

  renderWithProviders(<Host connected />)
  clickSyncNow()

  await waitFor(() => {
    expect(
      screen.getByText(i18next.t("common.googleSyncError")),
    ).toBeInTheDocument()
  })
})

test("a non-auth error during the background timer stays silent", async () => {
  vi.useFakeTimers()
  vi.mocked(syncWithDrive).mockRejectedValueOnce(new Error("offline"))

  renderWithProviders(<Host connected />)
  await vi.advanceTimersByTimeAsync(30_000)

  expect(
    screen.queryByText(i18next.t("common.googleSyncError")),
  ).not.toBeInTheDocument()
})

test("syncing is true while a sync is in flight, and false once it settles", async () => {
  let settleSync: () => void = () => undefined
  vi.mocked(syncWithDrive).mockReturnValueOnce(
    new Promise(resolve => {
      settleSync = resolve
    }),
  )

  renderWithProviders(<Host connected />)
  clickSyncNow()
  await waitFor(() => {
    expect(screen.getByText("syncing")).toBeInTheDocument()
  })

  settleSync()

  await waitFor(() => {
    expect(screen.getByText("idle")).toBeInTheDocument()
  })
})

test("shows a success toast once a manual sync completes", async () => {
  renderWithProviders(<Host connected />)
  clickSyncNow()

  await waitFor(() => {
    expect(
      screen.getByText(i18next.t("common.googleSyncSuccess")),
    ).toBeInTheDocument()
  })
})

test("the background timer's successful sync stays silent, without a success toast", async () => {
  vi.useFakeTimers()

  renderWithProviders(<Host connected />)
  await vi.advanceTimersByTimeAsync(30_000)

  expect(
    screen.queryByText(i18next.t("common.googleSyncSuccess")),
  ).not.toBeInTheDocument()
})
