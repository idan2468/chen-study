import { createSelector } from "@reduxjs/toolkit"
import { createAppSlice } from "@/store/createAppSlice"
import {
  readLocalPersistedState,
  reloadFromStorage,
} from "@/store/persistedState"
import type { TimestampedAction } from "@/store/updatedAt"
import { withUpdatedAt, withUpdatedAtOnly } from "@/store/updatedAt"
import { clampIndex, hasWord, keepLastBy } from "@/utils/collections"
import type { IsoTimestamp } from "@/utils/sync/timestamp"
import { readLegacyModulesState } from "@/utils/sync/legacy/legacyStorage"
import {
  findLiveValue,
  liveValues,
  setValueIfChanged,
  tombstoneValue,
  upsertValue,
} from "@/utils/sync/versionedValue"
import type {
  ModuleCard,
  ModuleExercise,
  ModulesProgress,
} from "@/types/moduleExercise"
import { CardStatus } from "@/types/moduleExercise"
import type { VersionedValue } from "@/types/versionedValue"

export type ModulesState = {
  /** Includes tombstones, so a deletion reaches your other devices. */
  modules: VersionedValue<ModuleExercise>[]
  currentModuleId: VersionedValue<string>
  cardIndex: VersionedValue<number>
  /** "Show only the words I got wrong". */
  filterMissed: boolean
  /** Reviewing missed words pooled from every module, instead of one module. */
  reviewingMissed: boolean
  progress: ModulesProgress
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

/** Loads local v2 as stored; built-ins are only the default for an empty state. */
const loadFromStorage = (): ModulesState => ({
  ...(readLocalPersistedState()?.modules ?? readLegacyModulesState()),
  filterMissed: false,
  reviewingMissed: false,
})

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

    /** Payload is the active list's length; no wraparound, as in the original. */
    nextCard: create.preparedReducer(
      withUpdatedAt<number>,
      (state, action: TimestampedAction<number>) => {
        const length = action.payload
        setValueIfChanged(
          state.cardIndex,
          clampIndex(clampIndex(state.cardIndex.value, length) + 1, length),
          action.meta.updatedAt,
        )
      },
    ),

    /** Payload is the active list's length. */
    prevCard: create.preparedReducer(
      withUpdatedAt<number>,
      (state, action: TimestampedAction<number>) => {
        const length = action.payload
        setValueIfChanged(
          state.cardIndex,
          clampIndex(clampIndex(state.cardIndex.value, length) - 1, length),
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
  }),
  extraReducers: builder => {
    builder.addCase(reloadFromStorage, () => loadFromStorage())
  },
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

/** The stored index clamped to the active list, which a review mode or a replaced deck can shrink. */
export const selectModuleCardPosition = createSelector(
  [selectActiveCards, selectModuleCardIndex],
  (cards, index) => clampIndex(index, cards.length),
)

export const selectCurrentCard = createSelector(
  [selectActiveCards, selectModuleCardPosition],
  (cards, position) => cards[position],
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
