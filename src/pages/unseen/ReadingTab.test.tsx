import { screen } from "@testing-library/react"
import { renderWithProviders } from "@test/render"
import { selectAnswers } from "@/store/slices/unseenSlice"
import { ReadingTab } from "./ReadingTab"

beforeEach(() => {
  localStorage.clear()
})

test("shuffles displayed letters while saving the original selected option", async () => {
  vi.spyOn(Math, "random").mockReturnValue(0)
  const { store, user } = renderWithProviders(<ReadingTab />)

  const toggle = screen.getByRole("switch", { name: "Shuffle answer order" })
  expect(toggle).not.toBeChecked()
  await user.click(toggle)
  expect(toggle).toBeChecked()

  const shuffledCorrectAnswer = screen.getByRole("button", {
    name: "a) To help the batter rise properly in the oven",
  })
  await user.click(shuffledCorrectAnswer)

  expect(selectAnswers(store.getState()).q1).toStrictEqual({
    selected: 1,
    correct: true,
  })
  expect(shuffledCorrectAnswer).toHaveAttribute("aria-pressed", "true")
})
