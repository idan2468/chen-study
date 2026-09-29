import { Stack, Text } from "@mantine/core"
import { useTranslation } from "react-i18next"
import { AppModal } from "@/components/AppModal/AppModal"
import { CopyDebugInfoButton } from "@/components/CopyDebugInfoButton/CopyDebugInfoButton"

export type ImportDebugModalProps = {
  opened: boolean
  onClose: () => void
  /** Raw validation detail (e.g. zod issues) to show and offer for copying. */
  debugInfo: string
}

/**
 * Shows a technical validation error too long/detailed for the inline
 * message -- meant for a human or an AI to diagnose, not the end user to
 * read. Shared by the modules and unseen JSON importers via `JsonLoader`.
 */
export const ImportDebugModal = ({
  opened,
  onClose,
  debugInfo,
}: ImportDebugModalProps) => {
  const { t } = useTranslation()

  return (
    <AppModal
      opened={opened}
      onClose={onClose}
      title={t("json.debugInfoTitle")}
      centered
      size="lg"
    >
      <Stack gap="sm">
        <Text
          component="pre"
          size="xs"
          dir="ltr"
          style={{
            whiteSpace: "pre-wrap",
            overflowWrap: "break-word",
            textAlign: "left",
          }}
        >
          {debugInfo}
        </Text>

        <CopyDebugInfoButton debugInfo={debugInfo} />
      </Stack>
    </AppModal>
  )
}
