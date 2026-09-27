import { createSelector } from "@reduxjs/toolkit"
import { createAppSlice } from "@/store/createAppSlice"
import { readJson, readString } from "@/store/storage"
import type { TimestampedAction } from "@/store/updatedAt"
import { withUpdatedAt, withUpdatedAtOnly } from "@/store/updatedAt"
import { hasWord, keepLastBy } from "@/utils/collections"
import type { IsoTimestamp } from "@/utils/sync/timestamp"
import {
  readLegacyModuleProgress,
  readLegacyModules,
  StorageKeys,
} from "@/utils/sync/legacy/legacyStorage"
import {
  tombstoneValue,
  findLiveValue,
  liveValues,
  upsertValue,
  setValueIfChanged,
  toVersionedValue,
} from "@/utils/sync/versionedValue"
import {
  builtInModuleIds,
  defaultModuleExercises,
} from "@/data/defaultModuleExercises"
import type {
  ModuleCard,
  ModuleExercise,
  ModulesProgress,
} from "@/types/moduleExercise"
import { CardStatus } from "@/types/moduleExercise"
import type { VersionedValue } from "@/types/versionedValue"

export type ModulesState = {
  /** Includes tombstones, so a deleted built-in is not re-seeded. */
  modules: VersionedValue<ModuleExercise>[]
  currentModuleId: VersionedValue<string>
  cardIndex: VersionedValue<number>
  /** "Show only the words I got wrong". */
  filterMissed: boolean
  /** Reviewing missed words pooled from every module, instead of one module. */
  reviewingMissed: boolean
  progress: ModulesProgress
}

/**
 * The original app opened on the fourth module (`currentModuleIndex = 3`).
 * Was stuck at the stale id `"mod3"` after `defaultModuleExercises.ts`
 * renamed its ids to `mod3_short_i` etc, silently falling back to
 * `modules[0]` always.
 */
const PREFERRED_DEFAULT_MODULE_ID = "mod3_short_i"

/**
 * Merges stored modules with the built-ins.
 *
 * Fixes a real bug in the original: once `english_reading_all_modules_v4` was
 * written it *replaced* the built-in list wholesale
 * (`Modules Practice.html:1091-1097`), so a returning user never saw modules
 * added in a later release. Here built-ins are re-seeded by id unless stored
 * (as an edited copy or a deletion tombstone), in their canonical order.
 */
export const mergeModules = (
  stored: readonly VersionedValue<ModuleExercise>[],
): VersionedValue<ModuleExercise>[] => {
  const storedById = new Map(stored.map(entry => [entry.value.id, entry]))
  const builtIns = new Set(builtInModuleIds)

  return [
    ...defaultModuleExercises.map(
      builtIn => storedById.get(builtIn.id) ?? toVersionedValue(builtIn),
    ),
    // User-added modules follow, in the order they were added.
    ...stored.filter(entry => !builtIns.has(entry.value.id)),
  ]
}

/** Prefers the stored module id; falls back to the preferred default, then
 *  the first module, when nothing is stored or the id no longer exists. */
