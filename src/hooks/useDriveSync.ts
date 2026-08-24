import { useEffect, useState } from "react"
import { notifications } from "@mantine/notifications"
import { useTranslation } from "react-i18next"
import { useLatest } from "@/hooks/useLatest"
import { GoogleAuthError } from "@/utils/sync/google/googleAuth"
import { syncIfDirty } from "@/utils/sync/google/driveSync"

const SYNC_INTERVAL_MS = 30_000

/**
 * The push-only triggers on top of `driveSync.ts`'s dirty check -- a
 * 30-second timer, a push on page hide, and manual "Sync now" -- see
 * "Trigger mechanics" in docs/google-account-sync.md. Only Connect and boot
 * ever pull, so all three of these only push.
 */
export const useDriveSync = (
  connected: boolean,
  reissueForSync: (onSettled: (success: boolean) => void) => void,
) => {
  const { t } = useTranslation()
  const [needsReconnect, setNeedsReconnect] = useState(false)

  const attemptSync = async ({
    keepalive,
    silent,
    hasRetried = false,
  }: {
    keepalive: boolean
    silent: boolean
    hasRetried?: boolean
  }) => {
    try {
      await syncIfDirty(keepalive)
      setNeedsReconnect(false)
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
      // A silent re-issue only refreshes the token -- retrying once here
      // picks the push back up without the timer having to wait a full
      // interval for it.
      reissueForSync(success => {
        if (success) {
          void attemptSync({ keepalive, silent, hasRetried: true })
        } else {
          setNeedsReconnect(true)
        }
      })
    }
  }

  const latest = useLatest({ attemptSync, needsReconnect })

  useEffect(() => {
    if (!connected) {
      return
    }
    const interval = setInterval(() => {
      if (latest.current.needsReconnect) {
        return
      }
      void latest.current.attemptSync({ keepalive: false, silent: true })
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
      if (
        document.visibilityState !== "hidden" ||
        latest.current.needsReconnect
      ) {
        return
      }
      void latest.current.attemptSync({ keepalive: true, silent: true })
    }
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [connected, latest])

  const syncNow = () => {
    void attemptSync({ keepalive: false, silent: false })
  }

  return { needsReconnect, syncNow }
}
