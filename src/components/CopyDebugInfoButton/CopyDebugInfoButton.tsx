import { Button, CopyButton } from "@mantine/core"
import { IconCheck } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { ICON_SIZE } from "@/constants/icons"

export type CopyDebugInfoButtonProps = {
  debugInfo: string
}

export const CopyDebugInfoButton = ({
  debugInfo,
}: CopyDebugInfoButtonProps) => {
  const { t } = useTranslation()

  return (
    <CopyButton value={debugInfo} timeout={2000}>
      {({ copied, copy }) => (
        <Button
          size="xs"
          variant="default"
          leftSection={copied ? <IconCheck size={ICON_SIZE} /> : undefined}
          onClick={copy}
        >
          {copied ? t("common.copied") : t("common.copyDebugInfo")}
        </Button>
      )}
    </CopyButton>
  )
}
