import { builtInModuleIds, defaultModules } from "@/data/defaultModules"
import { at } from "@test/helpers"
import type { PracticeModule } from "@/types/module"
import { makeStore } from "@/store/store"
import type { ModulesState } from "./modulesSlice"
import {
  addModules,
  deleteModule,
  markCard,
  mergeModules,
  resetCurrentModuleProgress,
  selectActiveCards,
  selectMissedWordsAcrossModules,
  selectModuleStats,
  selectModules,
  selectModulesProgress,
  toggleFilterMissed,
  toggleMissedReview,
} from "./modulesSlice"

const customModule: PracticeModule = {
  id: "custom_1",
  tabName: "שלי",
  title: "מודול שלי",
  rule: "",
  cards: [
    { en: "ZAP", he: "זַפ", meaning: "זפ" },
    { en: "HAT", he: "הַט", meaning: "כובע" },
  ],
}

const baseState = (overrides: Partial<ModulesState> = {}): ModulesState => ({
  modules: [...defaultModules],
  currentModuleId: "mod1",
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
    // stored, so a user who had only `mod1` never saw the other four again.
    const stored = [at(defaultModules, 0), customModule]
    const merged = mergeModules(stored, [])

    expect(merged.map(m => m.id)).toStrictEqual([
      ...builtInModuleIds,
      "custom_1",
    ])
  })

  test("a stored copy of a built-in wins, so user edits survive", () => {
    const edited = { ...at(defaultModules, 0), tabName: "ערכתי" }
    const merged = mergeModules([edited], [])

    expect(at(merged, 0).tabName).toBe("ערכתי")
  })

  test("honours deleted built-ins instead of re-seeding them", () => {
    const merged = mergeModules([], ["mod2"])

    expect(merged.map(m => m.id)).not.toContain("mod2")
    expect(merged).toHaveLength(builtInModuleIds.length - 1)
  })
})

describe("progress", () => {
  test("marks a card, keyed globally by word", () => {
    const store = makeStore({ modules: baseState() })
    store.dispatch(markCard({ word: "HAT", isKnown: true }))

    expect(selectModulesProgress(store.getState())).toStrictEqual({
      HAT: "known",
    })
  })

  test("re-marking overwrites rather than toggling off", () => {
    // Deliberately unlike the Unseen flashcards, which do toggle.
    const store = makeStore({ modules: baseState() })
    store.dispatch(markCard({ word: "HAT", isKnown: true }))
    store.dispatch(markCard({ word: "HAT", isKnown: true }))

    expect(selectModulesProgress(store.getState()).HAT).toBe("known")
  })

  test("a word shared across modules shares one status", () => {
    // HAT appears in mod1, rev1_2 and rev1_3 -- inherited behaviour.
    const store = makeStore({ modules: baseState({ currentModuleId: "mod1" }) })
    store.dispatch(markCard({ word: "HAT", isKnown: true }))

    const state = store.getState()
    const sharing = selectModules(state).filter(module =>
      module.cards.some(card => card.en === "HAT"),
    )

    expect(sharing.length).toBeGreaterThan(1)
    expect(selectModulesProgress(state).HAT).toBe("known")
  })

  test("resetting clears only the current module's words", () => {
    const store = makeStore({
      modules: baseState({
        currentModuleId: "custom_1",
        modules: [...defaultModules, customModule],
        progress: { ZAP: "known", BIG: "unknown" },
      }),
    })
    store.dispatch(resetCurrentModuleProgress())

    // ZAP and HAT are in custom_1; BIG belongs to mod3 and must survive.
    expect(selectModulesProgress(store.getState())).toStrictEqual({
      BIG: "unknown",
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
    expect(selectActiveCards(state).map(card => card.en)).toStrictEqual(["HAT"])
    expect(state.modules.cardIndex).toBe(0)
  })
})

describe("selectMissedWordsAcrossModules", () => {
  test("pools unknown words from every module, deduplicated by word", () => {
    const store = makeStore({
      modules: baseState({
        modules: [...defaultModules, customModule],
        progress: { HAT: "unknown", ZAP: "known" },
      }),
    })

    // HAT appears in mod1, rev1_2 and rev1_3 -- must be pooled once, not 3x.
    const missed = selectMissedWordsAcrossModules(store.getState())
    expect(missed.filter(card => card.en === "HAT")).toHaveLength(1)
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

describe("deleteModule", () => {
  test("records a deleted built-in so it is not re-seeded", () => {
    const store = makeStore({ modules: baseState() })
    store.dispatch(deleteModule("mod2"))

    const state = store.getState()
    expect(selectModules(state).map(m => m.id)).not.toContain("mod2")
    expect(state.modules.deletedBuiltInIds).toStrictEqual(["mod2"])
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
    const store = makeStore({ modules: baseState({ currentModuleId: "mod2" }) })
    store.dispatch(deleteModule("mod2"))

    // mod2 was at index 1, so the module that shifted into index 1 is selected.
    expect(store.getState().modules.currentModuleId).toBe("rev1_2")
  })

  test("re-adding a deleted built-in clears its deletion record", () => {
    const store = makeStore({ modules: baseState() })
    store.dispatch(deleteModule("mod2"))
    store.dispatch(addModules([at(defaultModules, 1)]))

    expect(store.getState().modules.deletedBuiltInIds).toStrictEqual([])
  })
})
