# Component testing plan

## Why

Verifying UI behavior has so far meant manually driving a browser (chrome-devtools
navigation, clicking through flip cards, checking snapshots) after almost every
change in this project. That works, but it doesn't survive as a regression net —
nothing catches it if a later change breaks "flip a card" or "mark a word known"
except doing the same manual pass again. The goal here is to turn the small set of
workflows that get manually re-checked most often into automated component tests,
not to chase full coverage.

**Scope boundary:** this plan covers interactive component/workflow tests (render a
component, click things, assert on the result) — not visual regression, not real
audio output from `speechSynthesis`, not end-to-end browser automation. Redux
slice/selector logic is already well covered by the existing `*.test.ts` files
(79 tests) and stays out of scope here; this plan is specifically about the layer
those tests don't reach: components wiring hooks, dispatch, and rendered output
together.

## What already exists

- `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`,
  `@testing-library/dom` are already installed (added with the original template,
  never actually used for a component test yet).
- `test/render.tsx`'s `renderWithProviders` mirrors `src/main.tsx`'s provider stack
  (`Provider` → `DirectionProvider` → `MantineProvider` → `ModalsProvider` →
  `MemoryRouter`) and returns `{ store, user, ...renderResult }`. Currently has
  **zero usages** anywhere in the codebase.
