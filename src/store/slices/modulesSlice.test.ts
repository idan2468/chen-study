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
import {
  reloadFromStorage,
  selectPersistedState,
  writeLocalPersistedState,
} from "@/store/persistedState"
import { makeStore } from "@/store/store"
import type { PersistedState } from "@/types/schemas/persistedState"
import { toVersionedValue } from "@/utils/sync/versionedValue"
import type { ModulesState } from "@/store/slices/modulesSlice"
import {
  addModules,
  deleteModule,
  endMissedReview,
  markCard,
  nextCard,
  prevCard,
  resetCurrentModuleProgress,
  selectActiveCards,
  selectCurrentModuleId,
  selectDisplayedProgress,
  selectModuleCardIndex,
  selectModuleCardPosition,
  selectModuleOptions,
  selectMissedWordsAcrossModules,
  selectModule,
  selectModuleStats,
  selectModules,
  selectModulesProgress,
  selectReviewingMissed,
  startMissedReview,
  toggleFilterMissed,
} from "@/store/slices/modulesSlice"

const customModule: ModuleExercise = {
  id: "custom_1",
  tabName: "Mine",
  title: "My module",
  rule: "A rule",
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
  rule: "A rule",
  cards: [{ en: "QUIZ", he: "quiz", meaning: "test" }],
}

const firstBuiltInId = at(builtInModuleIds, 0)
const secondBuiltInId = at(builtInModuleIds, 1)
const thirdBuiltInId = at(builtInModuleIds, 2)
const firstCard = at(at(defaultModuleExercises, 0).cards, 0)

type TestStateOverrides = Partial<
  Pick<ModulesState, "filterMissed" | "missedReview">
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
  missedReview: null,
  progress: progress.map(record => toVersionedValue(record)),
  ...overrides,
})

const moduleEntry = (store: ReturnType<typeof makeStore>, id: string) =>
  store.getState().modules.modules.find(entry => entry.value.id === id)

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

describe("missed review", () => {
  const reviewStore = () =>
    makeStore({
      modules: baseState({
        currentModuleId: "custom_1",
        modules: [customModule, otherCustomModule],
        progress: [
          { word: "ZAP", status: CardStatus.Unknown },
          { word: "QUIZ", status: CardStatus.Unknown },
        ],
        cardIndex: 1,
      }),
    })

  test("starts on the cross-module missed words and resets the index", () => {
    const store = reviewStore()
    store.dispatch(startMissedReview())

    const state = store.getState()
    expect(selectReviewingMissed(state)).toBe(true)
    expect(selectActiveCards(state).map(card => card.en)).toStrictEqual([
      "ZAP",
      "QUIZ",
    ])
    expect(selectModuleCardIndex(state)).toBe(0)
  })

  test("shows every word untouched, whatever its saved status", () => {
    const store = reviewStore()
    store.dispatch(startMissedReview())

    const state = store.getState()
    expect(selectDisplayedProgress(state)).toStrictEqual({})
    expect(selectModuleStats(state)).toStrictEqual({
      known: 0,
      unknown: 0,
      pending: 2,
    })
  })

  test("keeps a word marked known in the list instead of filtering it out", () => {
    const store = reviewStore()
    store.dispatch(startMissedReview())
    store.dispatch(markCard({ word: "ZAP", isKnown: true }))

    const state = store.getState()
    expect(selectActiveCards(state).map(card => card.en)).toStrictEqual([
      "ZAP",
      "QUIZ",
    ])
    expect(selectDisplayedProgress(state)).toStrictEqual({
      ZAP: CardStatus.Known,
    })
    expect(selectModuleStats(state)).toStrictEqual({
      known: 1,
      unknown: 0,
      pending: 1,
    })
  })

  test("saves only the words marked in the session", () => {
    const store = reviewStore()
    store.dispatch(startMissedReview())
    store.dispatch(markCard({ word: "ZAP", isKnown: true }))
    store.dispatch(endMissedReview())

    const state = store.getState()
    expect(selectReviewingMissed(state)).toBe(false)
    expect(selectModulesProgress(state)).toStrictEqual({
      ZAP: CardStatus.Known,
      QUIZ: CardStatus.Unknown,
    })
    expect(selectMissedWordsAcrossModules(state).map(card => card.en)).toEqual([
      "QUIZ",
    ])
  })

  test("starting again takes a fresh list of the words unknown now", () => {
    const store = reviewStore()
    store.dispatch(startMissedReview())
    store.dispatch(markCard({ word: "ZAP", isKnown: true }))
    store.dispatch(markCard({ word: "QUIZ", isKnown: false }))
    store.dispatch(startMissedReview())

    const state = store.getState()
    expect(selectActiveCards(state).map(card => card.en)).toStrictEqual([
      "QUIZ",
    ])
    expect(selectDisplayedProgress(state)).toStrictEqual({})
  })

  test("survives a reload from storage", () => {
    const store = reviewStore()
    store.dispatch(startMissedReview())
    store.dispatch(markCard({ word: "ZAP", isKnown: true }))
    store.dispatch(reloadFromStorage())

    expect(store.getState().modules.missedReview).toStrictEqual({
      words: ["ZAP", "QUIZ"],
      sessionProgress: { ZAP: CardStatus.Known },
    })
  })
})

