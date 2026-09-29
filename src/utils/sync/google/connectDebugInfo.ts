import { toIsoTimestamp } from "@/utils/sync/timestamp"

/** Where in the connect flow it failed. */
export type ConnectFailureStage =
  "scopesNotGranted" | "login" | "connect" | "bootReissue"

const describeError = (error: unknown) =>
  error instanceof Error
    ? { name: error.name, message: error.message, stack: error.stack }
    : error

/**
 * A JSON report of a failed Google connect, for the user to copy while investigating.
 * @param detail The thrown error or GIS error response. Must never carry the access token.
 */
export const buildConnectDebugInfo = (
  stage: ConnectFailureStage,
  detail: unknown,
): string =>
  JSON.stringify(
    {
      stage,
      time: toIsoTimestamp(new Date()),
      origin: window.location.origin,
      route: window.location.hash,
      online: navigator.onLine,
      userAgent: navigator.userAgent,
      detail: describeError(detail),
    },
    null,
    2,
  )
