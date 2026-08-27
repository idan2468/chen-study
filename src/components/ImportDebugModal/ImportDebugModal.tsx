import { Button, CopyButton, Modal, Stack, Text } from "@mantine/core"
import { IconCheck } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { ICON_SIZE } from "@/constants/icons"

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
    <Modal
      opened={opened}
      onClose={onClose}
      title={t("json.debugInfoTitle")}
      centered
      size="lg"
      removeScrollProps={{ gapMode: "padding" }}
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

        <CopyButton value={debugInfo} timeout={2000}>
          {({ copied, copy }) => (
            <Button
              size="xs"
              variant="default"
              leftSection={copied ? <IconCheck size={ICON_SIZE} /> : undefined}
              onClick={copy}
            >
              {copied ? t("json.copied") : t("json.copyDebugInfo")}
            </Button>
          )}
        </CopyButton>
      </Stack>
    </Modal>
  )
}
