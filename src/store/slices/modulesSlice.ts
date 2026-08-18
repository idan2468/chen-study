import type { PayloadAction } from "@reduxjs/toolkit"
import { createSelector } from "@reduxjs/toolkit"
import { createAppSlice } from "@/store/createAppSlice"
import { deleteEntry } from "@/store/records"
import { readJson, readString } from "@/store/storage"
import { StorageKeys } from "@/utils/storageKeys"
import { builtInModuleIds, defaultModules } from "@/data/defaultModules"
import type {
  ModuleCard,
  ModulesProgress,
  PracticeModule,
} from "@/types/module"

export type ModulesState = {
  modules: PracticeModule[]
  currentModuleId: string
  cardIndex: number
  /** "Show only the words I got wrong". */
  filterMissed: boolean
  /** Reviewing missed words pooled from every module, instead of one module. */
  reviewingMissed: boolean
  progress: ModulesProgress
  /** Built-ins the user deleted, so hydration does not re-seed them. */
  deletedBuiltInIds: string[]
}

/**
 * The original app opened on the fourth module (`currentModuleIndex = 3`).
 * Bug fix: `defaultModules.ts`'s ids were renamed (`mod3` -> `mod3_short_i`)
 * without updating this constant, so it never matched and this fallback
 * silently always resolved to `modules[0]` instead.
 */
const PREFERRED_DEFAULT_MODULE_ID = "mod3_short_i"

/**
 * Merges stored modules with the built-ins.
 *
 * Fixes a real bug in the original: once `english_reading_all_modules_v4` was
 * written it *replaced* the built-in list wholesale
 * (`Modules Practice.html:1091-1097`), so a returning user never saw modules
 * added in a later release. Here built-ins are re-seeded by id unless the user
 * deleted them, and a stored copy of a built-in wins so edits are kept.
 */
export const mergeModules = (
  stored: readonly PracticeModule[],
  deletedIds: readonly string[],
): PracticeModule[] => {
  const deleted = new Set(deletedIds)
  const storedById = new Map(stored.map(module => [module.id, module]))
  const builtIns = new Set(builtInModuleIds)

  const merged: PracticeModule[] = []

  // Built-ins keep their canonical order.
  for (const builtIn of defaultModules) {
    if (deleted.has(builtIn.id)) {
      continue
    }
    merged.push(storedById.get(builtIn.id) ?? builtIn)
  }

  // User-added modules follow, in the order they were added.
  for (const module of stored) {
    if (!builtIns.has(module.id)) {
      merged.push(module)
    }
  }

  return merged
}

/** Prefers the stored module id; falls back to the preferred default, then
 *  the first module, when nothing is stored or the id no longer exists. */
const resolveCurrentId = (
  modules: readonly PracticeModule[],
  storedId: string,
) => {
  if (storedId && modules.some(module => module.id === storedId)) {
    return storedId
  }
  const preferred = modules.find(
    module => module.id === PREFERRED_DEFAULT_MODULE_ID,
  )
  return preferred?.id ?? modules[0]?.id ?? ""
}

const readInitialState = (): ModulesState => {
  const stored = readJson<PracticeModule[]>(StorageKeys.allModules, [])
  const deletedBuiltInIds = readJson<string[]>(
    StorageKeys.deletedBuiltInModules,
    [],
  )
  const modules = mergeModules(stored, deletedBuiltInIds)
  const currentModuleId = resolveCurrentId(
    modules,
    readString(StorageKeys.currentModuleId, ""),
  )

  // The stored index is only meaningful for the module it was saved
  // against -- if that module's deck has since shrunk, clamp rather than
  // risk an out-of-range index.
  const currentModule = modules.find(module => module.id === currentModuleId)
  const storedCardIndex = readJson<number>(StorageKeys.moduleCardIndex, 0)
  const cardIndex = currentModule
    ? Math.min(
        Math.max(storedCardIndex, 0),
        Math.max(currentModule.cards.length - 1, 0),
      )
    : 0

  return {
    modules,
    currentModuleId,
    cardIndex,
    filterMissed: false,
    reviewingMissed: false,
    progress: readJson<ModulesProgress>(StorageKeys.modulesProgress, {}),
    deletedBuiltInIds,
  }
}

