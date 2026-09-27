import {
  builtInModuleIds,
  defaultModuleExercises,
} from "@/data/defaultModuleExercises"
import { at } from "@test/helpers"
import { CardStatus } from "@/types/moduleExercise"
import type {
  ModuleExercise,
  ModuleProgressRecord,
} from "@/types/moduleExercise"
import { StorageKeys } from "@/utils/sync/legacy/legacyStorage"
import {
  reloadFromStorage,
  selectPersistedState,
  writeLocalPersistedState,
} from "@/store/persistedState"
import { makeStore } from "@/store/store"
import type { PersistedState } from "@/types/schemas/persistedState"
import {
  INITIAL_UPDATED_AT,
  liveValues,
  markDeleted,
  toVersionedValue,
} from "@/utils/sync/versionedValue"
import type { ModulesState } from "./modulesSlice"
import {
  addModules,
  deleteModule,
  markCard,
  mergeModules,
  resetCurrentModuleProgress,
  selectActiveCards,
  selectCurrentModuleId,
  selectModuleCardIndex,
  selectModuleOptions,
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

type TestStateOverrides = Partial<
  Pick<ModulesState, "filterMissed" | "reviewingMissed">
> & {
  modules?: ModuleExercise[]
  progress?: ModuleProgressRecord[]
  currentModuleId?: string
  cardIndex?: number
}

const baseState = ({
  modules = defaultModuleExercises,
  progress = [],
  currentModuleId = firstBuiltInId,
  cardIndex = 0,
  ...overrides
}: TestStateOverrides = {}): ModulesState => ({
  modules: modules.map(module => toVersionedValue(module)),
  currentModuleId: toVersionedValue(currentModuleId),
  cardIndex: toVersionedValue(cardIndex),
  filterMissed: false,
  reviewingMissed: false,
  progress: progress.map(record => toVersionedValue(record)),
  ...overrides,
})

const moduleEntry = (store: ReturnType<typeof makeStore>, id: string) =>
  store.getState().modules.modules.find(entry => entry.value.id === id)

const mergedIds = (stored: ModuleExercise[]) =>
  mergeModules(stored.map(module => toVersionedValue(module))).map(
    entry => entry.value.id,
  )

describe("mergeModules", () => {
  test("seeds all built-ins on a first run", () => {
    expect(mergedIds([])).toStrictEqual(builtInModuleIds)
  })

  test("re-seeds built-ins missing from stored data, fixing the original's bug", () => {
    // The original replaced the built-in list wholesale with whatever was
    // stored, so a user who had only the first built-in never saw the rest
    // again.
    const stored = [at(defaultModuleExercises, 0), customModule]

    expect(mergedIds(stored)).toStrictEqual([...builtInModuleIds, "custom_1"])
  })

  test("a stored copy of a built-in wins, so user edits survive", () => {
    const edited = { ...at(defaultModuleExercises, 0), tabName: "Edited" }
    const merged = mergeModules([toVersionedValue(edited)])

    expect(at(merged, 0).value.tabName).toBe("Edited")
  })

  test("keeps a deleted built-in's tombstone instead of re-seeding it", () => {
    const tombstone = markDeleted(
      toVersionedValue(at(defaultModuleExercises, 1)),
      INITIAL_UPDATED_AT,
    )
    const merged = mergeModules([tombstone])

    expect(liveValues(merged).map(m => m.id)).not.toContain(secondBuiltInId)
    expect(at(merged, 1)).toStrictEqual(tombstone)
  })
})

describe("version metadata", () => {
  const NOW = "2026-09-26T11:00:00.000+03:00"

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date(NOW) })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test("stamps a marked card with the time it was marked", () => {
    const store = makeStore({ modules: baseState() })

    store.dispatch(markCard({ word: firstCard.en, isKnown: false }))

    expect(store.getState().modules.progress).toStrictEqual([
      toVersionedValue({ word: firstCard.en, status: CardStatus.Unknown }, NOW),
    ])
  })
})

