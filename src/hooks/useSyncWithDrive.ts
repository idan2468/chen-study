import { useRehydrateFromStorage } from "@/hooks/useRehydrateFromStorage"
import { useAppStore } from "@/store/hooks"
import { selectPersistedState } from "@/store/persistedState"
import { syncWithDrive } from "@/utils/sync/google/driveSync"

/** Binds `syncWithDrive` to this app's store and rehydration, for every sync trigger. */
export const useSyncWithDrive = () => {
  const store = useAppStore()
  const rehydrate = useRehydrateFromStorage()
  return () =>
    syncWithDrive(() => selectPersistedState(store.getState()), rehydrate)
}
