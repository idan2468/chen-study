import { useEffect, useState } from "react"
import { notifications } from "@mantine/notifications"
import { useTranslation } from "react-i18next"
import { useLatest } from "@/hooks/useLatest"
import { GoogleAuthError } from "@/utils/sync/google/googleAuth"
import { syncIfDirty } from "@/utils/sync/google/driveSync"

const SYNC_INTERVAL_MS = 30_000

/**
 * The push-only triggers on top of `driveSync.ts`'s dirty check: a visible-tab
 * 30-second timer, visibility changes, and manual "Sync now". Returning to a
 * visible tab syncs immediately; hiding keeps the existing final keepalive push.
 * Only Connect and boot ever pull.
 */
export const useDriveSync = (
  connected: boolean,
  reissueForSync: (onSettled: (success: boolean) => void) => void,
) => {
  const { t } = useTranslation()
  const [needsReconnect, setNeedsReconnect] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const attemptSync = async ({
    keepalive,
    silent,
    hasRetried = false,
  }: {
    keepalive: boolean
    silent: boolean
    hasRetried?: boolean
  }) => {
    setSyncing(true)
    try {
      await syncIfDirty(keepalive)
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
      // Retry once so the push doesn't wait a full interval for the token refresh.
      reissueForSync(success => {
        if (success) {
          void attemptSync({ keepalive, silent, hasRetried: true })
        } else {
          setNeedsReconnect(true)
        }
      })
    } finally {
      setSyncing(false)
    }
  }

  const syncSilently = (keepalive = false) => {
    void attemptSync({ keepalive, silent: true })
  }

  const latest = useLatest({ syncSilently, needsReconnect })

  useEffect(() => {
    if (!connected) {
      return
    }
    const interval = setInterval(() => {
      if (
        document.visibilityState !== "visible" ||
        latest.current.needsReconnect
      ) {
        return
      }
      latest.current.syncSilently()
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
      if (latest.current.needsReconnect) {
        return
      }
      latest.current.syncSilently(document.visibilityState === "hidden")
    }
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [connected, latest])

  const syncNow = () => {
    void attemptSync({ keepalive: false, silent: false })
  }

  return { needsReconnect, syncing, syncNow }
}
