import { Paper, Title } from "@mantine/core"

export type RuleBoxProps = {
  title: string
  /** Author-supplied HTML from the module's `rule` field. */
  html: string
}

/**
 * The rule / explanation panel.
 *
 * `rule` is a raw HTML string in the module data (`Modules Practice.html:820-827`
 * and every module after it), containing `.rule-section`, `.rule-examples` and
 * `<b>`. Those class names are baked into the content, so they cannot be hashed
 * CSS-Module classes -- they are declared globally in `styles/global.css`.
 *
 * The content is author-supplied via the JSON loader, i.e. by the person using
 * the app on their own device, which is the same trust model the original had.
 *
 * `dir="auto"` rather than inheriting the UI direction: this is author-supplied
 * teaching material, so its direction must come from the text itself and not flip
 * when the interface language changes.
 */
export const RuleBox = ({ title, html }: RuleBoxProps) => (
  <Paper withBorder radius="md" p="md" w="100%">
    <Title order={4} c="brand" mb="xs">
      {title}
    </Title>
    <div dir="auto" dangerouslySetInnerHTML={{ __html: html }} />
  </Paper>
)
