import type { ReactNode } from "react"
import { Button, Group, NavLink } from "@mantine/core"
import { useDisclosure } from "@mantine/hooks"
import {
  IconCheck,
  IconHome,
  IconMenu2,
  IconRefresh,
} from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { AppDrawer } from "@/components/AppModal/AppDrawer"
import { GoogleIcon } from "@/components/GoogleIcon/GoogleIcon"
import { ICON_SIZE } from "@/constants/icons"
import { APP_ROUTES } from "@/constants/routes"
import type { SettingsItem } from "./TopBar"
import classes from "./TopBar.module.css"

export type TopBarMobileProps = {
  withHomeLink: boolean
  children?: ReactNode
  settingsItems: SettingsItem[]
  googleAvailable: boolean
  showSyncButton: boolean
  syncing: boolean
  needsReconnect: boolean
  googleLabel: string
  syncLabel: string
  onGoogleClick: () => void
  onSyncClick: () => void
}

/**
 * The collapsed TopBar surface below the mobile breakpoint: Home + the
 * Google connect button + a hamburger button that opens a Drawer with the
 * remaining full-text rows. Google stays in this row rather than the drawer
 * so a lost connection (`needsReconnect`) is visible without opening the
 * menu -- `flex-shrink`/truncation keeps its label from pushing Home or the
 * hamburger off-screen at narrow widths (see TopBar.module.css).
 */
export const TopBarMobile = ({
  withHomeLink,
  children,
  settingsItems,
  googleAvailable,
  showSyncButton,
  syncing,
  needsReconnect,
  googleLabel,
  syncLabel,
  onGoogleClick,
  onSyncClick,
}: TopBarMobileProps) => {
  const { t } = useTranslation()
  const [drawerOpened, drawerHandlers] = useDisclosure(false)

  const renderDrawerItem = (item: SettingsItem) => (
    <NavLink
      key={item.key}
      component="button"
      label={item.label}
      leftSection={item.icon}
      rightSection={item.checked ? <IconCheck size={ICON_SIZE} /> : undefined}
      active={item.checked}
      onClick={() => {
        if (item.closesOnClick) {
          drawerHandlers.close()
        }
        item.onClick()
      }}
    />
  )

  return (
    <>
      <Group justify="space-between" gap="xs" wrap="nowrap">
        {withHomeLink ? (
          <Button
            size="xs"
            variant="subtle"
            component={Link}
            to={APP_ROUTES.home}
            aria-label={t("common.home")}
          >
            <IconHome size={ICON_SIZE} />
          </Button>
        ) : (
          <span />
        )}

        {children ? <Group gap="xs">{children}</Group> : null}

        {googleAvailable ? (
          <Button
            size="xs"
            variant="default"
            className={classes.googleButtonMobile}
            color={needsReconnect ? "red" : undefined}
            leftSection={
              <GoogleIcon style={{ width: ICON_SIZE, height: ICON_SIZE }} />
            }
            aria-label={googleLabel}
            onClick={onGoogleClick}
          >
            <span className={classes.truncate}>{googleLabel}</span>
          </Button>
        ) : null}

        <Button
          size="xs"
          variant="default"
          aria-label={t("common.settingsMenu")}
          onClick={drawerHandlers.open}
        >
          <IconMenu2 size={ICON_SIZE} />
        </Button>
      </Group>

      <AppDrawer
        opened={drawerOpened}
        onClose={drawerHandlers.close}
        position="top"
        title={t("common.settingsMenu")}
      >
        {showSyncButton ? (
          <NavLink
            component="button"
            className={classes.syncButton}
            label={syncLabel}
            color={needsReconnect ? "red" : undefined}
            leftSection={<IconRefresh size={ICON_SIZE} />}
            disabled={syncing}
            aria-busy={syncing}
            onClick={() => {
              drawerHandlers.close()
              onSyncClick()
            }}
          />
        ) : null}

        {settingsItems.map(renderDrawerItem)}
      </AppDrawer>
    </>
  )
}
