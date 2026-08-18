import type { ReactNode } from "react"
import { Badge, Group, Paper } from "@mantine/core"

export type StatCount = {
  label: string
  value: number
  color?: "success" | "danger" | "gray" | "brand"
}

export type StatCountsProps = {
  items: readonly StatCount[]
  /** Actions shown on the far side of the bar (reset, filter, ...). */
  actions?: ReactNode
}

/**
 * The known / unknown / pending summary bar.
 *
 * Replaces `Unseen New.html`'s `.stats-bar` (with its inline-styled counts) and
 * `Modules Practice.html`'s three-`.stat-item` bar.
 */
export const StatCounts = ({ items, actions }: StatCountsProps) => (
  <Paper withBorder p="xs" radius="md" w="100%">
    <Group justify="space-between" gap="xs" wrap="wrap">
      <Group gap="xs" wrap="wrap">
        {items.map(item => (
          <Badge
            key={item.label}
            color={item.color ?? "gray"}
            variant="light"
            size="lg"
          >
            {item.label}: {item.value}
          </Badge>
        ))}
      </Group>
      {actions ? (
        <Group gap="xs" wrap="wrap">
          {actions}
        </Group>
      ) : null}
    </Group>
  </Paper>
)
