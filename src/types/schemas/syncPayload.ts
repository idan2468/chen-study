import { z } from "zod"

/**
 * Shape of a synced snapshot -- the localStorage key/value pairs shipped in a
 * `?s=` link (`src/utils/syncUrl.ts`) or the Drive file (`driveStore.ts`).
 */
export const syncPayloadSchema = z.record(z.string(), z.string())
export type SyncPayload = z.infer<typeof syncPayloadSchema>
