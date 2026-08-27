import {
  builtInModuleIds,
  defaultModuleExercises,
} from "@/data/defaultModuleExercises"
import { at } from "@test/helpers"
import type { ModuleExercise } from "@/types/module"
import { StorageKeys } from "@/utils/sync/storageKeys"
import { makeStore } from "@/store/store"
import type { ModulesState } from "./modulesSlice"
import {
  addModules,
  deleteModule,
  markCard,
  mergeModules,
  reloadFromStorage,
  resetCurrentModuleProgress,
  selectActiveCards,
  selectCurrentModuleId,
  selectModuleCardIndex,
  selectMissedWordsAcrossModules,
  selectModuleStats,
  selectModules,
  selectModulesProgress,
  toggleFilterMissed,
  toggleMissedReview,
} from "./modulesSlice"

const customModule: ModuleExercise = {
  id: "custom_1",
  tabName: "Mine",
  title: "My module",
  rule: "",
  cards: [
    { en: "ZAP", he: "zap", meaning: "zap" },
    { en: "QUIZ", he: "quiz", meaning: "test" },
  ],
}

/**
 * A second custom module sharing `QUIZ` with `customModule`, standing in for
 * the real content's now-unique words -- `defaultModuleExercises` no longer
 * repeats a word across modules, so cross-module sharing has to be
 * constructed explicitly rather than relied upon from the built-in data.
 */
const otherCustomModule: ModuleExercise = {
  id: "custom_2",
  tabName: "Mine 2",
  title: "My module 2",
  rule: "",
  cards: [{ en: "QUIZ", he: "quiz", meaning: "test" }],
}

const firstBuiltInId = at(builtInModuleIds, 0)
const secondBuiltInId = at(builtInModuleIds, 1)
const thirdBuiltInId = at(builtInModuleIds, 2)
const firstCard = at(at(defaultModuleExercises, 0).cards, 0)

const baseState = (overrides: Partial<ModulesState> = {}): ModulesState => ({
  modules: [...defaultModuleExercises],
  currentModuleId: firstBuiltInId,
  cardIndex: 0,
  filterMissed: false,
  reviewingMissed: false,
  progress: {},
  deletedBuiltInIds: [],
  ...overrides,
})

describe("mergeModules", () => {
  test("seeds all built-ins on a first run", () => {
    expect(mergeModules([], []).map(m => m.id)).toStrictEqual(builtInModuleIds)
  })

  test("re-seeds built-ins missing from stored data, fixing the original's bug", () => {
    // The original replaced the built-in list wholesale with whatever was
    // stored, so a user who had only the first built-in never saw the rest
    // again.
    const stored = [at(defaultModuleExercises, 0), customModule]
    const merged = mergeModules(stored, [])

    expect(merged.map(m => m.id)).toStrictEqual([
      ...builtInModuleIds,
      "custom_1",
    ])
  })

  test("a stored copy of a built-in wins, so user edits survive", () => {
    const edited = { ...at(defaultModuleExercises, 0), tabName: "Edited" }
    const merged = mergeModules([edited], [])

    expect(at(merged, 0).tabName).toBe("Edited")
  })

  test("honours deleted built-ins instead of re-seeding them", () => {
    const merged = mergeModules([], [secondBuiltInId])

    expect(merged.map(m => m.id)).not.toContain(secondBuiltInId)
    expect(merged).toHaveLength(builtInModuleIds.length - 1)
  })
})

