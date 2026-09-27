import { useEffect, useState } from "react"
import { notifications } from "@mantine/notifications"
import { useTranslation } from "react-i18next"
import { useLatest } from "@/hooks/useLatest"
import { useSyncWithDrive } from "@/hooks/useSyncWithDrive"
import { GoogleAuthError } from "@/utils/sync/google/googleAuth"

const SYNC_INTERVAL_MS = 30_000

/**
 * The session triggers for `syncWithDrive`: a visible-tab 30-second timer,
 * returning to a visible tab, and manual "Sync now". Hidden tabs never sync.
 */
export const useDriveSync = (
  connected: boolean,
  reissueForSync: (onSettled: (success: boolean) => void) => void,
) => {
  const { t } = useTranslation()
  const sync = useSyncWithDrive()
  const [needsReconnect, setNeedsReconnect] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const attemptSync = async ({
    silent,
    hasRetried = false,
  }: {
    silent: boolean
    hasRetried?: boolean
  }) => {
    setSyncing(true)
    try {
      await sync()
      setNeedsReconnect(false)
      if (!silent) {
        notifications.show({
          color: "green",
          message: t("common.googleSyncSuccess"),
        })
      }
    } catch (error) {
      if (!(error instanceof GoogleAuthError)) {
        if (!silent) {
          notifications.show({
            color: "red",
            message: t("common.googleSyncError"),
          })
        }
        return
      }
      if (hasRetried) {
        setNeedsReconnect(true)
        return
      }
      // Retry once so the sync doesn't wait a full interval for the token refresh.
      reissueForSync(success => {
        if (success) {
          void attemptSync({ silent, hasRetried: true })
        } else {
          setNeedsReconnect(true)
        }
      })
    } finally {
      setSyncing(false)
    }
  }

  /** Background triggers skip hidden tabs and wait for a reconnect after a failed re-issue. */
  const syncSilentlyIfVisible = () => {
    if (document.visibilityState === "visible" && !needsReconnect) {
      void attemptSync({ silent: true })
    }
  }

  const latest = useLatest({ syncSilentlyIfVisible })

  useEffect(() => {
    if (!connected) {
      return
    }
    const interval = setInterval(() => {
      latest.current.syncSilentlyIfVisible()
    }, SYNC_INTERVAL_MS)
    return () => {
      clearInterval(interval)
    }
  }, [connected, latest])

  useEffect(() => {
    if (!connected) {
      return
    }
    const onVisibilityChange = () => {
      latest.current.syncSilentlyIfVisible()
    }
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [connected, latest])

  const syncNow = () => {
    void attemptSync({ silent: false })
  }

  return { needsReconnect, syncing, syncNow }
}
