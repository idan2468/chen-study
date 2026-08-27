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
 * The collapsed TopBar surface below the mobile breakpoint: Home + a
 * hamburger button that opens a Drawer with full-text rows -- icon-only
 * buttons can't show connected-state text (e.g. the Google email) without
 * wrapping to a second row or a tiny indicator dot that gets clipped by the
 * button's rounded corner.
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
      <Group justify="space-between" gap="xs">
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
        {googleAvailable ? (
          <NavLink
            component="button"
            label={googleLabel}
            leftSection={
              <GoogleIcon style={{ width: ICON_SIZE, height: ICON_SIZE }} />
            }
            onClick={() => {
              drawerHandlers.close()
              onGoogleClick()
            }}
          />
        ) : null}

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
