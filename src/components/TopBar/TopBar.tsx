import type { ReactNode } from "react"
import {
  Button,
  Group,
  Menu,
  Paper,
  Tooltip,
  useMantineColorScheme,
} from "@mantine/core"
import { useDisclosure } from "@mantine/hooks"
import {
  IconHome,
  IconLanguage,
  IconLink,
  IconMicrophone,
  IconMoon,
  IconRefresh,
  IconSettings,
  IconSun,
  IconTextSize,
} from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { useGoogleConnectContext } from "@/hooks/GoogleConnectContext"
import { useLocale } from "@/i18n/useLocale"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import {
  selectDyslexiaFont,
  toggleDyslexiaFont,
} from "@/store/slices/settingsSlice"
import { isGoogleSyncAvailable } from "@/utils/sync/google/googleAuth"
import { GoogleIcon } from "@/components/GoogleIcon/GoogleIcon"
import { SpeechSettingsModal } from "@/components/SpeechSettingsModal/SpeechSettingsModal"
import { SyncModal } from "@/components/SyncModal/SyncModal"
import classes from "./TopBar.module.css"

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
  const googleConnect = useGoogleConnectContext()

  const isDark = colorScheme === "dark"

  return (
    <Paper withBorder p="xs" radius="md" w="100%">
      <Group justify="center" gap="xs" wrap="wrap">
        <Group gap="xs" wrap="wrap">
          {withHomeLink ? (
            <Button
              size="xs"
              variant="subtle"
              component={Link}
              to="/"
              leftSection={<IconHome size={18} />}
            >
              {t("common.home")}
            </Button>
          ) : null}

          <Menu shadow="md" width={220} closeOnItemClick={false}>
            <Menu.Target>
              <Button
                size="xs"
                variant="default"
                leftSection={<IconSettings size={18} />}
              >
                {t("common.settingsMenu")}
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                aria-pressed={isDark}
                leftSection={
                  isDark ? <IconSun size={18} /> : <IconMoon size={18} />
                }
                onClick={toggleColorScheme}
              >
                {isDark ? t("common.dayMode") : t("common.nightMode")}
              </Menu.Item>

              <Tooltip label={t("common.languageTooltip")}>
                <Menu.Item
                  leftSection={<IconLanguage size={18} />}
                  onClick={toggleLocale}
                >
                  {locale === "he"
                    ? t("common.switchToEnglish")
                    : t("common.switchToHebrew")}
                </Menu.Item>
              </Tooltip>

              <Menu.Item
                closeMenuOnClick
                leftSection={<IconMicrophone size={18} />}
                onClick={speechHandlers.open}
              >
                {t("common.voiceSettings")}
              </Menu.Item>

              <Menu.Item
                closeMenuOnClick
                leftSection={<IconLink size={18} />}
                onClick={syncHandlers.open}
              >
                {t("common.syncDevices")}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>

          <Tooltip label={t("common.dyslexiaFontTooltip")}>
            <Button
              size="xs"
              variant={dyslexiaFont ? "filled" : "default"}
              aria-pressed={dyslexiaFont}
              leftSection={<IconTextSize size={18} />}
              onClick={() => dispatch(toggleDyslexiaFont())}
            >
              {t("common.dyslexiaFont")}
            </Button>
          </Tooltip>

          {isGoogleSyncAvailable() ? (
            <Button
              size="xs"
              variant="default"
              leftSection={
                <GoogleIcon style={{ width: "1.125rem", height: "1.125rem" }} />
              }
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

          {isGoogleSyncAvailable() && googleConnect.connectedEmail ? (
            <Button
              size="xs"
              variant="default"
              className={classes.syncButton}
              color={googleConnect.needsReconnect ? "red" : undefined}
              leftSection={<IconRefresh size={18} />}
              disabled={!googleConnect.needsReconnect && googleConnect.syncing}
              aria-busy={!googleConnect.needsReconnect && googleConnect.syncing}
              onClick={
                googleConnect.needsReconnect
                  ? googleConnect.connect
                  : googleConnect.syncNow
              }
            >
              {t(
                googleConnect.needsReconnect
                  ? "common.reconnectLabel"
                  : "common.syncNowLabel",
              )}
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