export const modulesSlice = createAppSlice({
  name: "modules",
  // Lazy initializer, so localStorage is read at store-creation time -- after
  // any `?sync=` payload has been imported. See `src/main.tsx`.
  initialState: readInitialState,
  reducers: create => ({
    selectModule: create.reducer((state, action: PayloadAction<string>) => {
      state.currentModuleId = action.payload
      state.cardIndex = 0
      // The original cleared the filter when switching modules.
      state.filterMissed = false
    }),

    setCardIndex: create.reducer((state, action: PayloadAction<number>) => {
      state.cardIndex = Math.max(0, action.payload)
    }),

    nextCard: create.reducer((state, action: PayloadAction<number>) => {
      // Payload is the active list length; no wraparound, as in the original.
      state.cardIndex = Math.min(state.cardIndex + 1, action.payload - 1)
    }),

    prevCard: create.reducer(state => {
      state.cardIndex = Math.max(state.cardIndex - 1, 0)
    }),

    toggleFilterMissed: create.reducer(state => {
      state.filterMissed = !state.filterMissed
      state.cardIndex = 0
    }),

    toggleMissedReview: create.reducer(state => {
      state.reviewingMissed = !state.reviewingMissed
      state.cardIndex = 0
    }),

    /** Unlike the Unseen flashcards, re-marking the same status is not a toggle. */
    markCard: create.reducer(
      (state, action: PayloadAction<{ word: string; isKnown: boolean }>) => {
        const { word, isKnown } = action.payload
        state.progress[word] = isKnown ? "known" : "unknown"
      },
    ),

    /** Clears progress for the current module's words only. */
    resetCurrentModuleProgress: create.reducer(state => {
      const current = state.modules.find(
        module => module.id === state.currentModuleId,
      )
      for (const card of current?.cards ?? []) {
        deleteEntry(state.progress, card.en)
      }
      state.cardIndex = 0
      state.filterMissed = false
    }),

    /** Appends imported modules and jumps to the first one. */
    addModules: create.reducer(
      (state, action: PayloadAction<PracticeModule[]>) => {
        if (action.payload.length === 0) {
          return
        }
        state.modules.push(...action.payload)
        // Re-adding a previously deleted built-in un-deletes it.
        const addedIds = new Set(action.payload.map(module => module.id))
        state.deletedBuiltInIds = state.deletedBuiltInIds.filter(
          id => !addedIds.has(id),
        )
      },
    ),

    deleteModule: create.reducer((state, action: PayloadAction<string>) => {
      // Refuse to leave the user with nothing, as the original did.
      if (state.modules.length <= 1) {
        return
      }

      const index = state.modules.findIndex(
        module => module.id === action.payload,
      )
      if (index < 0) {
        return
      }

      state.modules.splice(index, 1)

      if (
        builtInModuleIds.includes(action.payload) &&
        !state.deletedBuiltInIds.includes(action.payload)
      ) {
        state.deletedBuiltInIds.push(action.payload)
      }

      if (state.currentModuleId === action.payload) {
        // Keep the neighbouring tab selected rather than jumping to the start.
        state.currentModuleId =
          state.modules[Math.min(index, state.modules.length - 1)]?.id ?? ""
        state.cardIndex = 0
        state.filterMissed = false
      }
    }),
  }),
  selectors: {
    selectModules: state => state.modules,
    selectCurrentModuleId: state => state.currentModuleId,
    selectModuleCardIndex: state => state.cardIndex,
    selectFilterMissed: state => state.filterMissed,
    selectReviewingMissed: state => state.reviewingMissed,
    selectModulesProgress: state => state.progress,
    selectDeletedBuiltInIds: state => state.deletedBuiltInIds,
  },
})

export const {
  selectModule,
  setCardIndex,
  nextCard,
  prevCard,
  toggleFilterMissed,
  toggleMissedReview,
  markCard,
  resetCurrentModuleProgress,
  addModules,
  deleteModule,
} = modulesSlice.actions

export const {
  selectModules,
  selectCurrentModuleId,
  selectModuleCardIndex,
  selectFilterMissed,
  selectReviewingMissed,
  selectModulesProgress,
  selectDeletedBuiltInIds,
} = modulesSlice.selectors

/* ---------------------------------------------------------------- *
 * Derived state. These were mutable globals in the original app
 * (`currentDataset`, `activeCardsList`) kept in sync by hand.
 * ---------------------------------------------------------------- */

export const selectCurrentModule = createSelector(
  [selectModules, selectCurrentModuleId],
  (modules, currentId) =>
    modules.find(module => module.id === currentId) ?? modules[0],
)

/**
 * Every word marked "unknown" in any module, deduplicated by word (the same
 * word can appear in several modules and shares one status across all of
 * them -- see `modules.progress`). Powers "practice missed words" across the
 * whole library rather than one module at a time.
 */
export const selectMissedWordsAcrossModules = createSelector(
  [selectModules, selectModulesProgress],
  (modules, progress): ModuleCard[] => {
    const seen = new Set<string>()
    const missed: ModuleCard[] = []
    for (const module of modules) {
      for (const card of module.cards) {
        if (progress[card.en] === "unknown" && !seen.has(card.en)) {
          seen.add(card.en)
          missed.push(card)
        }
      }
    }
    return missed
  },
)

export const selectActiveCards = createSelector(
  [
    selectCurrentModule,
    selectFilterMissed,
    selectModulesProgress,
    selectReviewingMissed,
    selectMissedWordsAcrossModules,
  ],
  (
    module,
    filterMissed,
    progress,
    reviewingMissed,
    missedAcrossModules,
  ): ModuleCard[] => {
    if (reviewingMissed) {
      return missedAcrossModules
    }
    const cards = module?.cards ?? []
    if (!filterMissed) {
      return cards
    }
    return cards.filter(card => progress[card.en] !== "known")
  },
)

export const selectCurrentCard = createSelector(
  [selectActiveCards, selectModuleCardIndex],
  (cards, index) => cards[index],
)

export const selectModuleStats = createSelector(
  [selectCurrentModule, selectModulesProgress],
  (module, progress) => {
    const cards = module?.cards ?? []
    let known = 0
    let unknown = 0
    for (const card of cards) {
      const status = progress[card.en]
      if (status === "known") {
        known += 1
      } else if (status === "unknown") {
        unknown += 1
      }
    }
    return { known, unknown, pending: cards.length - known - unknown }
  },
)