- `test/setup.ts` already patches `window.matchMedia` (jsdom doesn't implement it;
  Mantine's colour-scheme hooks need it) and initializes i18n to Hebrew.
- Colocation convention (`X.test.ts` next to `X.ts`) is already established for
  logic tests and should extend to components: `X.test.tsx` next to `X.tsx`.

## Gaps to close before the first component test lands

These are things the *current* test infra doesn't handle yet, discovered by
tracing what each candidate workflow actually touches:

1. **`window.speechSynthesis` isn't mocked.** `utils/speech.ts#isSpeechSupported`
   checks `"speechSynthesis" in window`; jsdom doesn't have it, so every
   `SpeakButton` renders `null` in tests today. Any workflow test that needs a
   speak button visible (most flashcard/reading tests do) needs this stubbed in
   `test/setup.ts` — a minimal fake (`speak`, `cancel`, `getVoices` returning `[]`)
   is enough; we're not testing that real audio plays, just that clicking the
   button dispatches the right actions.
2. **No `<Notifications />` in `renderWithProviders`.** Components that call
   `notifications.show(...)` (e.g. `App.tsx`'s sync-import notice) render into a
   portal that doesn't exist in the test wrapper today. Needs adding to
   `test/render.tsx` for any test that asserts on a toast appearing.
3. **`navigator.clipboard` isn't mocked.** `SyncModal`'s copy-link button goes
   through `@mantine/hooks`' `useClipboard`, which needs `navigator.clipboard` or
   falls back to `document.execCommand('copy')`; neither is reliable in jsdom
   without a mock.
4. **`localStorage` isn't reset between tests.** Slices hydrate from real
   `window.localStorage` via lazy initializers (`readInitialState`). Existing
   logic tests either pass explicit `preloadedState` (bypassing hydration) or
   clear storage in `beforeEach` (`listenerMiddleware.test.ts` already does this).
   Component tests should follow the same `beforeEach(() => localStorage.clear())`
   convention, and prefer passing `preloadedState` to `renderWithProviders` over
   relying on hydration, for determinism.

None of these are difficult; they just haven't been needed until now because
nothing has rendered a component in a test yet.

## Candidate workflows, prioritized

Ordered by how often each has actually needed a manual check this session, and how
much it costs to break silently.

### Phase 1 — flashcards (highest manual-check frequency)

- **`ModuleFlashcard`**: renders front (word), flip reveals back (translation +
  meaning + speak button); clicking "known"/"unknown" calls `onMark`; a new `card`
  prop (remount, since the real usage is keyed by word) starts face-down again.
- **`FlashcardsTab`**: same flip/mark behavor, but exercised through the *real*
  card-switching path (Redux `nextFlashcard`/`prevFlashcard`) rather than a remount
  — this is exactly the component whose reset logic was just reworked (the
  "adjust state during render" pattern) to satisfy `react-hooks/set-state-in-effect`,
  so it's a good first candidate to lock in with a real test rather than only
  manual browser verification.
- **`FlipCard`**: the shared shell — click-to-flip, `Enter`/`Space` keyboard
  activation, `status` prop drives the coloured ring class.

### Phase 2 — assessment & navigation primitives

- **`AssessmentButtons`**: known/unknown click → `onMark` called with the right
  boolean; `variant` reflects current `isKnown`.
- **`CardNavigation`**: prev/next click → callbacks fire; prev disabled at index 0,
  next disabled at the last index.
- **`useFlashcardKeys`** (via a host component, since it's a hook): Space flips,
  arrows navigate, `S` speaks, `1`/`2` mark — and critically, all of that is inert
  while focus is inside a text input/textarea (this is exactly the kind of
  behavior a manual pass is likely to skip re-checking after unrelated changes).

### Phase 3 — page-level flows

- **`ModulesPage`**: switching tabs changes the rendered module/rule box; the
  missed-words review toggle switches the whole page into review mode (tabs/rule
  box/stats hidden, header replaced) and back; the completion banner appears with
  the right variant when `known + unknown === total` for the current module.
- **`QuestionCard`**: selecting an option shows correct/incorrect feedback styling.
  Re-answering is deliberately *not* blocked (`answerQuestion` overwrites the
  previous answer unconditionally, and the option buttons have no `disabled`
  guard) — worth a test precisely because it's the kind of implicit behavior
  someone could "fix" into a regression without realizing it was intentional.
- **`JsonLoader`**: pasting valid JSON calls `onParse` and shows the success
  message; invalid JSON shows the mapped error message without calling `onParse`.

### Phase 4 — cross-cutting

- **`TopBar`**: dyslexia toggle flips `aria-pressed` and dispatches; language
  toggle flips direction/locale; sync and speech-settings buttons open their
  modals.
- **`SyncModal`**: renders the current sync URL in the read-only textbox; copy
  button calls the clipboard mock.
- **RTL/LTR smoke test**: rendering the app shell in each locale and asserting
  `dir` on the relevant root elements — cheap, catches a whole class of "shipped
  with the wrong direction" regressions test.

## What's deliberately not covered

- Real `speechSynthesis` audio output — mocked at the API boundary, not verified
  end-to-end. Actual audio behavior stays a manual/browser concern.
- Pixel-level visual regression (colours, spacing, animation) — CSS Modules
  changes are checked manually in-browser, as they have been throughout this
  project; component tests assert on behavior and DOM structure, not appearance.
- Full end-to-end flows spanning a real browser (sync-link import from a pasted
  URL, GitHub Pages sub-path serving) — those stay manual/`vite preview`-based
  checks, as already established.

## Rollout

1. Close the four infra gaps above in `test/setup.ts` / `test/render.tsx` (small,
   one-time changes — a speechSynthesis stub, a clipboard stub, adding
   `<Notifications />` to the wrapper, documenting the `localStorage.clear()`
   convention for component tests alongside the existing one for logic tests).
2. Phase 1 first, since it's both the highest-value target and the smallest gap
   between "components already exist and are stable" and "test written."
3. Each subsequent phase only once the previous one's tests are green and reviewed
   — same incremental, verify-as-you-go approach used throughout this project,
   rather than writing all of them speculatively up front.
4. Add a `test:component` split or just let `npm run test` pick everything up via
   the existing colocated-`*.test.tsx` convention — no new script needed unless
   the suite grows large enough to want to run logic vs. component tests
   separately in CI.

This is a plan only — no test files or infra changes have been made yet.
