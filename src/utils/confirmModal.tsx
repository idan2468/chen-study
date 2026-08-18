import { Text } from "@mantine/core"
import { modals } from "@mantine/modals"
import type { TFunction } from "i18next"

/**
 * The "delete/reset with a confirmation dialog" shape repeated across
 * ModulesPage, UnseenPage and FlashcardsTab: same labels/cancel/confirmProps
 * triple, same `<Text size="sm">` wrapper for the body. Centralised so that
 * shape only has to be right once. `cancel` is always `t("common.cancel")` --
 * every call site used exactly that.
 */
export const confirmDanger = (
  t: TFunction,
  options: {
    title: string
    body: string
    confirmLabel: string
    onConfirm: () => void
  },
) => {
  modals.openConfirmModal({
    title: options.title,
    children: <Text size="sm">{options.body}</Text>,
    labels: { confirm: options.confirmLabel, cancel: t("common.cancel") },
    confirmProps: { color: "danger" },
    onConfirm: options.onConfirm,
  })
}

/** The "can't delete the last remaining item" notice, also duplicated verbatim. */
export const notifyCannotDelete = (title: string, body: string) => {
  modals.open({ title, children: <Text size="sm">{body}</Text> })
}