const resolveCurrentId = (
  modules: readonly ModuleExercise[],
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

const hasModuleId = (moduleId: string) => (module: ModuleExercise) =>
  module.id === moduleId

const setModuleProgressStatus = (
  progress: ModulesProgress,
  word: string,
  status: CardStatus,
  updatedAt: IsoTimestamp,
) => {
  upsertValue(progress, hasWord(word), { word, status }, updatedAt)
}

const loadFromStorage = (): ModulesState => {
  const moduleEntries = mergeModules(readLegacyModules())
  const modules = liveValues(moduleEntries)
  const currentModuleId = resolveCurrentId(
    modules,
    readString(StorageKeys.currentModuleId, ""),
  )

  // Clamp in case the module's deck has shrunk since the index was saved.
  const currentModule = modules.find(module => module.id === currentModuleId)
  const storedCardIndex = readJson<number>(StorageKeys.moduleCardIndex, 0)
  const cardIndex = currentModule
    ? Math.min(
        Math.max(storedCardIndex, 0),
        Math.max(currentModule.cards.length - 1, 0),
      )
    : 0

  return {
    modules: moduleEntries,
    currentModuleId: toVersionedValue(currentModuleId),
    cardIndex: toVersionedValue(cardIndex),
    filterMissed: false,
    reviewingMissed: false,
    progress: readLegacyModuleProgress(),
  }
}

const addOrReplaceModule = (
  state: ModulesState,
  module: ModuleExercise,
  updatedAt: IsoTimestamp,
) => {
  const existing = findLiveValue(state.modules, hasModuleId(module.id))
  upsertValue(state.modules, hasModuleId(module.id), module, updatedAt)
  if (!existing) {
    return
  }

  const affectedWords = new Set([
    ...existing.cards.map(card => card.en),
    ...module.cards.map(card => card.en),
  ])
  for (const word of affectedWords) {
    setModuleProgressStatus(state.progress, word, CardStatus.None, updatedAt)
  }

  if (state.currentModuleId.value === module.id) {
    setValueIfChanged(state.cardIndex, 0, updatedAt)
    state.filterMissed = false
  }
}

const openModule = (
  state: ModulesState,
  moduleId: string,
  updatedAt: IsoTimestamp,
) => {
  setValueIfChanged(state.currentModuleId, moduleId, updatedAt)
  setValueIfChanged(state.cardIndex, 0, updatedAt)
  // The original cleared the filter when switching modules.
  state.filterMissed = false
}

export const modulesSlice = createAppSlice({
  name: "modules",
  initialState: loadFromStorage,
  reducers: create => ({
    selectModule: create.preparedReducer(
      withUpdatedAt<string>,
      (state, action: TimestampedAction<string>) => {
        openModule(state, action.payload, action.meta.updatedAt)
      },
    ),

    setCardIndex: create.preparedReducer(
      withUpdatedAt<number>,
      (state, action: TimestampedAction<number>) => {
        setValueIfChanged(
          state.cardIndex,
          Math.max(0, action.payload),
          action.meta.updatedAt,
        )
      },
    ),

    nextCard: create.preparedReducer(
      withUpdatedAt<number>,
      (state, action: TimestampedAction<number>) => {
        // Payload is the active list length; no wraparound, as in the original.
        setValueIfChanged(
          state.cardIndex,
          Math.min(state.cardIndex.value + 1, action.payload - 1),
          action.meta.updatedAt,
        )
      },
    ),

    prevCard: create.preparedReducer(
      withUpdatedAtOnly,
      (state, action: TimestampedAction) => {
        setValueIfChanged(
          state.cardIndex,
          Math.max(state.cardIndex.value - 1, 0),
          action.meta.updatedAt,
        )
      },
    ),

    toggleFilterMissed: create.preparedReducer(
      withUpdatedAtOnly,
      (state, action: TimestampedAction) => {
        state.filterMissed = !state.filterMissed
        setValueIfChanged(state.cardIndex, 0, action.meta.updatedAt)
      },
    ),

    toggleMissedReview: create.preparedReducer(
      withUpdatedAtOnly,
      (state, action: TimestampedAction) => {
        state.reviewingMissed = !state.reviewingMissed
        setValueIfChanged(state.cardIndex, 0, action.meta.updatedAt)
      },
    ),

    /** Unlike the Unseen flashcards, re-marking the same status is not a toggle. */
    markCard: create.preparedReducer(
      withUpdatedAt<{ word: string; isKnown: boolean }>,
      (
        state,
        action: TimestampedAction<{ word: string; isKnown: boolean }>,
      ) => {
        const { word, isKnown } = action.payload
        setModuleProgressStatus(
          state.progress,
          word,
          isKnown ? CardStatus.Known : CardStatus.Unknown,
          action.meta.updatedAt,
        )
      },
    ),

    /** Clears progress for the current module's words only. */
    resetCurrentModuleProgress: create.preparedReducer(
      withUpdatedAtOnly,
      (state, action: TimestampedAction) => {
        const current = findLiveValue(
          state.modules,
          hasModuleId(state.currentModuleId.value),
        )
        for (const card of current?.cards ?? []) {
          setModuleProgressStatus(
            state.progress,
            card.en,
            CardStatus.None,
            action.meta.updatedAt,
          )
        }
        setValueIfChanged(state.cardIndex, 0, action.meta.updatedAt)
        state.filterMissed = false
      },
    ),

    /** Adds or replaces imported modules; selecting one is left to the caller
     *  (see `ModulesPage.tsx`). */
    addModules: create.preparedReducer(
      withUpdatedAt<ModuleExercise[]>,
      (state, action: TimestampedAction<ModuleExercise[]>) => {
        const finalModules = keepLastBy(action.payload, module => module.id)
        for (const module of finalModules) {
          addOrReplaceModule(state, module, action.meta.updatedAt)
        }
      },
    ),

    deleteModule: create.preparedReducer(
      withUpdatedAt<string>,
      (state, action: TimestampedAction<string>) => {
        const modules = liveValues(state.modules)
        // Refuse to leave the user with nothing, as the original did.
        if (modules.length <= 1) {
          return
        }

        const index = modules.findIndex(hasModuleId(action.payload))
        if (index < 0) {
          return
        }

        tombstoneValue(
          state.modules,
          hasModuleId(action.payload),
          action.meta.updatedAt,
        )

        if (state.currentModuleId.value === action.payload) {
          // Keep the neighbouring tab selected rather than jumping to the start.
          const remaining = liveValues(state.modules)
          openModule(
            state,
            remaining[Math.min(index, remaining.length - 1)]?.id ?? "",
            action.meta.updatedAt,
          )
        }
      },
    ),

    reloadFromStorage: create.reducer(() => loadFromStorage()),
  }),
  selectors: {
    selectModuleEntries: state => state.modules,
    selectCurrentModuleId: state => state.currentModuleId.value,
    selectModuleCardIndex: state => state.cardIndex.value,
    selectFilterMissed: state => state.filterMissed,
    selectReviewingMissed: state => state.reviewingMissed,
    selectModuleProgressEntries: state => state.progress,
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
  reloadFromStorage,
} = modulesSlice.actions

export const {
  selectModuleEntries,
  selectCurrentModuleId,
  selectModuleCardIndex,
  selectFilterMissed,
  selectReviewingMissed,
  selectModuleProgressEntries,
} = modulesSlice.selectors

/* ---------------------------------------------------------------- *
 * Derived state. These were mutable globals in the original app
 * (`currentDataset`, `activeCardsList`) kept in sync by hand.
 * ---------------------------------------------------------------- */

export const selectModules = createSelector([selectModuleEntries], liveValues)

export const selectModulesProgress = createSelector(
  [selectModuleProgressEntries],
  progress =>
    Object.fromEntries(
      liveValues(progress).map(({ word, status }) => [word, status]),
    ),
)

export const selectCurrentModule = createSelector(
  [selectModules, selectCurrentModuleId],
  (modules, currentId) =>
    modules.find(module => module.id === currentId) ?? modules[0],
)

export const selectModuleOptions = createSelector(
  [selectModules, selectModulesProgress],
  (modules, progress) =>
    modules.map(module => ({
      value: module.id,
      label: module.tabName,
      completed:
        module.cards.length > 0 &&
        module.cards.every(card => {
          const status = progress[card.en]
          return status === CardStatus.Known || status === CardStatus.Unknown
        }),
    })),
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
        if (progress[card.en] === CardStatus.Unknown && !seen.has(card.en)) {
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
    return cards.filter(card => progress[card.en] !== CardStatus.Known)
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
      if (status === CardStatus.Known) {
        known += 1
      } else if (status === CardStatus.Unknown) {
        unknown += 1
      }
    }
    return { known, unknown, pending: cards.length - known - unknown }
  },
)
