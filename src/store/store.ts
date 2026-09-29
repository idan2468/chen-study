import type { Action, ThunkAction } from "@reduxjs/toolkit"
import { combineSlices, configureStore } from "@reduxjs/toolkit"
import { listenerMiddleware } from "@/store/listenerMiddleware"
import { modulesSlice } from "@/store/slices/modulesSlice"
import { settingsSlice } from "@/store/slices/settingsSlice"
import { speechSlice } from "@/store/slices/speechSlice"
import { unseenSlice } from "@/store/slices/unseenSlice"

const rootReducer = combineSlices(
  settingsSlice,
  speechSlice,
  unseenSlice,
  modulesSlice,
)
export type RootState = ReturnType<typeof rootReducer>

// Wrapped in a factory so tests can create isolated store instances with the
// same config instead of sharing one module-scope store.
export const makeStore = (preloadedState?: Partial<RootState>) => {
  return configureStore({
    reducer: rootReducer,
    // The listener middleware persists state to localStorage; it has to be
    // prepended so it sees actions before the default middleware.
    middleware: getDefaultMiddleware =>
      getDefaultMiddleware().prepend(listenerMiddleware.middleware),
    preloadedState,
  })
}

export type AppStore = ReturnType<typeof makeStore>
export type AppDispatch = AppStore["dispatch"]
export type AppThunk<ThunkReturnType = void> = ThunkAction<
  ThunkReturnType,
  RootState,
  unknown,
  Action
>
