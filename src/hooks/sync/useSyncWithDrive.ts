import { useAppStore } from "@/store/hooks"
import { reloadFromStorage, selectPersistedState } from "@/store/persistedState"
import { syncWithDrive } from "@/utils/sync/google/driveSync"

/** Binds `syncWithDrive` to this app's store, for every sync trigger. */
export const useSyncWithDrive = () => {
  const store = useAppStore()
  return () =>
    syncWithDrive(
      () => selectPersistedState(store.getState()),
      () => store.dispatch(reloadFromStorage()),
    )
}
