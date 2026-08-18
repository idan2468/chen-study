import { Text } from "@mantine/core"
import { FlipHint } from "@/components/FlipHint/FlipHint"

export type CardWordProps = {
  text: string
  className?: string
}

/** A flashcard's front-facing word, plus its always-paired flip hint. */
export const CardWord = ({ text, className }: CardWordProps) => (
  <>
    <Text dir="ltr" fw={700} className={className}>
      {text}
    </Text>
    <FlipHint />
  </>
)