describe("progress", () => {
  test("marks a card, keyed globally by word", () => {
    const store = makeStore({ modules: baseState() })
    store.dispatch(markCard({ word: firstCard.en, isKnown: true }))

    expect(selectModulesProgress(store.getState())).toStrictEqual({
      [firstCard.en]: CardStatus.Known,
    })
  })

  test("re-marking overwrites rather than toggling off", () => {
    // Deliberately unlike the Unseen flashcards, which do toggle.
    const store = makeStore({ modules: baseState() })
    store.dispatch(markCard({ word: firstCard.en, isKnown: true }))
    store.dispatch(markCard({ word: firstCard.en, isKnown: true }))

    expect(selectModulesProgress(store.getState())[firstCard.en]).toBe(
      CardStatus.Known,
    )
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
    expect(selectModulesProgress(state).QUIZ).toBe(CardStatus.Known)
  })

  test("resetting clears only the current module's words", () => {
    const secondCard = at(at(defaultModuleExercises, 1).cards, 0)
    const store = makeStore({
      modules: baseState({
        currentModuleId: "custom_1",
        modules: [...defaultModuleExercises, customModule],
        progress: [
          { word: "ZAP", status: CardStatus.Known },
          { word: secondCard.en, status: CardStatus.Unknown },
        ],
      }),
    })
    store.dispatch(resetCurrentModuleProgress())

    // ZAP is in custom_1; the second built-in's word must survive.
    expect(selectModulesProgress(store.getState())).toStrictEqual({
      ZAP: CardStatus.None,
      QUIZ: CardStatus.None,
      [secondCard.en]: CardStatus.Unknown,
    })
  })

  test("counts known, unknown and pending for the current module", () => {
    const store = makeStore({
      modules: baseState({
        currentModuleId: "custom_1",
        modules: [customModule],
        progress: [{ word: "ZAP", status: CardStatus.Known }],
      }),
    })

    expect(selectModuleStats(store.getState())).toStrictEqual({
      known: 1,
      unknown: 0,
      pending: 1,
    })
  })

  test("marks a module option complete after every card was assessed", () => {
    const store = makeStore({
      modules: baseState({
        modules: [customModule],
        currentModuleId: "custom_1",
      }),
    })

    store.dispatch(markCard({ word: "ZAP", isKnown: true }))
    expect(selectModuleOptions(store.getState())[0]?.completed).toBe(false)

    store.dispatch(markCard({ word: "QUIZ", isKnown: false }))
    expect(selectModuleOptions(store.getState())).toStrictEqual([
      { value: "custom_1", label: "Mine", completed: true },
    ])
  })
})

describe("filterMissed", () => {
  test("hides known cards and resets the index", () => {
    const store = makeStore({
      modules: baseState({
        currentModuleId: "custom_1",
        modules: [customModule],
        progress: [{ word: "ZAP", status: CardStatus.Known }],
        cardIndex: 1,
      }),
    })
    store.dispatch(toggleFilterMissed())

    const state = store.getState()
    expect(selectActiveCards(state).map(card => card.en)).toStrictEqual([
      "QUIZ",
    ])
    expect(selectModuleCardIndex(state)).toBe(0)
  })
})

describe("selectMissedWordsAcrossModules", () => {
  test("pools unknown words from every module, deduplicated by word", () => {
    const store = makeStore({
      modules: baseState({
        modules: [customModule, otherCustomModule],
        progress: [
          { word: "QUIZ", status: CardStatus.Unknown },
          { word: "ZAP", status: CardStatus.Known },
        ],
      }),
    })

    // QUIZ appears in both custom modules -- must be pooled once, not twice.
    const missed = selectMissedWordsAcrossModules(store.getState())
    expect(missed.filter(card => card.en === "QUIZ")).toHaveLength(1)
    expect(missed.map(card => card.en)).not.toContain("ZAP")
  })

  test("excludes pending (never marked) words, not just known ones", () => {
    const store = makeStore({
      modules: baseState({ modules: [customModule], progress: [] }),
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
        progress: [{ word: "ZAP", status: CardStatus.Unknown }],
        cardIndex: 1,
      }),
    })
    store.dispatch(toggleMissedReview())

    const state = store.getState()
    expect(selectActiveCards(state).map(card => card.en)).toStrictEqual(["ZAP"])
    expect(selectModuleCardIndex(state)).toBe(0)
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
      module => module.id === selectCurrentModuleId(state),
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

  test("marks a module complete from existing stored progress", () => {
    const firstModule = at(defaultModuleExercises, 0)
    const progress = Object.fromEntries(
      firstModule.cards.map((card, index) => [
        card.en,
        index % 2 === 0 ? CardStatus.Known : CardStatus.Unknown,
      ]),
    )
    localStorage.setItem(StorageKeys.modulesProgress, JSON.stringify(progress))

    const store = makeStore()

    expect(
      selectModuleOptions(store.getState()).find(
        option => option.value === firstModule.id,
      )?.completed,
    ).toBe(true)
  })

  test("reopens without a deleted built-in, and does not re-seed it", () => {
    localStorage.setItem(
      StorageKeys.deletedBuiltInModules,
      JSON.stringify([secondBuiltInId]),
    )

    const store = makeStore()
    const state = store.getState()

    expect(selectModules(state).map(m => m.id)).not.toContain(secondBuiltInId)
    expect(moduleEntry(store, secondBuiltInId)?.deleted).toBe(true)
  })
})

describe("reloadFromStorage", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  test("discards in-memory changes and re-reads local v2, e.g. after a Drive merge", () => {
    const store = makeStore({ modules: baseState() })
    store.dispatch(markCard({ word: firstCard.en, isKnown: true }))

    const persisted = selectPersistedState(store.getState())
    writeLocalPersistedState({
      ...persisted,
      modules: {
        ...persisted.modules,
        progress: [
          toVersionedValue({ word: firstCard.en, status: CardStatus.Unknown }),
        ],
      },
    })
    store.dispatch(reloadFromStorage())

    expect(selectModulesProgress(store.getState())).toStrictEqual({
      [firstCard.en]: "unknown",
    })
  })
})

