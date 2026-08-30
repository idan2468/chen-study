import { screen } from "@testing-library/react"
import { renderWithProviders } from "@test/render"
import { setSpeechRate, SpeechLang } from "@/store/slices/settingsSlice"
import { StorageKeys } from "@/utils/sync/storageKeys"
import { SpeechSettingsModal } from "./SpeechSettingsModal"

beforeEach(() => {
  localStorage.clear()
})

describe("SpeechSettingsModal", () => {
  test("English and Hebrew each get their own tab with an independent speed slider", async () => {
    localStorage.setItem(StorageKeys.speechRate, "0.75")
    localStorage.setItem(StorageKeys.speechRateHe, "0.25")

    const { user } = renderWithProviders(
      <SpeechSettingsModal opened onClose={vi.fn()} />,
    )

    // English tab is the default.
    expect(await screen.findByText("Reading speed: 0.75x")).toBeInTheDocument()

    await user.click(screen.getByRole("tab", { name: "Hebrew" }))

    expect(await screen.findByText("Reading speed: 0.25x")).toBeInTheDocument()
  })

  test("changing the Hebrew speed does not affect the English speed", async () => {
    const { store, user } = renderWithProviders(
      <SpeechSettingsModal opened onClose={vi.fn()} />,
    )

    await user.click(await screen.findByRole("tab", { name: "Hebrew" }))

    store.dispatch(setSpeechRate({ lang: SpeechLang.Hebrew, rate: 0.8 }))
    expect(await screen.findByText("Reading speed: 0.80x")).toBeInTheDocument()

    await user.click(screen.getByRole("tab", { name: "English" }))
    expect(await screen.findByText("Reading speed: 0.50x")).toBeInTheDocument()
    // The Hebrew change from above must not have leaked into English.
    expect(screen.queryByText("Reading speed: 0.80x")).not.toBeInTheDocument()
  })
})
