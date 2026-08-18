import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { FlashcardKeyHandlers } from "./useFlashcardKeys"
import { useFlashcardKeys } from "./useFlashcardKeys"

/** A minimal host, since `useFlashcardKeys` itself has no rendered output. */
const Host = ({ onFlip = vi.fn() }: { onFlip?: () => void }) => {
  useFlashcardKeys({
    onFlip,
    onNext: vi.fn(),
    onPrev: vi.fn(),
    onSpeak: vi.fn(),
    onKnown: vi.fn(),
    onUnknown: vi.fn(),
  })
  return <input aria-label="distractor input" />
}

describe("useFlashcardKeys", () => {
  test.each([
    ["Space" as const, "onFlip" as const, " "],
    ["ArrowLeft" as const, "onPrev" as const, "{ArrowLeft}"],
    ["ArrowRight" as const, "onNext" as const, "{ArrowRight}"],
    ["S" as const, "onSpeak" as const, "s"],
    ["1" as const, "onKnown" as const, "1"],
    ["2" as const, "onUnknown" as const, "2"],
  ])("%s calls %s", async (_key, handlerName, keys) => {
    const handlers: FlashcardKeyHandlers = {
      onFlip: vi.fn(),
      onNext: vi.fn(),
      onPrev: vi.fn(),
      onSpeak: vi.fn(),
      onKnown: vi.fn(),
      onUnknown: vi.fn(),
    }
    const HandlerHost = () => {
      useFlashcardKeys(handlers)
      return null
    }
    const user = userEvent.setup()
    render(<HandlerHost />)

    await user.keyboard(keys)

    expect(handlers[handlerName]).toHaveBeenCalledOnce()
  })

  test("is inert while focus is inside a text input", async () => {
    const onFlip = vi.fn()
    const user = userEvent.setup()
    render(<Host onFlip={onFlip} />)

    await user.click(screen.getByLabelText("distractor input"))
    await user.keyboard(" ")

    expect(onFlip).not.toHaveBeenCalled()
  })
})
