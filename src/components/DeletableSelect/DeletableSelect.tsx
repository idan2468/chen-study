import type { ReactNode } from "react"
import { ActionIcon, Group, Select, Tooltip } from "@mantine/core"
import { IconTrash } from "@tabler/icons-react"
import { ICON_SIZE } from "@/constants/icons"
import classes from "./DeletableSelect.module.css"

export type DeletableSelectItem = {
  value: string
  label: string
}

export type DeletableSelectProps = {
  data: readonly DeletableSelectItem[]
  value: string
  onChange: (value: string) => void
  onDelete: () => void
  selectLabel: string
  deleteLabel: string
  leftSection: ReactNode
}

/** Picker plus delete. The trash button fills danger red on hover. */
export const DeletableSelect = ({
  data,
  value,
  onChange,
  onDelete,
  selectLabel,
  deleteLabel,
  leftSection,
}: DeletableSelectProps) => (
  <Group justify="center" gap="xs">
    <Select
      data={[...data]}
      value={value}
      onChange={next => {
        if (next !== null) {
          onChange(next)
        }
      }}
      allowDeselect={false}
      w={460}
      size="md"
      leftSection={leftSection}
      aria-label={selectLabel}
    />
    <Tooltip label={deleteLabel}>
      <ActionIcon
        variant="default"
        size="xl"
        onClick={onDelete}
        aria-label={deleteLabel}
        className={classes.deleteButton}
      >
        <IconTrash size={ICON_SIZE} />
      </ActionIcon>
    </Tooltip>
  </Group>
)
