import type { ReactNode } from "react"
import {
  Button,
  Group,
  Paper,
  Tooltip,
  useMantineColorScheme,
} from "@mantine/core"
import { useDisclosure } from "@mantine/hooks"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { useGoogleConnect } from "@/hooks/useGoogleConnect"
import { useLocale } from "@/i18n/useLocale"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import {
  selectDyslexiaFont,
  toggleDyslexiaFont,
} from "@/store/slices/settingsSlice"
import { isGoogleSyncAvailable } from "@/utils/google/googleAuth"
import { GoogleIcon } from "@/components/GoogleIcon/GoogleIcon"
import { SpeechSettingsModal } from "@/components/SpeechSettingsModal/SpeechSettingsModal"
import { SyncModal } from "@/components/SyncModal/SyncModal"

export type TopBarProps = {
  /** Page-specific controls, e.g. the Unseen page's exercise picker. */
  children?: ReactNode
  /** Hidden on the hub, which is itself the home page. */
  withHomeLink?: boolean
}

/**
 * The accessibility / utility bar. Replaces the `.top-bar` + `.a11y-btn` group
 * that both original pages carried their own copy of, along with
 * `applyDyslexiaFont` / `toggleDyslexiaFont` / `applyDarkMode` /
 * `toggleDarkMode`.
 */
export const TopBar = ({ children, withHomeLink = true }: TopBarProps) => {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const dyslexiaFont = useAppSelector(selectDyslexiaFont)
  const { colorScheme, toggleColorScheme } = useMantineColorScheme()
  const { locale, toggleLocale } = useLocale()
  const [syncOpened, syncHandlers] = useDisclosure(false)
  const [speechOpened, speechHandlers] = useDisclosure(false)
  const googleConnect = useGoogleConnect()

  const isDark = colorScheme === "dark"

  return (
    <Paper withBorder p="xs" radius="md" w="100%">
      <Group justify="center" gap="xs" wrap="wrap">
        <Group gap="xs" wrap="wrap">
          {withHomeLink ? (
            <Button size="xs" variant="subtle" component={Link} to="/">
              {t("common.home")}
            </Button>
          ) : null}

          <Tooltip label={t("common.dyslexiaFontTooltip")}>
            <Button
              size="xs"
              variant={dyslexiaFont ? "filled" : "default"}
              aria-pressed={dyslexiaFont}
              onClick={() => dispatch(toggleDyslexiaFont())}
            >
              {t("common.dyslexiaFont")}
            </Button>
          </Tooltip>

          <Button
            size="xs"
            variant="default"
            aria-pressed={isDark}
            onClick={toggleColorScheme}
          >
            {isDark ? t("common.dayMode") : t("common.nightMode")}
          </Button>

          <Tooltip label={t("common.languageTooltip")}>
            <Button size="xs" variant="default" onClick={toggleLocale}>
              {locale === "he"
                ? t("common.switchToEnglish")
                : t("common.switchToHebrew")}
            </Button>
          </Tooltip>

          <Button size="xs" variant="default" onClick={speechHandlers.open}>
            {t("common.voiceSettings")}
          </Button>

          <Button size="xs" variant="default" onClick={syncHandlers.open}>
            {t("common.syncDevices")}
          </Button>

          {isGoogleSyncAvailable() ? (
            <Button
              size="xs"
              variant="default"
              leftSection={<GoogleIcon />}
              loading={googleConnect.connecting}
              onClick={
                googleConnect.connectedEmail
                  ? googleConnect.disconnect
                  : googleConnect.connect
              }
            >
              {googleConnect.connectedEmail
                ? t("common.googleConnected", {
                    email: googleConnect.connectedEmail,
                  })
                : t("common.connectGoogle")}
            </Button>
          ) : null}
        </Group>

        {children ? <Group gap="xs">{children}</Group> : null}
      </Group>

      <SyncModal opened={syncOpened} onClose={syncHandlers.close} />
      <SpeechSettingsModal
        opened={speechOpened}
        onClose={speechHandlers.close}
      />
    </Paper>
  )
}