describe("hydration from local v2", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  const writeModules = (modules: Partial<PersistedState["modules"]>) => {
    const persisted = selectPersistedState(makeStore().getState())
    writeLocalPersistedState({
      ...persisted,
      modules: { ...persisted.modules, ...modules },
    })
  }

  test("prefers local v2 over legacy keys", () => {
    localStorage.setItem(
      StorageKeys.modulesProgress,
      JSON.stringify({ HAT: CardStatus.Known }),
    )
    writeModules({
      progress: [toVersionedValue({ word: "FOX", status: CardStatus.Unknown })],
    })

    expect(selectModulesProgress(makeStore().getState())).toStrictEqual({
      FOX: CardStatus.Unknown,
    })
  })

  test("seeds built-ins missing from v2 but keeps their tombstones", () => {
    const first = at(defaultModuleExercises, 0)
    const second = at(defaultModuleExercises, 1)
    writeModules({
      modules: [markDeleted(toVersionedValue(first), INITIAL_UPDATED_AT)],
    })

    const ids = selectModules(makeStore().getState()).map(module => module.id)

    expect(ids).not.toContain(first.id)
    expect(ids).toContain(second.id)
  })

  test("repairs a current module that the merge left deleted, keeping its timestamp", () => {
    const NOW = "2026-09-27T10:00:00.000+03:00"
    const deleted = at(defaultModuleExercises, 1)
    writeModules({
      modules: [markDeleted(toVersionedValue(deleted), NOW)],
      currentModuleId: toVersionedValue(deleted.id, NOW),
      cardIndex: toVersionedValue(99, NOW),
    })

    const state = makeStore().getState()

    expect(selectCurrentModuleId(state)).not.toBe(deleted.id)
    expect(state.modules.currentModuleId.updatedAt).toBe(NOW)
    expect(selectModuleCardIndex(state)).toBe(0)
  })
})

describe("addModules", () => {
  test("replaces a live module and clears progress for its old and new words", () => {
    const replacement: ModuleExercise = {
      ...customModule,
      title: "Replacement",
      cards: [
        { en: "QUIZ", he: "quiz", meaning: "test" },
        { en: "NEW", he: "new", meaning: "new" },
      ],
    }
    const store = makeStore({
      modules: baseState({
        modules: [customModule, otherCustomModule],
        currentModuleId: customModule.id,
        progress: [
          { word: "ZAP", status: CardStatus.Known },
          { word: "QUIZ", status: CardStatus.Unknown },
          { word: "NEW", status: CardStatus.Known },
          { word: "KEEP", status: CardStatus.Known },
        ],
      }),
    })

    store.dispatch(addModules([replacement]))

    expect(selectModules(store.getState())).toStrictEqual([
      replacement,
      otherCustomModule,
    ])
    expect(selectModulesProgress(store.getState())).toStrictEqual({
      ZAP: CardStatus.None,
      QUIZ: CardStatus.None,
      NEW: CardStatus.None,
      KEEP: CardStatus.Known,
    })
  })

  test("only applies the final occurrence of a repeated id", () => {
    const finalModule = { ...customModule, title: "Final" }
    const store = makeStore({
      modules: baseState({ modules: [otherCustomModule] }),
    })

    store.dispatch(addModules([customModule, finalModule]))

    expect(selectModules(store.getState())).toStrictEqual([
      otherCustomModule,
      finalModule,
    ])
  })
})

describe("deleteModule", () => {
  test("keeps a deleted built-in as a tombstone so it is not re-seeded", () => {
    const store = makeStore({ modules: baseState() })
    store.dispatch(deleteModule(secondBuiltInId))

    expect(selectModules(store.getState()).map(m => m.id)).not.toContain(
      secondBuiltInId,
    )
    expect(moduleEntry(store, secondBuiltInId)?.deleted).toBe(true)
    expect(
      selectModules(makeStore().getState()).map(module => module.id),
    ).not.toContain(secondBuiltInId)
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
    expect(selectCurrentModuleId(store.getState())).toBe(thirdBuiltInId)
  })

  test("re-adding a deleted built-in revives it at the end", () => {
    const store = makeStore({ modules: baseState() })
    store.dispatch(deleteModule(secondBuiltInId))
    store.dispatch(addModules([at(defaultModuleExercises, 1)]))

    expect(moduleEntry(store, secondBuiltInId)?.deleted).toBe(false)
    const liveIds = selectModules(store.getState()).map(m => m.id)
    expect(liveIds[liveIds.length - 1]).toBe(secondBuiltInId)
    expect(
      selectModules(makeStore().getState()).map(module => module.id),
    ).toContain(secondBuiltInId)
  })
})