describe("progress", () => {
  test("marks a card, keyed globally by word", () => {
    const store = makeStore({ modules: baseState() })
    store.dispatch(markCard({ word: firstCard.en, isKnown: true }))

    expect(selectModulesProgress(store.getState())).toStrictEqual({
      [firstCard.en]: "known",
    })
  })

  test("re-marking overwrites rather than toggling off", () => {
    // Deliberately unlike the Unseen flashcards, which do toggle.
    const store = makeStore({ modules: baseState() })
    store.dispatch(markCard({ word: firstCard.en, isKnown: true }))
    store.dispatch(markCard({ word: firstCard.en, isKnown: true }))

    expect(selectModulesProgress(store.getState())[firstCard.en]).toBe("known")
  })

  test("a word shared across modules shares one status", () => {
    // QUIZ appears in both custom modules here -- inherited behaviour from
    // the original data, where the same word could appear in several
    // modules and shared one status across all of them.
    const store = makeStore({
      modules: baseState({
        currentModuleId: "custom_1",
        modules: [customModule, otherCustomModule],
      }),
    })
    store.dispatch(markCard({ word: "QUIZ", isKnown: true }))

    const state = store.getState()
    const sharing = selectModules(state).filter(module =>
      module.cards.some(card => card.en === "QUIZ"),
    )

    expect(sharing.length).toBeGreaterThan(1)
    expect(selectModulesProgress(state).QUIZ).toBe("known")
  })

  test("resetting clears only the current module's words", () => {
    const secondCard = at(at(defaultModuleExercises, 1).cards, 0)
    const store = makeStore({
      modules: baseState({
        currentModuleId: "custom_1",
        modules: [...defaultModuleExercises, customModule],
        progress: { ZAP: "known", [secondCard.en]: "unknown" },
      }),
    })
    store.dispatch(resetCurrentModuleProgress())

    // ZAP is in custom_1; the second built-in's word must survive.
    expect(selectModulesProgress(store.getState())).toStrictEqual({
      [secondCard.en]: "unknown",
    })
  })

  test("counts known, unknown and pending for the current module", () => {
    const store = makeStore({
      modules: baseState({
        currentModuleId: "custom_1",
        modules: [customModule],
        progress: { ZAP: "known" },
      }),
    })

    expect(selectModuleStats(store.getState())).toStrictEqual({
      known: 1,
      unknown: 0,
      pending: 1,
    })
  })
})

describe("filterMissed", () => {
  test("hides known cards and resets the index", () => {
    const store = makeStore({
      modules: baseState({
        currentModuleId: "custom_1",
        modules: [customModule],
        progress: { ZAP: "known" },
        cardIndex: 1,
      }),
    })
    store.dispatch(toggleFilterMissed())

    const state = store.getState()
    expect(selectActiveCards(state).map(card => card.en)).toStrictEqual([
      "QUIZ",
    ])
    expect(state.modules.cardIndex).toBe(0)
  })
})

describe("selectMissedWordsAcrossModules", () => {
  test("pools unknown words from every module, deduplicated by word", () => {
    const store = makeStore({
      modules: baseState({
        modules: [customModule, otherCustomModule],
        progress: { QUIZ: "unknown", ZAP: "known" },
      }),
    })

    // QUIZ appears in both custom modules -- must be pooled once, not twice.
    const missed = selectMissedWordsAcrossModules(store.getState())
    expect(missed.filter(card => card.en === "QUIZ")).toHaveLength(1)
    expect(missed.map(card => card.en)).not.toContain("ZAP")
  })

  test("excludes pending (never marked) words, not just known ones", () => {
    const store = makeStore({
      modules: baseState({ modules: [customModule], progress: {} }),
    })

    expect(selectMissedWordsAcrossModules(store.getState())).toStrictEqual([])
  })
})

describe("toggleMissedReview", () => {
  test("switches selectActiveCards to the cross-module missed pool and resets the index", () => {
    const store = makeStore({
      modules: baseState({
        currentModuleId: "custom_1",
        modules: [customModule],
        progress: { ZAP: "unknown" },
        cardIndex: 1,
      }),
    })
    store.dispatch(toggleMissedReview())

    const state = store.getState()
    expect(selectActiveCards(state).map(card => card.en)).toStrictEqual(["ZAP"])
    expect(state.modules.cardIndex).toBe(0)
    expect(state.modules.reviewingMissed).toBe(true)
  })

  test("toggles back off", () => {
    const store = makeStore({ modules: baseState({ reviewingMissed: true }) })
    store.dispatch(toggleMissedReview())

    expect(store.getState().modules.reviewingMissed).toBe(false)
  })
})

