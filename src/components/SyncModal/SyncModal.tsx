import {
  Button,
  CopyButton,
  Group,
  Modal,
  Text,
  TextInput,
} from "@mantine/core"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { buildSyncUrl } from "../../utils/syncUrl"

export type SyncModalProps = {
  opened: boolean
  onClose: () => void
}

/**
 * "Continue on another device" link.
 *
 * Replaces the `openSyncModal` / `closeSyncModal` / `copySyncURL` trio and its
 * markup, which was duplicated verbatim in both original HTML files. The
 * clipboard-with-`execCommand`-fallback dance is now Mantine's `CopyButton`.
 */
export const SyncModal = ({ opened, onClose }: SyncModalProps) => {
  const { t } = useTranslation()

  // Rebuilt each time the modal opens so it reflects the latest progress.
  const syncUrl = useMemo(() => (opened ? buildSyncUrl() : ""), [opened])

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t("sync.title")}
      centered
      size="lg"
    >
      <Text size="sm" c="dimmed" mb="md">
        {t("sync.description")}
      </Text>

      <TextInput
        value={syncUrl}
        readOnly
        onFocus={event => {
          event.currentTarget.select()
        }}
        aria-label={t("sync.linkLabel")}
        styles={{ input: { direction: "ltr", textAlign: "left" } }}
      />

      <Group justify="flex-end" mt="lg">
        <CopyButton value={syncUrl} timeout={2000}>
          {({ copied, copy }) => (
            <Button onClick={copy} color={copied ? "success" : undefined}>
              {copied ? t("sync.copied") : t("sync.copyLink")}
            </Button>
          )}
        </CopyButton>
        <Button variant="default" onClick={onClose}>
          {t("common.close")}
        </Button>
      </Group>
    </Modal>
  )
}
