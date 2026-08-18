import { screen } from "@testing-library/react"
import { renderWithProviders } from "@test/render"
import { CardNavigation } from "./CardNavigation"

describe("CardNavigation", () => {
  test("shows the 1-based position out of the total", () => {
    renderWithProviders(
      <CardNavigation index={2} total={9} onPrev={vi.fn()} onNext={vi.fn()} />,
    )

    expect(screen.getByText("3 / 9")).toBeInTheDocument()
  })

  test("prev is disabled at the first card", () => {
    renderWithProviders(
      <CardNavigation index={0} total={5} onPrev={vi.fn()} onNext={vi.fn()} />,
    )

    expect(screen.getByRole("button", { name: /Previous/ })).toBeDisabled()
    expect(screen.getByRole("button", { name: /Next/ })).toBeEnabled()
  })

  test("next is disabled at the last card", () => {
    renderWithProviders(
      <CardNavigation index={4} total={5} onPrev={vi.fn()} onNext={vi.fn()} />,
    )

    expect(screen.getByRole("button", { name: /Previous/ })).toBeEnabled()
    expect(screen.getByRole("button", { name: /Next/ })).toBeDisabled()
  })

  test("clicking prev/next fires the matching callback", async () => {
    const onPrev = vi.fn()
    const onNext = vi.fn()
    const { user } = renderWithProviders(
      <CardNavigation index={2} total={9} onPrev={onPrev} onNext={onNext} />,
    )

    await user.click(screen.getByRole("button", { name: /Previous/ }))
    expect(onPrev).toHaveBeenCalledOnce()
    expect(onNext).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: /Next/ }))
    expect(onNext).toHaveBeenCalledOnce()
  })
})
