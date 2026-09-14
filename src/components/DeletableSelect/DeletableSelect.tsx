import type { ReactNode } from "react"
import { ActionIcon, Group, Select, Text, Tooltip } from "@mantine/core"
import {
  IconChevronDown,
  IconCircleCheck,
  IconTrash,
} from "@tabler/icons-react"
import { ICON_SIZE } from "@/constants/icons"
import classes from "./DeletableSelect.module.css"

export type DeletableSelectItem = {
  value: string
  label: string
  completed?: boolean
}

export type DeletableSelectProps = {
  data: readonly DeletableSelectItem[]
  value: string
  onChange: (value: string) => void
  onDelete: () => void
  selectLabel: string
  deleteLabel: string
  completedLabel: string
  leftSection: ReactNode
}

type CompletionMarkProps = {
  itemLabel: string
  completedLabel: string
}

const CompletionMark = ({ itemLabel, completedLabel }: CompletionMarkProps) => (
  <span
    role="img"
    aria-label={`${itemLabel}: ${completedLabel}`}
    className={classes.completionMark}
  >
    <IconCircleCheck size={ICON_SIZE} aria-hidden />
  </span>
)

/**
 * Picker plus delete. A fixed width overflowed a phone row and dropped the
 * trash underneath; the select fills available space up to its desktop max.
 */
export const DeletableSelect = ({
  data,
  value,
  onChange,
  onDelete,
  selectLabel,
  deleteLabel,
  completedLabel,
  leftSection,
}: DeletableSelectProps) => {
  const selectedItem = data.find(item => item.value === value)
  const completedValues = new Set(
    data.filter(item => item.completed).map(item => item.value),
  )

  return (
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
        withCheckIcon={false}
        w="100%"
        maw={600}
        comboboxProps={{
          width: "min(600px, calc(100vw - 8px))",
          middlewares: { flip: true, shift: true },
        }}
        size="md"
        leftSection={leftSection}
        rightSection={
          <Group gap={4} wrap="nowrap">
            {selectedItem?.completed ? (
              <CompletionMark
                itemLabel={selectedItem.label}
                completedLabel={completedLabel}
              />
            ) : null}
            <IconChevronDown size={16} aria-hidden />
          </Group>
        }
        rightSectionWidth={selectedItem?.completed ? 56 : 36}
        rightSectionPointerEvents="none"
        renderOption={({ option }) => (
          <div className={classes.optionContent}>
            <Text
              component="span"
              title={option.label}
              className={classes.optionLabel}
            >
              {option.label}
            </Text>
            {completedValues.has(option.value) ? (
              <CompletionMark
                itemLabel={option.label}
                completedLabel={completedLabel}
              />
            ) : null}
          </div>
        )}
        title={selectedItem?.label}
        classNames={{ input: classes.input }}
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
}
