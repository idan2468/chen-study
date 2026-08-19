import { Paper, Title } from "@mantine/core"

export type RuleBoxProps = {
  title: string
  /** Author-supplied HTML from the module's `rule` field. */
  html: string
}

/**
 * The rule / explanation panel. `html` contains classes like `.rule-section`
 * baked into module data, so they're declared globally in `styles/global.css`
 * rather than as CSS-Module classes. `dir="auto"` so this author-supplied
 * teaching material keeps its own text direction regardless of UI language.
 */
export const RuleBox = ({ title, html }: RuleBoxProps) => (
  <Paper withBorder radius="md" p="md" w="100%">
    <Title order={4} c="brand" mb="xs">
      {title}
    </Title>
    <div dir="auto" dangerouslySetInnerHTML={{ __html: html }} />
  </Paper>
)
