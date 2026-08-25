import type { ReactNode } from "react"
import { Paper, useMantineColorScheme } from "@mantine/core"
import { useDisclosure, useMediaQuery } from "@mantine/hooks"
import {
  IconLanguage,
  IconLink,
  IconMicrophone,
  IconMoon,
  IconSun,
  IconTextSize,
} from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { SpeechSettingsModal } from "@/components/SpeechSettingsModal/SpeechSettingsModal"
import { SyncModal } from "@/components/SyncModal/SyncModal"
import { ICON_SIZE } from "@/constants/icons"
import { useGoogleConnectContext } from "@/hooks/GoogleConnectContext"
import { useLocale } from "@/i18n/useLocale"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import {
  selectDyslexiaFont,
  toggleDyslexiaFont,
} from "@/store/slices/settingsSlice"
import { isGoogleSyncAvailable } from "@/utils/sync/google/googleAuth"
import { TopBarDesktop } from "./TopBarDesktop"
import { TopBarMobile } from "./TopBarMobile"

export type TopBarProps = {
  /** Page-specific controls, e.g. the Unseen page's exercise picker. */
  children?: ReactNode
  /** Hidden on the hub, which is itself the home page. */
  withHomeLink?: boolean
}

/** One rare-use toggle, shared between the desktop Settings menu and the mobile drawer. */
export type SettingsItem = {
  key: string
  label: string
  icon: ReactNode
  /** Undefined for actions that aren't a toggle (e.g. "Voice settings"). */
  checked?: boolean
  tooltip?: string
  /** Toggles stay open so several can be flipped in one visit; actions that open another overlay close first. */
  closesOnClick?: boolean
  onClick: () => void
}

/**
 * The accessibility / utility bar. Replaces the `.top-bar` + `.a11y-btn` group
 * that both original pages carried their own copy of, along with
 * `applyDyslexiaFont` / `toggleDyslexiaFont` / `applyDarkMode` /
 * `toggleDarkMode`.
 *
 * Picks between the plain, prop-driven `TopBarDesktop` and `TopBarMobile`
 * based on viewport width, and owns everything they share: labels, click
 * handlers, the settings items list, and the two modals.
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
  const isMobile = useMediaQuery("(max-width: 36em)")

  const isDark = colorScheme === "dark"
  const googleAvailable = isGoogleSyncAvailable()
  const showSyncButton =
    googleAvailable && Boolean(googleConnect.connectedEmail)
  const syncing = !googleConnect.needsReconnect && googleConnect.syncing

  const googleLabel = googleConnect.connectedEmail
    ? t("common.googleConnected", { email: googleConnect.connectedEmail })
    : t("common.connectGoogle")

  const syncLabel = t(
    googleConnect.needsReconnect
      ? "common.reconnectLabel"
      : "common.syncNowLabel",
  )

  const onGoogleClick = () => {
    if (googleConnect.connectedEmail) {
      googleConnect.disconnect()
    } else {
      googleConnect.connect()
    }
  }

  const onSyncClick = () => {
    if (googleConnect.needsReconnect) {
      googleConnect.connect()
    } else {
      googleConnect.syncNow()
    }
  }

  const settingsItems: SettingsItem[] = [
    {
      key: "dyslexiaFont",
      label: t("common.dyslexiaFont"),
      icon: <IconTextSize size={ICON_SIZE} />,
      checked: dyslexiaFont,
      tooltip: t("common.dyslexiaFontTooltip"),
      onClick: () => dispatch(toggleDyslexiaFont()),
    },
    {
      key: "colorScheme",
      label: isDark ? t("common.dayMode") : t("common.nightMode"),
      icon: isDark ? (
        <IconSun size={ICON_SIZE} />
      ) : (
        <IconMoon size={ICON_SIZE} />
      ),
      onClick: toggleColorScheme,
    },
    {
      key: "locale",
      label:
        locale === "he"
          ? t("common.switchToEnglish")
          : t("common.switchToHebrew"),
      icon: <IconLanguage size={ICON_SIZE} />,
      tooltip: t("common.languageTooltip"),
      onClick: toggleLocale,
    },
    {
      key: "voiceSettings",
      label: t("common.voiceSettings"),
      icon: <IconMicrophone size={ICON_SIZE} />,
      closesOnClick: true,
      onClick: speechHandlers.open,
    },
    {
      key: "syncDevices",
      label: t("common.syncDevices"),
      icon: <IconLink size={ICON_SIZE} />,
      closesOnClick: true,
      onClick: syncHandlers.open,
    },
  ]

  const sharedProps = {
    withHomeLink,
    settingsItems,
    googleAvailable,
    showSyncButton,
    syncing,
    connecting: googleConnect.connecting,
    needsReconnect: googleConnect.needsReconnect,
    googleLabel,
    syncLabel,
    onGoogleClick,
    onSyncClick,
  }

  return (
    <Paper withBorder={!isMobile} p="xs" radius="md" w="100%">
      {isMobile ? (
        <TopBarMobile {...sharedProps}>{children}</TopBarMobile>
      ) : (
        <TopBarDesktop {...sharedProps}>{children}</TopBarDesktop>
      )}

      <SyncModal opened={syncOpened} onClose={syncHandlers.close} />
      <SpeechSettingsModal
        opened={speechOpened}
        onClose={speechHandlers.close}
      />
    </Paper>
  )
}
