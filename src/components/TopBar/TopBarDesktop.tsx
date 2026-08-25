import type { ReactNode } from "react"
import { Button, Group, Menu, Tooltip } from "@mantine/core"
import {
  IconCheck,
  IconHome,
  IconRefresh,
  IconSettings,
} from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { GoogleIcon } from "@/components/GoogleIcon/GoogleIcon"
import { ICON_SIZE } from "@/constants/icons"
import { APP_ROUTES } from "@/constants/routes"
import type { SettingsItem } from "./TopBar"
import classes from "./TopBar.module.css"

export type TopBarDesktopProps = {
  withHomeLink: boolean
  children?: ReactNode
  settingsItems: SettingsItem[]
  googleAvailable: boolean
  showSyncButton: boolean
  syncing: boolean
  connecting: boolean
  needsReconnect: boolean
  googleLabel: string
  syncLabel: string
  onGoogleClick: () => void
  onSyncClick: () => void
}

const renderMenuItem = (item: SettingsItem) => {
  const menuItem = (
    <Menu.Item
      key={item.key}
      role={item.checked === undefined ? undefined : "menuitemcheckbox"}
      aria-checked={item.checked}
      color={item.checked ? "brand" : undefined}
      leftSection={item.icon}
      rightSection={item.checked ? <IconCheck size={ICON_SIZE} /> : undefined}
      closeMenuOnClick={item.closesOnClick}
      onClick={item.onClick}
    >
      {item.label}
    </Menu.Item>
  )
  return item.tooltip ? (
    <Tooltip key={item.key} label={item.tooltip}>
      {menuItem}
    </Tooltip>
  ) : (
    menuItem
  )
}

/** The wide, always-expanded TopBar surface shown above the mobile breakpoint. */
export const TopBarDesktop = ({
  withHomeLink,
  children,
  settingsItems,
  googleAvailable,
  showSyncButton,
  syncing,
  connecting,
  needsReconnect,
  googleLabel,
  syncLabel,
  onGoogleClick,
  onSyncClick,
}: TopBarDesktopProps) => {
  const { t } = useTranslation()

  return (
    <Group justify="center" gap="xs" wrap="wrap">
      <Group gap="xs" wrap="wrap">
        {withHomeLink ? (
          <Button
            size="xs"
            variant="subtle"
            component={Link}
            to={APP_ROUTES.home}
            leftSection={<IconHome size={ICON_SIZE} />}
            aria-label={t("common.home")}
          >
            {t("common.home")}
          </Button>
        ) : null}

        <Menu shadow="md" width={220} closeOnItemClick={false}>
          <Menu.Target>
            <Button
              size="xs"
              variant="default"
              leftSection={<IconSettings size={ICON_SIZE} />}
              aria-label={t("common.settingsMenu")}
            >
              {t("common.settingsMenu")}
            </Button>
          </Menu.Target>
          <Menu.Dropdown>{settingsItems.map(renderMenuItem)}</Menu.Dropdown>
        </Menu>

        {googleAvailable ? (
          <Button
            size="xs"
            variant="default"
            leftSection={
              <GoogleIcon style={{ width: ICON_SIZE, height: ICON_SIZE }} />
            }
            loading={connecting}
            aria-label={googleLabel}
            onClick={onGoogleClick}
          >
            {googleLabel}
          </Button>
        ) : null}

        {showSyncButton ? (
          <Button
            size="xs"
            variant="default"
            className={classes.syncButton}
            color={needsReconnect ? "red" : undefined}
            leftSection={<IconRefresh size={ICON_SIZE} />}
            disabled={syncing}
            aria-busy={syncing}
            aria-label={syncLabel}
            onClick={onSyncClick}
          >
            {syncLabel}
          </Button>
        ) : null}
      </Group>

      {children ? <Group gap="xs">{children}</Group> : null}
    </Group>
  )
}
