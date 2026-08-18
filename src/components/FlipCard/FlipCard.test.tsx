import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import type { FlipCardStatus } from "./FlipCard"
import { FlipCard } from "./FlipCard"

/** A stateful host, since `FlipCard` itself is fully controlled by `flipped`/`onToggle`. */
const StatefulFlipCard = ({ status }: { status?: FlipCardStatus }) => {
  const [flipped, setFlipped] = useState(false)
  return (
    <FlipCard
      flipped={flipped}
      onToggle={() => {
        setFlipped(current => !current)
      }}
      status={status}
      label="Flashcard - click to flip"
      front={<span>front content</span>}
      back={<span>back content</span>}
    />
  )
}

const getCard = () =>
  screen.getByRole("button", { name: "Flashcard - click to flip" })

describe("FlipCard", () => {
  test("clicking the card toggles aria-pressed", async () => {
    const user = userEvent.setup()
    render(<StatefulFlipCard />)

    expect(getCard()).toHaveAttribute("aria-pressed", "false")

    await user.click(getCard())
    expect(getCard()).toHaveAttribute("aria-pressed", "true")

    await user.click(getCard())
    expect(getCard()).toHaveAttribute("aria-pressed", "false")
  })

  test.each([["Enter"], [" "]])(
    "%s key activation toggles aria-pressed",
    async key => {
      const user = userEvent.setup()
      render(<StatefulFlipCard />)

      getCard().focus()
      await user.keyboard(key === " " ? " " : `{${key}}`)

      expect(getCard()).toHaveAttribute("aria-pressed", "true")
    },
  )

  // The `status` prop only drives a coloured CSS ring (`FlipCard.module.css`'s
  // `.statusKnown`/`.statusUnknown`) -- pixel-level appearance, which the
  // testing plan deliberately leaves to manual/in-browser checks rather than
  // asserting on generated CSS-Module class names here. This just locks in
  // that every status value still renders and flips correctly.
  test.each([["known" as const], ["unknown" as const], ["none" as const]])(
    "status=%s still renders and flips normally",
    async status => {
      const user = userEvent.setup()
      render(<StatefulFlipCard status={status} />)

      await user.click(getCard())

      expect(getCard()).toHaveAttribute("aria-pressed", "true")
      expect(screen.getByText("front content")).toBeInTheDocument()
      expect(screen.getByText("back content")).toBeInTheDocument()
    },
  )

  test("renders both faces' content regardless of flip state", async () => {
    // Both faces exist in the DOM at all times (the flip is a CSS 3D
    // transform, not a mount/unmount) -- this just guards against either
    // face's content going missing.
    const user = userEvent.setup()
    render(<StatefulFlipCard />)

    expect(screen.getByText("front content")).toBeInTheDocument()
    expect(screen.getByText("back content")).toBeInTheDocument()

    await user.click(getCard())

    expect(screen.getByText("front content")).toBeInTheDocument()
    expect(screen.getByText("back content")).toBeInTheDocument()
  })
})
