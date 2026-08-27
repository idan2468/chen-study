import {
  Button,
  CopyButton,
  Group,
  Loader,
  Modal,
  Text,
  TextInput,
} from "@mantine/core"
import { IconCheck } from "@tabler/icons-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { ICON_SIZE } from "@/constants/icons"
import { buildSyncUrl } from "@/utils/sync/syncUrl"

export type SyncModalProps = {
  opened: boolean
  onClose: () => void
}

/**
 * Separate from `SyncModal` so that closing unmounts it, which is what keeps a
 * previous open's snapshot from being on screen and copyable while the current
 * one is still being built.
 */
const SyncLink = ({ onClose }: Pick<SyncModalProps, "onClose">) => {
  const { t } = useTranslation()
  const [syncUrl, setSyncUrl] = useState<string | null>(null)
  const building = syncUrl === null

  useEffect(() => {
    let current = true
    void buildSyncUrl().then(url => {
      if (current) {
        setSyncUrl(url)
      }
    })
    return () => {
      current = false
    }
  }, [])

  return (
    <>
      <TextInput
        value={syncUrl ?? ""}
        readOnly
        onFocus={event => {
          event.currentTarget.select()
        }}
        aria-label={t("sync.linkLabel")}
        rightSection={building ? <Loader size="xs" /> : null}
        styles={{ input: { direction: "ltr", textAlign: "left" } }}
      />

      <Group justify="flex-end" mt="lg">
        <CopyButton value={syncUrl ?? ""} timeout={2000}>
          {({ copied, copy }) => (
            <Button
              onClick={copy}
              disabled={building}
              color={copied ? "success" : undefined}
              leftSection={copied ? <IconCheck size={ICON_SIZE} /> : undefined}
            >
              {copied ? t("sync.copied") : t("sync.copyLink")}
            </Button>
          )}
        </CopyButton>
        <Button variant="default" onClick={onClose}>
          {t("common.close")}
        </Button>
      </Group>
    </>
  )
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

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t("sync.title")}
      centered
      size="lg"
      removeScrollProps={{ removeScrollBar: false }}
    >
      <Text size="sm" c="dimmed" mb="md">
        {t("sync.description")}
      </Text>

      <SyncLink onClose={onClose} />
    </Modal>
  )
}
