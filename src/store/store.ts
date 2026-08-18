import type { Action, ThunkAction } from "@reduxjs/toolkit"
import { combineSlices, configureStore } from "@reduxjs/toolkit"
import { listenerMiddleware } from "./listenerMiddleware"
import { modulesSlice } from "./slices/modulesSlice"
import { settingsSlice } from "./slices/settingsSlice"
import { speechSlice } from "./slices/speechSlice"
import { unseenSlice } from "./slices/unseenSlice"

// `combineSlices` automatically combines the reducers using
// their `reducerPath`s, therefore we no longer need to call `combineReducers`.
const rootReducer = combineSlices(
  settingsSlice,
  speechSlice,
  unseenSlice,
  modulesSlice,
)
// Infer the `RootState` type from the root reducer
export type RootState = ReturnType<typeof rootReducer>

// The store setup is wrapped in `makeStore` to allow reuse
// when setting up tests that need the same store config
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
// Infer the `AppDispatch` type from the store itself
export type AppDispatch = AppStore["dispatch"]
export type AppThunk<ThunkReturnType = void> = ThunkAction<
  ThunkReturnType,
  RootState,
  unknown,
  Action
>
