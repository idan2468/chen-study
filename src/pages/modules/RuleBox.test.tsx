import { screen } from "@testing-library/react"
import { renderWithProviders } from "@test/render"
import { RuleBox } from "./RuleBox"

const html =
  "<div class='rule-section'><b>Rule:</b> short A sounds like this.</div>"

describe("RuleBox", () => {
  test("renders the title and the rule markup", () => {
    renderWithProviders(
      <RuleBox
        title="The rule"
        speakLabel="Read the rule aloud"
        ownerId="rule:module-1"
        html={html}
      />,
    )

    expect(screen.getByText("The rule")).toBeInTheDocument()
    expect(screen.getByText("Rule:")).toBeInTheDocument()
    expect(screen.getByText("short A sounds like this.")).toBeInTheDocument()
  })

  test("the speak button reads the rule as plain text, tags stripped", async () => {
    const { user } = renderWithProviders(
      <RuleBox
        title="The rule"
        speakLabel="Read the rule aloud"
        ownerId="rule:module-1"
        html={html}
      />,
    )

    const speakButton = screen.getByRole("button", {
      name: "Read the rule aloud",
    })
    await user.click(speakButton)

    expect(speakButton).toHaveAttribute("aria-pressed", "true")
  })
})