describe("hydration", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  test("reopens on the stored module id rather than the hardcoded default", () => {
    localStorage.setItem(StorageKeys.currentModuleId, thirdBuiltInId)

    const store = makeStore()

    expect(selectCurrentModuleId(store.getState())).toBe(thirdBuiltInId)
  })

  test("falls back to the preferred default when the stored id no longer exists", () => {
    localStorage.setItem(StorageKeys.currentModuleId, "no-such-module")

    const store = makeStore()

    // Third built-in (mod3_short_i) is the hardcoded preferred default.
    expect(selectCurrentModuleId(store.getState())).toBe(thirdBuiltInId)
  })

  test("reopens on the stored card index for the current module", () => {
    localStorage.setItem(StorageKeys.moduleCardIndex, "3")

    const store = makeStore()

    expect(selectModuleCardIndex(store.getState())).toBe(3)
  })

  test("clamps a stored index that no longer fits the module's deck", () => {
    localStorage.setItem(StorageKeys.moduleCardIndex, "9999")

    const store = makeStore()
    const state = store.getState()
    const current = selectModules(state).find(
      module => module.id === state.modules.currentModuleId,
    )

    expect(current).toBeDefined()
    expect(selectModuleCardIndex(state)).toBe((current?.cards.length ?? 1) - 1)
  })

  test("reopens with stored modules merged in alongside the built-ins", () => {
    localStorage.setItem(StorageKeys.allModules, JSON.stringify([customModule]))

    const store = makeStore()

    expect(selectModules(store.getState()).map(m => m.id)).toStrictEqual([
      ...builtInModuleIds,
      "custom_1",
    ])
  })

  test("reopens with the stored progress", () => {
    localStorage.setItem(
      StorageKeys.modulesProgress,
      JSON.stringify({ [firstCard.en]: "known" }),
    )

    const store = makeStore()

    expect(selectModulesProgress(store.getState())).toStrictEqual({
      [firstCard.en]: "known",
    })
  })

  test("reopens without a deleted built-in, and does not re-seed it", () => {
    localStorage.setItem(
      StorageKeys.deletedBuiltInModules,
      JSON.stringify([secondBuiltInId]),
    )

    const store = makeStore()
    const state = store.getState()

    expect(selectModules(state).map(m => m.id)).not.toContain(secondBuiltInId)
    expect(state.modules.deletedBuiltInIds).toStrictEqual([secondBuiltInId])
  })
})

describe("reloadFromStorage", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  test("discards in-memory changes and re-reads whatever is in storage now, e.g. after a Drive pull", () => {
    const store = makeStore({ modules: baseState() })
    store.dispatch(markCard({ word: firstCard.en, isKnown: true }))

    localStorage.setItem(
      StorageKeys.modulesProgress,
      JSON.stringify({ [firstCard.en]: "unknown" }),
    )
    store.dispatch(reloadFromStorage())

    expect(selectModulesProgress(store.getState())).toStrictEqual({
      [firstCard.en]: "unknown",
    })
  })
})

describe("deleteModule", () => {
  test("records a deleted built-in so it is not re-seeded", () => {
    const store = makeStore({ modules: baseState() })
    store.dispatch(deleteModule(secondBuiltInId))

    const state = store.getState()
    expect(selectModules(state).map(m => m.id)).not.toContain(secondBuiltInId)
    expect(state.modules.deletedBuiltInIds).toStrictEqual([secondBuiltInId])
  })

  test("refuses to delete the last remaining module", () => {
    const store = makeStore({
      modules: baseState({
        modules: [customModule],
        currentModuleId: "custom_1",
      }),
    })
    store.dispatch(deleteModule("custom_1"))

    expect(selectModules(store.getState())).toHaveLength(1)
  })

  test("selects a neighbour when the active module is deleted", () => {
    const store = makeStore({
      modules: baseState({ currentModuleId: secondBuiltInId }),
    })
    store.dispatch(deleteModule(secondBuiltInId))

    // The second built-in was at index 1, so the module that shifted into
    // index 1 (the third built-in) is selected.
    expect(store.getState().modules.currentModuleId).toBe(thirdBuiltInId)
  })

  test("re-adding a deleted built-in clears its deletion record", () => {
    const store = makeStore({ modules: baseState() })
    store.dispatch(deleteModule(secondBuiltInId))
    store.dispatch(addModules([at(defaultModuleExercises, 1)]))

    expect(store.getState().modules.deletedBuiltInIds).toStrictEqual([])
  })
})
