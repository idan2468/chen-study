import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Provider } from "react-redux"
import {
  DirectionProvider,
  MantineProvider,
  useDirection,
  useMantineColorScheme,
} from "@mantine/core"
import { DeviceStorageKeys } from "@/store/deviceStorageKeys"
import { useAppSelector } from "@/store/hooks"
import { makeStore } from "@/store/store"
import {
  selectDyslexiaFont,
  toggleDyslexiaFont,
} from "@/store/slices/settingsSlice"
import {
  selectCurrentModuleId,
  selectModule,
} from "@/store/slices/modulesSlice"
import { colorSchemeManager, theme } from "@/theme"
import { builtInModuleIds } from "@/data/defaultModuleExercises"
import { useRehydrateFromStorage } from "@/hooks/sync/useRehydrateFromStorage"

const Host = () => {
  const rehydrate = useRehydrateFromStorage()
  const dyslexiaFont = useAppSelector(selectDyslexiaFont)
  const currentModuleId = useAppSelector(selectCurrentModuleId)
  const { colorScheme } = useMantineColorScheme()
  const { dir } = useDirection()

  return (
    <div>
      <span>{dyslexiaFont ? "dyslexia-on" : "dyslexia-off"}</span>
      <span>{currentModuleId}</span>
      <span>{colorScheme}</span>
      <span>{dir}</span>
      <button type="button" onClick={rehydrate}>
        Rehydrate
      </button>
    </div>
  )
}

const renderHost = () => {
  render(
    <Provider store={makeStore()}>
      <DirectionProvider initialDirection="ltr" detectDirection={false}>
        <MantineProvider
          theme={theme}
          colorSchemeManager={colorSchemeManager()}
          defaultColorScheme="dark"
        >
          <Host />
        </MantineProvider>
      </DirectionProvider>
    </Provider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.lang = "en"
})

test("re-reads settings, modules, locale and colour scheme from storage, discarding in-memory state", async () => {
  const user = userEvent.setup()
  renderHost()
  const secondBuiltInId = builtInModuleIds[1] ?? ""
  expect(screen.getByText("dyslexia-off")).toBeInTheDocument()
  expect(screen.getByText("dark")).toBeInTheDocument()
  expect(screen.getByText("ltr")).toBeInTheDocument()
  expect(screen.queryByText(secondBuiltInId)).not.toBeInTheDocument()

  const otherTab = makeStore()
  otherTab.dispatch(toggleDyslexiaFont())
  otherTab.dispatch(selectModule(secondBuiltInId))
  localStorage.setItem(DeviceStorageKeys.locale, "he")
  localStorage.setItem(DeviceStorageKeys.darkMode, "0")

  await user.click(screen.getByRole("button", { name: "Rehydrate" }))

  expect(screen.getByText("dyslexia-on")).toBeInTheDocument()
  expect(screen.getByText("light")).toBeInTheDocument()
  expect(screen.getByText(secondBuiltInId)).toBeInTheDocument()
  expect(document.documentElement.lang).toBe("he")
  // `detectDirection={false}` above rules out Mantine's own dir-attribute
  // MutationObserver -- this only passes if the hook calls setDirection().
  expect(screen.getByText("rtl")).toBeInTheDocument()
})
