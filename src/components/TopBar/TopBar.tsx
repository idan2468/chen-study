import type { ReactNode } from "react"
import {
  Button,
  Group,
  Menu,
  Paper,
  Tooltip,
  useMantineColorScheme,
} from "@mantine/core"
import { useDisclosure, useMediaQuery } from "@mantine/hooks"
import {
  IconCheck,
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
import { ICON_SIZE } from "@/constants/icons"
import { APP_ROUTES } from "@/constants/routes"
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
  // Below this width the row can't fit every button with a label, so each
  // one drops to icon-only (aria-label still carries the accessible name).
  const isMobile = useMediaQuery("(max-width: 36em)")

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
              to={APP_ROUTES.home}
              leftSection={isMobile ? undefined : <IconHome size={ICON_SIZE} />}
              aria-label={t("common.home")}
            >
              {isMobile ? <IconHome size={ICON_SIZE} /> : t("common.home")}
            </Button>
          ) : null}

          <Menu shadow="md" width={220} closeOnItemClick={false}>
            <Menu.Target>
              <Button
                size="xs"
                variant="default"
                leftSection={
                  isMobile ? undefined : <IconSettings size={ICON_SIZE} />
                }
                aria-label={t("common.settingsMenu")}
              >
                {isMobile ? (
                  <IconSettings size={ICON_SIZE} />
                ) : (
                  t("common.settingsMenu")
                )}
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Tooltip label={t("common.dyslexiaFontTooltip")}>
                <Menu.Item
                  role="menuitemcheckbox"
                  aria-checked={dyslexiaFont}
                  color={dyslexiaFont ? "brand" : undefined}
                  leftSection={<IconTextSize size={ICON_SIZE} />}
                  rightSection={
                    dyslexiaFont ? <IconCheck size={ICON_SIZE} /> : undefined
                  }
                  onClick={() => dispatch(toggleDyslexiaFont())}
                >
                  {t("common.dyslexiaFont")}
                </Menu.Item>
              </Tooltip>

              <Menu.Item
                aria-pressed={isDark}
                leftSection={
                  isDark ? (
                    <IconSun size={ICON_SIZE} />
                  ) : (
                    <IconMoon size={ICON_SIZE} />
                  )
                }
                onClick={toggleColorScheme}
              >
                {isDark ? t("common.dayMode") : t("common.nightMode")}
              </Menu.Item>

              <Tooltip label={t("common.languageTooltip")}>
                <Menu.Item
                  leftSection={<IconLanguage size={ICON_SIZE} />}
                  onClick={toggleLocale}
                >
                  {locale === "he"
                    ? t("common.switchToEnglish")
                    : t("common.switchToHebrew")}
                </Menu.Item>
              </Tooltip>

              <Menu.Item
                closeMenuOnClick
                leftSection={<IconMicrophone size={ICON_SIZE} />}
                onClick={speechHandlers.open}
              >
                {t("common.voiceSettings")}
              </Menu.Item>

              <Menu.Item
                closeMenuOnClick
                leftSection={<IconLink size={ICON_SIZE} />}
                onClick={syncHandlers.open}
              >
                {t("common.syncDevices")}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>

          {isGoogleSyncAvailable() ? (
            <Button
              size="xs"
              variant="default"
              leftSection={
                isMobile ? undefined : (
                  <GoogleIcon style={{ width: ICON_SIZE, height: ICON_SIZE }} />
                )
              }
              loading={googleConnect.connecting}
              aria-label={
                googleConnect.connectedEmail
                  ? t("common.googleConnected", {
                      email: googleConnect.connectedEmail,
                    })
                  : t("common.connectGoogle")
              }
              onClick={
                googleConnect.connectedEmail
                  ? googleConnect.disconnect
                  : googleConnect.connect
              }
            >
              {isMobile ? (
                <GoogleIcon style={{ width: ICON_SIZE, height: ICON_SIZE }} />
              ) : googleConnect.connectedEmail ? (
                t("common.googleConnected", {
                  email: googleConnect.connectedEmail,
                })
              ) : (
                t("common.connectGoogle")
              )}
            </Button>
          ) : null}

          {isGoogleSyncAvailable() && googleConnect.connectedEmail ? (
            <Button
              size="xs"
              variant="default"
              className={classes.syncButton}
              color={googleConnect.needsReconnect ? "red" : undefined}
              leftSection={
                isMobile ? undefined : <IconRefresh size={ICON_SIZE} />
              }
              disabled={!googleConnect.needsReconnect && googleConnect.syncing}
              aria-busy={!googleConnect.needsReconnect && googleConnect.syncing}
              aria-label={t(
                googleConnect.needsReconnect
                  ? "common.reconnectLabel"
                  : "common.syncNowLabel",
              )}
              onClick={
                googleConnect.needsReconnect
                  ? googleConnect.connect
                  : googleConnect.syncNow
              }
            >
              {isMobile ? (
                <IconRefresh size={ICON_SIZE} />
              ) : (
                t(
                  googleConnect.needsReconnect
                    ? "common.reconnectLabel"
                    : "common.syncNowLabel",
                )
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
