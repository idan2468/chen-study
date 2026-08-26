import { Text } from "@mantine/core"
import { useTranslation } from "react-i18next"
import { useIsMobile } from "@/hooks/useIsMobile"

/** The "click/tap to flip" hint shown on the front of every flashcard. */
export const FlipHint = () => {
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  return (
    <Text size="xs" c="dimmed">
      {t(isMobile ? "common.flipHintTap" : "common.flipHint")}
    </Text>
  )
}
