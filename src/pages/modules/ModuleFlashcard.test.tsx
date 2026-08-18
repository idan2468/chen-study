import { screen } from "@testing-library/react"
import { renderWithProviders } from "@test/render"
import type { ModuleCard } from "@/types/module"
import { ModuleFlashcard } from "./ModuleFlashcard"

const card: ModuleCard = { en: "HAT", he: "hat-translit", meaning: "a hat" }

describe("ModuleFlashcard", () => {
  test("renders the word face-down, flip reveals translation, meaning and speak button", async () => {
    const { user } = renderWithProviders(
      <ModuleFlashcard
        card={card}
        index={0}
        total={3}
        status={undefined}
        onMark={vi.fn()}
        onNext={vi.fn()}
        onPrev={vi.fn()}
      />,
    )

    const flip = screen.getByRole("button", {
      name: "Flashcard - click to flip",
    })
    expect(flip).toHaveAttribute("aria-pressed", "false")
    expect(screen.getByText("HAT")).toBeInTheDocument()

    await user.click(flip)

    expect(flip).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByText("hat-translit")).toBeInTheDocument()
    expect(screen.getByText("a hat")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Read the word HAT aloud" }),
    ).toBeInTheDocument()
  })

  test.each([
    [true, "✔ Got it"],
    [false, "✖ Needs practice"],
  ])("clicking %s calls onMark with %s", async (expected, label) => {
    const onMark = vi.fn()
    const { user } = renderWithProviders(
      <ModuleFlashcard
        card={card}
        index={0}
        total={3}
        status={undefined}
        onMark={onMark}
        onNext={vi.fn()}
        onPrev={vi.fn()}
      />,
    )

    await user.click(screen.getByRole("button", { name: label }))

    expect(onMark).toHaveBeenCalledExactlyOnceWith(expected)
  })

  test.each([
    ["known" as const, "filled", "light"],
    ["unknown" as const, "light", "filled"],
  ])(
    "status=%s renders the matching assessment button as filled",
    (status, knownVariant, unknownVariant) => {
      renderWithProviders(
        <ModuleFlashcard
          card={card}
          index={0}
          total={3}
          status={status}
          onMark={vi.fn()}
          onNext={vi.fn()}
          onPrev={vi.fn()}
        />,
      )

      expect(screen.getByRole("button", { name: "✔ Got it" })).toHaveAttribute(
        "data-variant",
        knownVariant,
      )
      expect(
        screen.getByRole("button", { name: "✖ Needs practice" }),
      ).toHaveAttribute("data-variant", unknownVariant)
    },
  )

  test("a new card prop (remount) starts face-down again", () => {
    // ModulesPage keys ModuleFlashcard by word, so a card change is a fresh
    // mount -- simulated here with React's own `key`.
    const secondCard: ModuleCard = {
      en: "FOX",
      he: "fox-translit",
      meaning: "a fox",
    }
    const { rerender } = renderWithProviders(
      <ModuleFlashcard
        key={card.en}
        card={card}
        index={0}
        total={3}
        status={undefined}
        onMark={vi.fn()}
        onNext={vi.fn()}
        onPrev={vi.fn()}
      />,
    )

    rerender(
      <ModuleFlashcard
        key={secondCard.en}
        card={secondCard}
        index={1}
        total={3}
        status={undefined}
        onMark={vi.fn()}
        onNext={vi.fn()}
        onPrev={vi.fn()}
      />,
    )

    expect(
      screen.getByRole("button", { name: "Flashcard - click to flip" }),
    ).toHaveAttribute("aria-pressed", "false")
    expect(screen.getByText("FOX")).toBeInTheDocument()
  })

  test("prev is disabled at index 0, next at the last index", () => {
    const { rerender } = renderWithProviders(
      <ModuleFlashcard
        card={card}
        index={0}
        total={3}
        status={undefined}
        onMark={vi.fn()}
        onNext={vi.fn()}
        onPrev={vi.fn()}
      />,
    )

    expect(screen.getByRole("button", { name: /Previous/ })).toBeDisabled()
    expect(screen.getByRole("button", { name: /Next/ })).toBeEnabled()

    rerender(
      <ModuleFlashcard
        card={card}
        index={2}
        total={3}
        status={undefined}
        onMark={vi.fn()}
        onNext={vi.fn()}
        onPrev={vi.fn()}
      />,
    )

    expect(screen.getByRole("button", { name: /Previous/ })).toBeEnabled()
    expect(screen.getByRole("button", { name: /Next/ })).toBeDisabled()
  })
})
