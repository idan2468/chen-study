import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Provider } from "react-redux"
import {
  DirectionProvider,
  MantineProvider,
  useDirection,
  useMantineColorScheme,
} from "@mantine/core"
import { useAppSelector } from "@/store/hooks"
import { makeStore } from "@/store/store"
import { selectDyslexiaFont } from "@/store/slices/settingsSlice"
import { selectCurrentExerciseId } from "@/store/slices/unseenSlice"
import { selectCurrentModuleId } from "@/store/slices/modulesSlice"
import { colorSchemeManager, theme } from "@/theme"
import { builtInModuleIds } from "@/data/defaultModules"
import type { Exercise } from "@/types/exercise"
import { StorageKeys } from "@/utils/sync/storageKeys"
import { useRehydrateFromStorage } from "./useRehydrateFromStorage"

const otherExercise: Exercise = {
  title: "אחר",
  subtitle: "תרגיל שני",
  exerciseId: "other_1",
  paragraphs: ["A cat sat."],
  questions: [],
  flashcards: [{ en: "Cat", he: "חתול", trans: "קֶט" }],
}

const Host = () => {
  const rehydrate = useRehydrateFromStorage()
  const dyslexiaFont = useAppSelector(selectDyslexiaFont)
  const currentExerciseId = useAppSelector(selectCurrentExerciseId)
  const currentModuleId = useAppSelector(selectCurrentModuleId)
  const { colorScheme } = useMantineColorScheme()
  const { dir } = useDirection()

  return (
    <div>
      <span>{dyslexiaFont ? "dyslexia-on" : "dyslexia-off"}</span>
      <span>{currentExerciseId}</span>
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

test("re-reads settings, unseen, modules, locale and colour scheme from storage, discarding in-memory state", async () => {
  const user = userEvent.setup()
  renderHost()
  const secondBuiltInId = builtInModuleIds[1] ?? ""
  expect(screen.getByText("dyslexia-off")).toBeInTheDocument()
  expect(screen.getByText("dark")).toBeInTheDocument()
  expect(screen.getByText("ltr")).toBeInTheDocument()
  expect(screen.queryByText(secondBuiltInId)).not.toBeInTheDocument()
  expect(screen.queryByText("other_1")).not.toBeInTheDocument()

  localStorage.setItem(StorageKeys.dyslexiaFont, "1")
  localStorage.setItem(StorageKeys.locale, "he")
  localStorage.setItem(StorageKeys.darkMode, "0")
  localStorage.setItem(
    StorageKeys.exerciseLibrary,
    JSON.stringify({ other_1: otherExercise }),
  )
  localStorage.setItem(StorageKeys.currentExerciseId, "other_1")
  localStorage.setItem(StorageKeys.currentModuleId, secondBuiltInId)

  await user.click(screen.getByRole("button", { name: "Rehydrate" }))

  expect(screen.getByText("dyslexia-on")).toBeInTheDocument()
  expect(screen.getByText("light")).toBeInTheDocument()
  expect(screen.getByText("other_1")).toBeInTheDocument()
  expect(screen.getByText(secondBuiltInId)).toBeInTheDocument()
  expect(document.documentElement.lang).toBe("he")
  // `detectDirection={false}` above rules out Mantine's own dir-attribute
  // MutationObserver -- this only passes if the hook calls setDirection().
  expect(screen.getByText("rtl")).toBeInTheDocument()
})