describe("hydration", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  /** Saves a store's state with some module fields replaced, for states actions can't reach. */
  const writeModules = (modules: Partial<PersistedState["modules"]>) => {
    const persisted = selectPersistedState(makeStore().getState())
    writeLocalPersistedState({
      ...persisted,
      modules: { ...persisted.modules, ...modules },
    })
  }

  test("starts a new user on every built-in, with the first module open at card 0", () => {
    const state = makeStore().getState()

    expect(selectModules(state).map(m => m.id)).toStrictEqual([
      ...builtInModuleIds,
    ])
    expect(selectCurrentModuleId(state)).toBe(firstBuiltInId)
    expect(selectModuleCardPosition(state)).toBe(0)
  })

  test("reopens on the module that was open", () => {
    makeStore().dispatch(selectModule(thirdBuiltInId))

    expect(selectCurrentModuleId(makeStore().getState())).toBe(thirdBuiltInId)
  })

  test("reopens on the card that was open", () => {
    const previous = makeStore()
    const deckLength = at(defaultModuleExercises, 0).cards.length
    for (let step = 0; step < 3; step += 1) {
      previous.dispatch(nextCard(deckLength))
    }

    expect(selectModuleCardPosition(makeStore().getState())).toBe(3)
  })

  test("keeps a stored index past the deck, which the position selector clamps", () => {
    writeModules({ cardIndex: toVersionedValue(9999) })

    const state = makeStore().getState()
    const current = selectModules(state).find(
      module => module.id === selectCurrentModuleId(state),
    )

    expect(state.modules.cardIndex.value).toBe(9999)
    expect(selectModuleCardPosition(state)).toBe(
      (current?.cards.length ?? 1) - 1,
    )
  })

  test("reopens with added modules after the built-ins", () => {
    makeStore().dispatch(addModules([customModule]))

    expect(selectModules(makeStore().getState()).map(m => m.id)).toStrictEqual([
      ...builtInModuleIds,
      "custom_1",
    ])
  })

  test("reopens with the saved progress", () => {
    makeStore().dispatch(markCard({ word: firstCard.en, isKnown: true }))

    expect(selectModulesProgress(makeStore().getState())).toStrictEqual({
      [firstCard.en]: "known",
    })
  })

  test("marks a module complete from saved progress", () => {
    const firstModule = at(defaultModuleExercises, 0)
    const previous = makeStore()
    firstModule.cards.forEach((card, index) => {
      previous.dispatch(markCard({ word: card.en, isKnown: index % 2 === 0 }))
    })

    expect(
      selectModuleOptions(makeStore().getState()).find(
        option => option.value === firstModule.id,
      )?.completed,
    ).toBe(true)
  })

  test("reopens without a deleted built-in, and does not re-seed it", () => {
    makeStore().dispatch(deleteModule(secondBuiltInId))

    const store = makeStore()

    expect(selectModules(store.getState()).map(m => m.id)).not.toContain(
      secondBuiltInId,
    )
    expect(moduleEntry(store, secondBuiltInId)?.deleted).toBe(true)
  })

  test("uses stored modules as they are, without adding built-ins", () => {
    const first = at(defaultModuleExercises, 0)
    writeModules({
      modules: [toVersionedValue(first)],
      currentModuleId: toVersionedValue(first.id),
    })

    const ids = selectModules(makeStore().getState()).map(module => module.id)

    expect(ids).toStrictEqual([first.id])
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

describe("card navigation from a stale index", () => {
  test("stepping back moves from the last visible card", () => {
    const store = makeStore({
      modules: baseState({ cardIndex: 99 }),
    })
    const length = selectActiveCards(store.getState()).length

    store.dispatch(prevCard(length))

    expect(selectModuleCardIndex(store.getState())).toBe(length - 2)
  })

  test("next and previous on an empty list stay at 0", () => {
    const store = makeStore({ modules: baseState() })

    store.dispatch(nextCard(0))
    store.dispatch(prevCard(0))

    expect(selectModuleCardIndex(store.getState())).toBe(0)
  })
})
