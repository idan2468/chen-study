import type { Action, ThunkAction } from "@reduxjs/toolkit"
import { combineSlices, configureStore } from "@reduxjs/toolkit"
import { listenerMiddleware } from "./listenerMiddleware"
import { modulesSlice } from "./slices/modulesSlice"
import { settingsSlice } from "./slices/settingsSlice"
import { speechSlice } from "./slices/speechSlice"
import { unseenSlice } from "./slices/unseenSlice"

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

// Deliberately no module-scope `store`: every slice reads localStorage in a
// lazy initializer, so the store must not be built until `main.tsx` has had a
// chance to import a `?sync=` payload first.
export type AppStore = ReturnType<typeof makeStore>
export type AppDispatch = AppStore["dispatch"]
export type AppThunk<ThunkReturnType = void> = ThunkAction<
  ThunkReturnType,
  RootState,
  unknown,
  Action
>
