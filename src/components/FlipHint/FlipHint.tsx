import { Text } from "@mantine/core"
import { useTranslation } from "react-i18next"

/** The "click to flip" hint shown on the front of every flashcard. */
export const FlipHint = () => {
  const { t } = useTranslation()
  return (
    <Text size="xs" c="dimmed">
      {t("common.flipHint")}
    </Text>
  )
}
