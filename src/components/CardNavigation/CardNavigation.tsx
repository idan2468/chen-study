import { Button, Group, Text } from "@mantine/core"
import { useTranslation } from "react-i18next"

export type CardNavigationProps = {
  /** Zero-based position of the current card. */
  index: number
  total: number
  onPrev: () => void
  onNext: () => void
}

/**
 * Previous / counter / next controls, shared by both flashcard screens.
 *
 * Neither end wraps around, matching the originals (`.card-controls` in
 * `Unseen New.html` and `.nav-controls` in `Modules Practice.html`).
 *
 * The arrows are not mirrored for RTL: the originals labelled these
 * "← הקודם" / "הבא →", so left is always previous. `useFlashcardKeys` binds the
 * keyboard shortcuts to match.
 */
export const CardNavigation = ({
  index,
  total,
  onPrev,
  onNext,
}: CardNavigationProps) => {
  const { t } = useTranslation()

  return (
    <Group gap="md" justify="center">
      <Button variant="default" onClick={onPrev} disabled={index === 0}>
        {t("common.previous")}
      </Button>
      <Text fw={700} miw={70} ta="center">
        {index + 1} / {total}
      </Text>
      <Button variant="default" onClick={onNext} disabled={index >= total - 1}>
        {t("common.next")}
      </Button>
    </Group>
  )
}
