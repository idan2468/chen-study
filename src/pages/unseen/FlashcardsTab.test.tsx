import { screen, waitFor } from "@testing-library/react"
import { renderWithProviders } from "@test/render"
import type { Exercise } from "@/types/exercise"
import type { RootState } from "@/store/store"
import { FlashcardsTab } from "./FlashcardsTab"

const exercise: Exercise = {
  title: "Sample exercise",
  subtitle: "Sample subtitle",
  exerciseId: "sample_1",
  paragraphs: ["A sample paragraph."],
  questions: [],
  flashcards: [
    { en: "Delicate", he: "delicate-translit", trans: "delicate-meaning" },
    {
      en: "Challenging",
      he: "challenging-translit",
      trans: "challenging-meaning",
    },
  ],
}

const baseState = (
  overrides: Partial<RootState["unseen"]> = {},
): Partial<RootState> => ({
  unseen: {
    library: { [exercise.exerciseId]: exercise },
    currentId: exercise.exerciseId,
    cardIndex: 0,
    answers: {},
    markedWords: {},
    progress: {},
    ...overrides,
  },
})

describe("FlashcardsTab", () => {
  test("renders the front word, flip reveals translation, meaning and speak button", async () => {
    const { user } = renderWithProviders(<FlashcardsTab />, {
      preloadedState: baseState(),
    })

    expect(screen.getByText("Delicate")).toBeInTheDocument()

    await user.click(
      screen.getByRole("button", { name: "Flashcard - click to flip" }),
    )

    expect(screen.getByText("delicate-meaning")).toBeInTheDocument()
    expect(screen.getByText("delicate-translit")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Read the word Delicate aloud" }),
    ).toBeInTheDocument()
  })

  test.each([
    [true, "Known"],
    [false, "Not known"],
  ])(
    "clicking %s dispatches markFlashcard for the current word",
    async (isKnown, label) => {
      const { user, store } = renderWithProviders(<FlashcardsTab />, {
        preloadedState: baseState(),
      })

      await user.click(screen.getByRole("button", { name: label }))

      expect(
        store.getState().unseen.progress[exercise.exerciseId],
      ).toStrictEqual({ Delicate: isKnown })
    },
  )

  test("switching to the next card via the real Redux navigation resets the flip and shows the next word", async () => {
    const { user } = renderWithProviders(<FlashcardsTab />, {
      preloadedState: baseState(),
    })

    const flip = screen.getByRole("button", {
      name: "Flashcard - click to flip",
    })
    await user.click(flip)
    expect(flip).toHaveAttribute("aria-pressed", "true")

    await user.click(screen.getByRole("button", { name: /Next/ }))

    // A new card, not a remount -- flipped state must be reset by the
    // component's own render-time reset, not by React re-mounting it.
    expect(flip).toHaveAttribute("aria-pressed", "false")
    expect(screen.getByText("Challenging")).toBeInTheDocument()
  })

  test.each([["Known" as const], ["Not known" as const]])(
    "clicking %s auto-advances to the next card after a short delay",
    async label => {
      const { user } = renderWithProviders(<FlashcardsTab />, {
        preloadedState: baseState(),
      })

      await user.click(screen.getByRole("button", { name: label }))

      // Not yet -- the advance is deliberately delayed, not immediate.
      expect(screen.getByText("Delicate")).toBeInTheDocument()

      await waitFor(() => {
        expect(screen.getByText("Challenging")).toBeInTheDocument()
      })
    },
  )

  test("marking the last card does not advance past the end", async () => {
    const { user, store } = renderWithProviders(<FlashcardsTab />, {
      preloadedState: baseState({ cardIndex: exercise.flashcards.length - 1 }),
    })

    await user.click(screen.getByRole("button", { name: "Known" }))

    // Give the auto-advance timer a chance to fire, then confirm it was a
    // no-op: `nextFlashcard` already clamps at the last index, same as
    // clicking "Next" directly would.
    await new Promise(resolve => setTimeout(resolve, 300))
    expect(store.getState().unseen.cardIndex).toBe(
      exercise.flashcards.length - 1,
    )
  })

  test("known/unknown counts update in the stats bar as cards are marked", async () => {
    const { user } = renderWithProviders(<FlashcardsTab />, {
      preloadedState: baseState(),
    })

    expect(screen.getByText("Known: 0")).toBeInTheDocument()
    expect(screen.getByText("Not known: 0")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Known" }))

    expect(screen.getByText("Known: 1")).toBeInTheDocument()
    expect(screen.getByText("Not known: 0")).toBeInTheDocument()
  })

  test("prev is disabled on the first card, next on the last", async () => {
    const { user } = renderWithProviders(<FlashcardsTab />, {
      preloadedState: baseState({
        cardIndex: exercise.flashcards.length - 1,
      }),
    })

    expect(screen.getByRole("button", { name: /Next/ })).toBeDisabled()
    expect(screen.getByRole("button", { name: /Previous/ })).toBeEnabled()

    await user.click(screen.getByRole("button", { name: /Previous/ }))
    // No longer the last card once we've gone back one.
    expect(screen.getByRole("button", { name: /Next/ })).toBeEnabled()
  })

  test("shows the empty state when the exercise has no flashcards", () => {
    renderWithProviders(<FlashcardsTab />, {
      preloadedState: baseState({
        library: { [exercise.exerciseId]: { ...exercise, flashcards: [] } },
      }),
    })

    expect(
      screen.getByText("This exercise has no vocabulary cards."),
    ).toBeInTheDocument()
  })
})
