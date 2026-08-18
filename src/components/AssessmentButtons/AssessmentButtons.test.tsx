import { screen } from "@testing-library/react"
import { renderWithProviders } from "@test/render"
import { AssessmentButtons } from "./AssessmentButtons"

describe("AssessmentButtons", () => {
  test.each([
    ["known" as const, true],
    ["unknown" as const, false],
  ])("clicking %s calls onMark with %s", async (_label, expected) => {
    const onMark = vi.fn()
    const { user } = renderWithProviders(
      <AssessmentButtons
        isKnown={undefined}
        onMark={onMark}
        knownLabel="Known"
        unknownLabel="Unknown"
      />,
    )

    await user.click(
      screen.getByRole("button", { name: expected ? "Known" : "Unknown" }),
    )

    expect(onMark).toHaveBeenCalledExactlyOnceWith(expected)
  })

  test.each([
    [true, "filled", "light"],
    [false, "light", "filled"],
    [undefined, "light", "light"],
  ])(
    "isKnown=%s renders the matching button as filled",
    (isKnown, knownVariant, unknownVariant) => {
      renderWithProviders(
        <AssessmentButtons
          isKnown={isKnown}
          onMark={vi.fn()}
          knownLabel="Known"
          unknownLabel="Unknown"
        />,
      )

      expect(screen.getByRole("button", { name: "Known" })).toHaveAttribute(
        "data-variant",
        knownVariant,
      )
      expect(screen.getByRole("button", { name: "Unknown" })).toHaveAttribute(
        "data-variant",
        unknownVariant,
      )
    },
  )
})
