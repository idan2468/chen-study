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

/**
 * Picker plus delete. `w={460}` overflowed a phone row and dropped the trash
 * underneath; the select fills the row up to that max so both stay together.
 */
export const DeletableSelect = ({
  data,
  value,
  onChange,
  onDelete,
  selectLabel,
  deleteLabel,
  leftSection,
}: DeletableSelectProps) => (
  <Group justify="center" gap="xs" wrap="nowrap" w="100%">
    <Select
      data={[...data]}
      value={value}
      onChange={next => {
        if (next !== null) {
          onChange(next)
        }
      }}
      allowDeselect={false}
      w="100%"
      maw={460}
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
