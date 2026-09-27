// The one place allowed to import the raw hooks; everywhere else must use
// the typed versions exported below (enforced by `no-restricted-imports`).
/* eslint-disable no-restricted-imports */
import { useDispatch, useSelector, useStore } from "react-redux"
import type { AppDispatch, AppStore, RootState } from "./store"

export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export const useAppSelector = useSelector.withTypes<RootState>()
export const useAppStore = useStore.withTypes<AppStore>()
