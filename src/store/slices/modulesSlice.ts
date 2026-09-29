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
  /** Set while reviewing missed words pooled from every module. */
  missedReview: MissedReview | null
  progress: ModulesProgress
}

export type MissedReview = {
  /** The words that were unknown when the review started; fixed for the session. */
  words: string[]
  /** This session's marks, shown instead of the saved progress. */
  sessionProgress: Record<string, CardStatus>
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
  missedReview: null,
})

/**
 * Every word marked "unknown" in any module, deduplicated by word (the same
 * word can appear in several modules and shares one status across all of
 * them -- see `modules.progress`).
 */
const collectMissedCards = (
  modules: readonly ModuleExercise[],
  progress: Record<string, CardStatus>,
): ModuleCard[] => {
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
}

const toStatusByWord = (progress: ModulesProgress) =>
  Object.fromEntries(
    liveValues(progress).map(({ word, status }) => [word, status]),
  )

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

    /** Also restarts a running review with the words that are unknown now. */
    startMissedReview: create.preparedReducer(
      withUpdatedAtOnly,
      (state, action: TimestampedAction) => {
        const missed = collectMissedCards(
          liveValues(state.modules),
          toStatusByWord(state.progress),
        )
        state.missedReview = {
          words: missed.map(card => card.en),
          sessionProgress: {},
        }
        setValueIfChanged(state.cardIndex, 0, action.meta.updatedAt)
      },
    ),

    endMissedReview: create.preparedReducer(
      withUpdatedAtOnly,
      (state, action: TimestampedAction) => {
        state.missedReview = null
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
        const status = isKnown ? CardStatus.Known : CardStatus.Unknown
        setModuleProgressStatus(
          state.progress,
          word,
          status,
          action.meta.updatedAt,
        )
        if (state.missedReview?.words.includes(word)) {
          state.missedReview.sessionProgress[word] = status
        }
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
    // Keeps a running review alive through a Drive pull.
    builder.addCase(reloadFromStorage, state => ({
      ...loadFromStorage(),
      missedReview: state.missedReview,
    }))
  },
  selectors: {
    selectModuleEntries: state => state.modules,
    selectCurrentModuleId: state => state.currentModuleId.value,
    selectModuleCardIndex: state => state.cardIndex.value,
    selectFilterMissed: state => state.filterMissed,
    selectMissedReview: state => state.missedReview,
    selectModuleProgressEntries: state => state.progress,
  },
})

export const {
  selectModule,
  setCardIndex,
  nextCard,
  prevCard,
  toggleFilterMissed,
  startMissedReview,
  endMissedReview,
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
  selectMissedReview,
  selectModuleProgressEntries,
} = modulesSlice.selectors

/* ---------------------------------------------------------------- *
 * Derived state. These were mutable globals in the original app
 * (`currentDataset`, `activeCardsList`) kept in sync by hand.
 * ---------------------------------------------------------------- */

export const selectModules = createSelector([selectModuleEntries], liveValues)

export const selectModulesProgress = createSelector(
  [selectModuleProgressEntries],
  toStatusByWord,
)

export const selectReviewingMissed = createSelector(
  [selectMissedReview],
  review => review !== null,
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

/** Live count behind the "practice missed words" button, unlike the review's fixed list. */
export const selectMissedWordsAcrossModules = createSelector(
  [selectModules, selectModulesProgress],
  collectMissedCards,
)

/** The review's word list resolved to cards; empty outside a review. */
export const selectMissedReviewCards = createSelector(
  [selectModules, selectMissedReview],
  (modules, review): ModuleCard[] => {
    if (!review) {
      return []
    }
    const cardsByWord = new Map<string, ModuleCard>()
    for (const card of modules.flatMap(module => module.cards)) {
      if (!cardsByWord.has(card.en)) {
        cardsByWord.set(card.en, card)
      }
    }
    return review.words.flatMap(word => cardsByWord.get(word) ?? [])
  },
)

/** The card statuses to show: this session's marks during a review, saved progress otherwise. */
export const selectDisplayedProgress = createSelector(
  [selectMissedReview, selectModulesProgress],
  (review, progress): Record<string, CardStatus> =>
    review ? review.sessionProgress : progress,
)

/** The whole deck being practised, before the "needs practice" filter. */
const selectDeckCards = createSelector(
  [selectMissedReview, selectMissedReviewCards, selectCurrentModule],
  (review, reviewCards, module): ModuleCard[] =>
    review ? reviewCards : (module?.cards ?? []),
)

export const selectActiveCards = createSelector(
  [
    selectDeckCards,
    selectReviewingMissed,
    selectFilterMissed,
    selectModulesProgress,
  ],
  (deck, reviewingMissed, filterMissed, progress): ModuleCard[] => {
    if (reviewingMissed || !filterMissed) {
      return deck
    }
    return deck.filter(card => progress[card.en] !== CardStatus.Known)
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
  [selectDeckCards, selectDisplayedProgress],
  (cards, progress) => {
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
