import { Button, Group } from "@mantine/core"

export type AssessmentButtonsProps = {
  /** `undefined` means not yet assessed. */
  isKnown: boolean | undefined
  onMark: (isKnown: boolean) => void
  knownLabel: string
  unknownLabel: string
}

/**
 * The known/unknown assessment pair, shared by both flashcard screens.
 *
 * The same shape `CardNavigation` was already extracted for from these same
 * two files (`ModuleFlashcard.tsx`, `FlashcardsTab.tsx`): two colour-coded
 * buttons whose `variant` reflects the current status. Each screen keeps its
 * own status representation (`CardStatus` vs `boolean`) and maps it to
 * `isKnown` at the call site, so this component only needs the boolean.
 */
export const AssessmentButtons = ({
  isKnown,
  onMark,
  knownLabel,
  unknownLabel,
}: AssessmentButtonsProps) => (
  <Group gap="sm" justify="center">
    <Button
      color="success"
      variant={isKnown === true ? "filled" : "light"}
      onClick={() => {
        onMark(true)
      }}
    >
      {knownLabel}
    </Button>
    <Button
      color="danger"
      variant={isKnown === false ? "filled" : "light"}
      onClick={() => {
        onMark(false)
      }}
    >
      {unknownLabel}
    </Button>
  </Group>
)
