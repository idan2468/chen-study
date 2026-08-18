import { useHotkeys } from "@mantine/hooks"

export type FlashcardKeyHandlers = {
  onFlip: () => void
  onNext: () => void
  onPrev: () => void
  onSpeak: () => void
  onKnown: () => void
  onUnknown: () => void
}

/**
 * The keyboard shortcuts the Modules page advertised but never implemented:
 * `Modules Practice.html:782-784` documents [space] flip, [arrows] navigate,
 * [S] speak, [1] known, [2] needs practice -- while the file contains no
 * `keydown` listener at all.
 *
 * Note the arrow keys are deliberately *not* mirrored for RTL: the original
 * labelled its buttons "← הקודם" / "הבא →", i.e. left is previous.
 *
 * Mantine's `useHotkeys` ignores events originating in `INPUT`, `TEXTAREA` and
 * `SELECT` by default, so typing JSON into the loader never triggers these.
 */
export const useFlashcardKeys = (handlers: FlashcardKeyHandlers) => {
  useHotkeys([
    ["space", handlers.onFlip],
    ["ArrowLeft", handlers.onPrev],
    ["ArrowRight", handlers.onNext],
    ["s", handlers.onSpeak],
    ["1", handlers.onKnown],
    ["2", handlers.onUnknown],
  ])
}
