import { Group, Paper, Title } from "@mantine/core"
import { convert } from "html-to-text"
import { SpeakButton } from "@/components/SpeakButton/SpeakButton"

export type RuleBoxProps = {
  title: string
  speakLabel: string
  /** Unique per module, so switching modules doesn't show a stale "playing" state. */
  ownerId: string
  /** Author-supplied HTML from the module's `rule` field. */
  html: string
}

/**
 * The rule / explanation panel. `html` contains classes like `.rule-section`
 * baked into module data, so they're declared globally in `styles/global.css`
 * rather than as CSS-Module classes. `dir="auto"` so this author-supplied
 * teaching material keeps its own text direction regardless of UI language.
 */
export const RuleBox = ({ title, speakLabel, ownerId, html }: RuleBoxProps) => (
  <Paper withBorder radius="md" p="md" w="100%">
    <Group gap="xs" mb="xs" wrap="nowrap">
      <SpeakButton
        ownerId={ownerId}
        text={convert(html, { wordwrap: false })}
        label={speakLabel}
        size="sm"
      />
      <Title order={4} c="brand">
        {title}
      </Title>
    </Group>
    <div dir="auto" dangerouslySetInnerHTML={{ __html: html }} />
  </Paper>
)
