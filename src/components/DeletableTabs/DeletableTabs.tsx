import type { KeyboardEvent, MouseEvent } from "react"
import { CloseButton, Tabs } from "@mantine/core"
import { useTranslation } from "react-i18next"
import classes from "./DeletableTabs.module.css"

export type TabItem = {
  value: string
  label: string
  /** Shows a delete icon on the tab. Ignored when `onDelete` is not supplied. */
  deletable?: boolean
}

export type DeletableTabsProps = {
  items: readonly TabItem[]
  value: string
  onChange: (value: string) => void
  onDelete?: (value: string) => void
}

/**
 * Tab strip, with an optional per-tab delete affordance.
 *
 * Covers both original tab implementations: `Unseen New.html`'s static
 * three-tab nav (`.tab-nav`/`.tab-btn`, no delete) and
 * `Modules Practice.html`'s dynamic module strip with its `.tab-delete-btn`,
 * which `renderTabButtons()` (`:1121-1143`) rebuilt imperatively on every
 * change.
 *
 * The delete icon is a `CloseButton` rendered as a `span` with
 * `role="button"` rather than a real button, because Mantine renders
 * `Tabs.Tab` as a `<button>` and nesting buttons is invalid.
 */
export const DeletableTabs = ({
  items,
  value,
  onChange,
  onDelete,
}: DeletableTabsProps) => {
  const { t } = useTranslation()

  return (
    <Tabs
      value={value}
      onChange={next => {
        if (next !== null) {
          onChange(next)
        }
      }}
      variant="pills"
      keepMounted={false}
    >
      <Tabs.List>
        {items.map(item => {
          const showDelete = onDelete !== undefined && item.deletable !== false

          const handleDelete = (
            event: MouseEvent<HTMLSpanElement> | KeyboardEvent<HTMLSpanElement>,
          ) => {
            // Must not also select the tab being deleted.
            event.stopPropagation()
            onDelete?.(item.value)
          }

          return (
            <Tabs.Tab
              key={item.value}
              value={item.value}
              rightSection={
                showDelete ? (
                  <CloseButton
                    component="span"
                    role="button"
                    tabIndex={0}
                    size="md"
                    aria-label={t("common.deleteItem", { name: item.label })}
                    onClick={handleDelete}
                    onKeyDown={event => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        handleDelete(event)
                      }
                    }}
                    className={classes.deleteButton}
                  />
                ) : null
              }
            >
              {/* Tab labels are author-supplied content. */}
              <span dir="auto">{item.label}</span>
            </Tabs.Tab>
          )
        })}
      </Tabs.List>
    </Tabs>
  )
}
