# Convert the 3 static HTML apps into a React + RTK + Mantine + CSS Modules app

> **Repo layout update:** the app described below as living under `my-app/` was
> later moved to the repo root, and the 3 original HTML files moved into `old/`.
> References to `my-app/` throughout this doc describe the structure *at the time
> each step was written* and are left as-is for historical accuracy.

## Context

`chen-study` is currently three standalone, self-contained HTML files (Hebrew RTL English-learning
practice apps for Chen):

| File | Size | What it is |
|---|---|---|
| `index.html` | 169 lines | Hub page: two link cards to the other two apps |
| `Unseen New.html` | 2,124 lines | Reading practice: passage reader (TTS), multiple-choice questions, flashcards, JSON exercise loader |
| `Modules Practice.html` | 1,557 lines | Phonics flashcards by module: tab strip, rule box, known/unknown tracking, JSON module loader |

Every file inlines its own `<style>` and `<script>` with mutable globals and `onclick=` attributes. The
two app pages **already duplicate a lot**: dyslexia-font toggle, the entire sync-URL/modal family, TTS
(`speechSynthesis`) wrappers, localStorage persistence, tabs, modals, status messages, card surfaces,
flashcards with known/unknown tracking, and JSON-import drawers. `index.html` defines a third,
differently-named copy of the same colour tokens.

`my-app/` is an untouched `vite-template-redux` scaffold (React 19, RTK 2.6, react-redux 9, TS strict,
Vitest, CSS Modules). Deps are **not installed yet** — no `node_modules`, no lockfile.

**Goal:** one React app in `my-app/` where duplicated behaviour and styling exists exactly once, the
visual result matches the originals, and existing users' `localStorage` data and already-shared sync
links keep working.

### Decisions confirmed with the user

- **Routing:** add `react-router-dom`, `HashRouter`, routes `/`, `/unseen`, `/modules`.
- **Component library: Mantine.** The user's stated criteria were CSS Modules support and strong RTL
  support (critical) — Mantine is the only one of the candidates that satisfies both, verified against
  the docs: CSS Modules is Mantine's *recommended* styling approach (theme values are exposed as CSS
  variables such as `var(--mantine-color-dark-7)` / `var(--mantine-spacing-md)`), and RTL is
  first-class via `DirectionProvider` + `dir="rtl"` on `<html>`, with a `@mixin rtl` in
  `postcss-preset-mantine` for our own CSS Modules. MUI and Chakra were ruled out because their
  styling model is emotion/recipe-based rather than CSS Modules.
- **Theming:** the Mantine theme is the single source of truth — no hand-rolled `tokens.css`, and
  light/dark uses Mantine's built-in colour-scheme manager.
- **Folder naming:** `src/pages/` (not `features/`); slices live under `src/store/slices/`.
- **Fidelity:** port faithfully, fix the clear bugs, **and** implement the documented-but-missing
  features (Modules keyboard shortcuts; replace `alert`/`confirm` with in-app dialogs).
- **Layout:** build in `my-app/`; the 3 root HTML files stay untouched as a reference to diff against.
- **Template examples:** all removed (explicit list below).

---

## Target structure

```
my-app/
  postcss.config.cjs          postcss-preset-mantine + postcss-simple-vars  (.cjs because pkg is ESM)
  index.html                  lang="he" dir="rtl", Hebrew title, Lexend fonts, <ColorSchemeScript>
  src/
    main.tsx                  Provider(store) > DirectionProvider > MantineProvider > HashRouter > App
    App.tsx                   AppShell + <Routes>
    theme.ts                  createTheme(...) — the only token definition in the app
    styles/global.css         only what Mantine can't own (see "Global CSS" below)
    store/
      store.ts  hooks.ts  createAppSlice.ts   (moved from src/app/)
      listenerMiddleware.ts   state -> localStorage, same keys as today
      storage.ts              typed safe JSON read/write/remove helpers
      slices/
        settingsSlice.ts  speechSlice.ts  unseenSlice.ts  modulesSlice.ts
        (+ co-located *.test.ts)
    components/               shared composites only — no needless re-wrapping of Mantine
      SpeakButton/  FlipCard/  JsonLoader/  TopBar/  SyncModal/  DeletableTabs/  StatCounts/
    pages/
      hub/      HubPage.tsx + .module.css
      unseen/   UnseenPage.tsx  ReadingTab.tsx  ParagraphReader.tsx  QuestionCard.tsx
                FlashcardsTab.tsx  ExercisePicker.tsx  (+ .module.css each)
      modules/  ModulesPage.tsx  RuleBox.tsx  ModuleFlashcard.tsx  ModuleStats.tsx
    hooks/      useSpeech.ts  useFlashcardKeys.ts
    utils/      speech.ts  syncUrl.ts  test-utils.tsx (kept from template)
    types/      exercise.ts  module.ts
    data/       defaultExercise.ts   defaultModules.ts
```

Conventions kept from the template: co-located `X.tsx` + `X.module.css`, **named exports only**,
arrow-function components, no barrel files. **Updated after the repo root move:** the app switched
from relative imports to `@/*` (→ `src/*`) and `@test/*` (→ `test/*`) aliases, configured in
`tsconfig.app.json`'s `paths` and `vite.config.ts`'s `resolve.alias` — see Step 13. Same-directory
`./` imports are kept relative; only imports that crossed a directory boundary (`../`) were converted.

Lint/format constraints to respect while writing: `type` not `interface`; `import type` on its own
line; **no semicolons**, `arrowParens: "avoid"`; Redux hooks only from `store/hooks.ts`
(`no-restricted-imports` blocks raw `useSelector`/`useDispatch`); `strictTypeChecked` is on, so
`void dispatch(...)` for floating promises.

---

## Step 1 — Strip the template (do this first, in one commit)

Delete:
- `src/features/counter/` (`Counter.tsx`, `Counter.module.css`, `counterSlice.ts`, `counterSlice.test.ts`, `counterAPI.ts`)
- `src/features/quotes/` (`Quotes.tsx`, `Quotes.module.css`, `quotesApiSlice.ts`) — and the whole `src/features/` dir
- `src/logo.svg`, `src/App.css`, `src/App.test.tsx`, `src/index.css`

Rewrite / move:
- `src/app/{store,hooks,createAppSlice}.ts` → `src/store/`; delete `src/app/`
- `store.ts`: drop `counterSlice` + `quotesApiSlice` from `combineSlices`, and drop the RTK Query
  bits (`setupListeners`, `.concat(quotesApiSlice.middleware)`) — this app has no server, all data is
  local. Keep the `makeStore(preloadedState?)` factory and the `RootState`/`AppDispatch`/`AppThunk`
  exports; add `listenerMiddleware.middleware` instead.
- `src/App.tsx` → the real app shell. `src/utils/test-utils.tsx` → update its store import path.
- Keep unchanged: `src/setupTests.ts`, `src/vite-env.d.ts`, `vite.config.ts`.
- `package.json`: rename `vite-template-redux` → `chen-study` (note `vite.config.ts` derives the
  vitest project name from `packageJson.name`).

Add deps: `@mantine/core`, `@mantine/hooks`, `@mantine/modals`, `react-router-dom`;
dev: `postcss`, `postcss-preset-mantine`, `postcss-simple-vars`. Pin to the latest Mantine major and
confirm its React 19 peer range at install time. Add `postcss.config.cjs` to `tsconfig.node.json`'s
include list (it already has `allowJs`/`checkJs`).

---

## Step 2 — Theme, RTL, and global CSS

`src/theme.ts` — `createTheme({ ... })` is where every colour/radius/font from the three HTML files
lands, exactly once:
- Override the `dark` colour tuple so Mantine's dark surfaces are the originals' values
  (`#0f172a` page bg, `#1e293b` card bg, `#334155` borders) instead of Mantine's defaults.
- `primaryColor`: a custom `brand` 10-shade scale seeded from `#38bdf8` / `#0284c7`; add
  `success`/`danger` scales from `#22c55e` / `#ef4444` (used by known/unknown, correct/incorrect).
- `fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif"`, `defaultRadius: 'md'`, heading sizes, and
  `components: { Button: { defaultProps: { radius: 'xl' } }, ... }` for the pill buttons.
- Light values for the Modules/hub screens (dark-only today) are derived from Unseen's light palette.

`main.tsx` provider order: `Provider store` → `DirectionProvider` → `MantineProvider theme
colorSchemeManager` → `ModalsProvider` → `HashRouter` → `App`. Import `@mantine/core/styles.css`
before `styles/global.css`.

RTL: `<html lang="he" dir="rtl">` in `index.html` (required for `DirectionProvider` to detect
direction on mount) — Mantine components then flip automatically. Our own CSS Modules use logical
properties, falling back to postcss-preset-mantine's `@mixin rtl` where a physical property is
unavoidable.

Dark mode: `useMantineColorScheme()` + a **custom `colorSchemeManager`** that reads/writes the
existing `dark_mode_enabled` `'1'`/`'0'` key (mapping to `'dark'`/`'light'`) instead of Mantine's
default `mantine-color-scheme` key — so returning users keep their preference and old sync payloads
still apply. Add `<ColorSchemeScript defaultColorScheme="dark">` to avoid a flash on load.

`styles/global.css` holds only what the theme cannot:
1. `body.dyslexiaFont { --mantine-font-family: 'Lexend', …; letter-spacing; word-spacing; line-height }`
   — overriding the Mantine font variable in one rule replaces the entire duplicated
   `body.dyslexia-font` cascade in both files (`Unseen New.html:630-652`, `Modules Practice.html:561-577`).
2. `:global` rule-box classes — see gotcha #1 below.

Everything else that was global CSS in the originals (`*`, `body`, `header`, `h1`,
`input[type=range]`, `details summary`, `textarea`, and both `@media (max-width: 640px)` blocks)
becomes Mantine components + responsive props and disappears.

---

## Step 3 — De-duplication map

The user's core requirement. Each row exists **twice today** (once per HTML file) and ends up in
exactly one place.

### From Mantine (deleted, not ported)

| Original CSS/JS | Replaced by |
|---|---|
| `.audio-btn`, `.action-btn`, `.reset-btn`, `.icon-btn`, `.a11y-btn`, `.card-nav-btn`, `.nav-btn`, `.filter-btn`, `.json-action-btn`, `.load-btn`, `.modal-btn`, `.assess-btn` (~12 near-identical button rules across the two files) | `Button` variants + `ActionIcon` |
| The repeated "surface" rule (card bg + 1px border + radius + shadow) — 6× in Unseen, 4× in Modules | `Card` / `Paper` |
| `.container`, `header`, and the `max-width:1100px` block repeated on 6 elements in Modules | `Container` / `Stack` / `Group` |
| `index.html`'s `.grid` (`repeat(auto-fit, minmax(320px,1fr))`) | `SimpleGrid` |
| Unseen `.tab-nav`/`.tab-btn`/`.tab-content` | `Tabs` |
| Both files' byte-for-byte-duplicated `.modal-overlay`/`.modal-card`/`.modal-title`/`.modal-desc`/`.modal-btn-group` | `Modal` |
| The 8 native `confirm()`/`alert()` calls (delete module/exercise, reset stats, sync notice, copy fallback) | `@mantine/modals` `openConfirmModal` / `notifications` |
| `.status-msg`/`.msg-success`/`.msg-error` **and** Unseen's second parallel copy `.feedback`/`.correct`/`.incorrect` | `Alert` |
| `.status-badge`/`.badge-known`/`.badge-unknown` (Unseen) + `.card-status-badge`/`.badge-*` (Modules) | `Badge` |
| `.slider-container`/`.slider-label`/`.speed-value` + `input[type=range]` | `Slider` (label formatter replaces `updateSpeedLabel`) |
| `#exercise-select` + its dark overrides | `Select` |
| `.json-textarea` / `textarea` rules | `Textarea` |
| Modules' `<details>` JSON drawer | `Accordion` (or `Collapse` + `useDisclosure`) |
| `.progress`, `.card-counter` | `Text` / `Progress` |
| `copySyncURL` + `copyJSONInputText` clipboard-with-`execCommand`-fallback (duplicated) | `useClipboard` |
| The advertised-but-never-implemented Space/←/→/S/1/2 shortcuts (`Modules Practice.html:782-784`) | `useHotkeys` |
| `openSyncModal`/`closeSyncModal` open-state juggling, `<details>` state | `useDisclosure` |
| `applyDarkMode`/`toggleDarkMode` + the ~35 `body.dark-mode .x` override rules (`Unseen New.html:747-881`) | `useMantineColorScheme` + theme (see Step 2) |

### Hand-built shared components in `src/components/`

| Component | Replaces | Notes |
|---|---|---|
| `SpeakButton` | the 5 near-identical TTS buttons in Unseen (`.q-speech-btn`, `.option-speech-btn`, `.word-audio-btn`, `.para-play`, `#main-play-btn`) + Modules `.audio-btn` — each reimplements the same play/stop toggle and `.playing` state | thin `ActionIcon` wrapper taking `ownerId` + `text`; all state from `speechSlice`, so the button is dumb |
| `FlipCard` | Modules' real 3D flip (`perspective`/`rotateY`/`backface`) and Unseen's `display`-swap fake flip — unify on the 3D version (Unseen already declares an inert `perspective: 1000px`) | `front`, `back`, `flipped`, `onToggle`; the only genuinely custom CSS Module of the set |
| `JsonLoader` | Unseen's `#tab-json` card and Modules' `<details>` drawer: textarea + status + copy/template/load buttons | props: `onParse(text) => {ok, message}`, `sampleJson`, `instructions` |
| `TopBar` | `.top-bar` + `.a11y-btn` group in both files | dyslexia toggle + colour-scheme toggle + sync button + `children` slot for page-specific controls |
| `SyncModal` | `openSyncModal`/`closeSyncModal`/`copySyncURL` + markup, duplicated verbatim | consumes `utils/syncUrl.ts` |
| `DeletableTabs` | Modules' `.tab-btn` + `.tab-delete-btn` strip built imperatively by `renderTabButtons()` (`:1121-1143`) | `Tabs` + a `CloseButton` in each `Tabs.Tab`; also used for Unseen's static tabs without `onDelete` |
| `StatCounts` | Unseen `.stats-bar` known/unknown + Modules 3-stat bar | `Group` of `Badge`s, counts passed in from selectors |
| `hooks/useSpeech` + `utils/speech.ts` | `stopSpeech`, `speakTextSnippet`, `speakText`, `speakFromParagraph`, `speakQuestionAndOptions`, `playAudio`, `stopCardAudio`, `getSelectedSpeechRate`, Hebrew/English `lang` detection, 🔊/▶ stripping | see Step 5 |
| `utils/syncUrl.ts` | `getSyncPayload`, `generateSyncURL`, `checkURLSync` — duplicated in both files | see Step 6 |
| `store/storage.ts` | `getLibrary`/`saveLibrary`/`saveProgressToStorage`/`saveModulesToStorage` + ~12 ad-hoc try/catch `JSON.parse(localStorage…)` sites | |

---

## Step 4 — Redux (`src/store/`)

`combineSlices` picks slices up by `reducerPath`, so each new slice is just added to the call. Author
them with the template's `createAppSlice` **creators** syntax (`reducers: create => ({ … })`) with
co-located `selectors`, matching the pattern the deleted `counterSlice` demonstrated.

Four slices — one per page plus two cross-cutting ones. Progress lives **inside** the owning page's
slice rather than in its own slice: the two localStorage keys are a persistence detail the listener
middleware handles, not a reason to split state. Nothing outside a page reads that page's progress.

| Slice | State | Persisted key (unchanged from today) |
|---|---|---|
| `settings` | `{ dyslexiaFont: boolean, speechRate: number }` — colour scheme is Mantine's, not here | `dyslexia_font_enabled` + `dyslexia_font_enabled_modules` (write both for back-compat) |
| `speech` | `{ ownerId: string \| null, queueIndex: number }` | not persisted |
| `unseen` | `{ library: Record<exId, Exercise>, currentId: string, cardIndex: number, answers: Record<qId, {selected: number; correct: boolean}>, markedWords: Record<exId, string[]>, progress: Record<exId, Record<word, boolean>> }` | `english_exercise_library`, `english_current_exercise_id`, `current_english_exercise_data`, and `flashcards_status_<exerciseId>` (one key per exercise, as today) |
| `modules` | `{ modules: Module[], currentModuleId: string, cardIndex: number, filterMissed: boolean, progress: Record<word, "known" \| "unknown"> }` | `english_reading_all_modules_v4` + `english_reading_practice_progress_v3` |

`modules.progress` stays **keyed globally by word, not per module** — that's deliberate existing
behaviour: `HAT` appears in `mod1`, `rev1_2` and `rev1_3` and shares one status across all three.
`unseen.progress` is keyed per exercise because that's how `flashcards_status_<exerciseId>` works.

**Derived via selectors, not stored** (these were mutable globals in the HTML): `currentDataset`,
`activeCardsList`, the filtered card list, all stats counts. **Local component state:** `isFlipped`,
textarea contents, accordion/modal open state (`useDisclosure`).

Two index-vs-id bugs fixed while porting: Modules stores `currentModuleIndex` and has to re-derive it
after a delete (`Modules Practice.html:1145-1170`) → use `currentModuleId`; and it hardcodes the
default active module to index `3` → key off an id.

**Persistence** via `createListenerMiddleware` in `store/listenerMiddleware.ts`, writing through
`store/storage.ts`. Because one slice maps to several keys, each listener effect compares
`listenerApi.getOriginalState()` against the new state and writes only the keys whose source field
actually changed — e.g. a `markCard` dispatch rewrites just `flashcards_status_<currentId>`, not the
whole library. Each slice's `initialState` hydrates by reading localStorage on init, so there's no
flash of default content. Keys must not change: the sync feature ships raw localStorage key/value
pairs between devices, and old links must still import cleanly.

---

## Step 5 — Speech (the trickiest conversion)

Today Unseen tracks "who is speaking" by storing a **DOM element** in `currentSpeechBtn`
(`Unseen New.html:1776`), comparing by identity, then restoring button labels by sniffing the
element's id/class in a 5-way branch (`resetSpeechBtnState`, `:1778`).

Replace with a string `ownerId` in `speechSlice` — `"main"`, `"para:3"`, `"word:sofa"`, `"q:q2"`,
`"opt:q2:1"`, `"modcard"`. `SpeakButton` derives its own play/stop state from
`ownerId === speech.ownerId`. `useSpeech()` exposes `speak(text, ownerId, opts)` /
`speakSequence(items, ownerId)` / `stop()`, and cancels on unmount and on route change.

**Why this is a slice and not local state:** `window.speechSynthesis` is a browser singleton — exactly
one utterance plays app-wide — and the components that need to know who's speaking are scattered
across the tree (main play button, per-paragraph buttons, per-word spans, per-question and per-option
buttons, the flashcard button). Stopping on route change is app-level too. The alternative is
prop-drilling an owner down through `ParagraphReader` into every word span, or introducing a second
state mechanism (context + `useSyncExternalStore`) alongside Redux.

**What deliberately stays out of the store:** the `SpeechSynthesisUtterance` and the pending queue
array live in a module-level controller in `utils/speech.ts` — they're non-serializable, and
dispatching per speech event would flood DevTools. Only three things dispatch: start, advance-to-next-
queue-item, and stop. `isSpeaking` is not stored because `ownerId !== null` already means speaking;
`queueIndex` is stored because `ParagraphReader` renders the highlight from it.

Sequential reading (`speakFromParagraph` + its recursive `speakRowAtIndex`, `:1703-1770`, and
`speakQuestionAndOptions`, `:1879`) becomes the `speakSequence` queue, each item carrying its own text
and resolved `lang`, aborting when `ownerId` changes. Paragraph highlight +
`scrollIntoView({block:"center"})` stays in `ParagraphReader`, driven by the current queue index.

The 240 ms single-vs-double-click discriminator on words (`wordClickTimer`, `:1650`) becomes a
`useRef` timer inside `ParagraphReader` — not Redux.

---

## Step 6 — Sync links

`utils/syncUrl.ts` centralises the duplicated implementation. Because we're on `HashRouter`, new links
use `?sync=<base64>` in the query string. To not break already-shared links, `main.tsx` reads
`window.location.href` **before** the router mounts, accepts **both** `?sync=` and the legacy
`#sync=` prefix, applies the payload to `localStorage`, `history.replaceState`s the URL clean, and only
then renders. Report the imported-key count via a Mantine notification instead of `alert()`.

---

## Step 7 — Localization + English support

Added at the user's request, deliberately sequenced **after the UI is complete**: the
pages are built with Hebrew string literals inline, then a single extraction pass moves
them behind a translation lookup. That pass touches every component file, which is the
cost of doing it late rather than up front.

**Scope boundary — chrome only.** The learning *content* is not translatable: module
`rule` HTML, Hebrew nikud transliterations, Hebrew glosses, and the Hebrew question
titles are the material being taught. Localization covers UI chrome only — buttons,
labels, headings, tab names, status and validation messages, dialog copy (~120
strings).

**Consequence for RTL, which needs care:** today `dir="rtl"` is global. With an
English UI the chrome becomes LTR while the content stays Hebrew RTL, so direction
can no longer be a single app-wide value:
- Chrome direction follows the locale — set `<html dir>` and Mantine's
  `DirectionProvider` (`useDirection().setDirection`) from the selected language.
- Hebrew content islands (`RuleBox`, card `he`/`meaning`, question titles) get an
  explicit local `dir="rtl"`, mirroring how the originals already used `dir="ltr"`
  islands for English words (`.word-en`, passage text).

**Approach (confirmed with the user): `react-i18next`.** `src/i18n/{he.ts, en.ts,
index.ts, useLocale.ts}`, with a `CustomTypeOptions` module augmentation in
`i18next.d.ts` so `t("modules.statKnown")` is checked at compile time. `en.ts` is typed
structurally against `he.ts`, so an untranslated key is a type error rather than a
silent fallback. Hebrew is the default locale, matching today's behaviour.

The two JSON importers are refactored to return locale-agnostic **error codes**
(`{ code: "moduleMissingCards", position }`) instead of baked-in Hebrew strings, with
the page mapping them onto `importErrors.*`. Their fallbacks for a missing module title
also stop using a Hebrew default and fall back to the id — a name that gets stored
shouldn't be frozen in whichever language the UI happened to be in.

Also in this step:
- Locale persisted under `english_locale` (the `english_` prefix means it rides along
  with sync links, consistent with the other keys).
- A language toggle in `TopBar`, next to the dyslexia and colour-scheme toggles.
- `lang` on `<html>` updated with the locale, since screen readers and the
  `speechSynthesis` voice selection both key off it. Note the TTS content language
  is separate and already auto-detected per utterance by `detectLang` — that must
  **not** start following the UI locale.

---

## Step 8 — Better text-to-speech (English only)

> **Outcome: 8a delivered and kept. 8b (kokoro-js) rejected after testing** — the
> audio quality was unusable even once the precision bug was fixed and the sub-second
> latency budget was met. Removal plan: `docs/remove-neural-tts.md`. Post-mortem with
> the measurements: `docs/kokoro-tts.md`. The section below is the original design,
> left intact for context.

Added at the user's request. Researched first, and the finding constrains the design:
every good free/offline neural TTS engine is **English-only**.

- **kokoro-js** — Apache-2.0, 82M-param model running 100% locally in-browser via
  Transformers.js. Free for personal use. No Hebrew.
- **Piper** — no Hebrew either (its own issue notes the only open Hebrew model,
  `mms-tts-heb`, is poor quality), and the original repo was archived in Oct 2025.
- **Cloud (Google / Azure / ElevenLabs)** — best quality *and* Hebrew, but an API key
  cannot be safely embedded in a static client-side app, and "free" means a monthly
  quota. Rejected.

The user confirmed English-only is fine and Hebrew TTS is not required, which is what
makes kokoro-js viable. Note the app already forces `en-US` for everything that
matters — the passage, tapped words, and both flashcard decks; Hebrew is only spoken
for question titles.

**8a. Voice selection (do this first — free, no dependency, no download).**
There is a real gap in the current implementation: `useSpeech` sets `utterance.lang`
but never sets `utterance.voice`, so the browser picks its default voice for the
language, which is very often the worst one installed. Add a voice layer:
- Enumerate `speechSynthesis.getVoices()` (async — it populates on the
  `voiceschanged` event, which must be handled or the first call returns `[]`).
  Because that is async, the resolver must also re-read `getVoices()` synchronously at
  utterance time, or an eager click during the first second of a cold page silently
  falls back to the browser default — exactly the failure this feature exists to prevent.
- Rank and pick the best available English voice, preferring known-good families
  (Google, Microsoft Natural, Apple Enhanced/Premium) over the legacy default.
- **Exclude macOS novelty voices** ("Bad News", "Boing", "Bubbles", "Cellos", …).
  `getVoices()` returns them mixed in with no flag to distinguish them, and on a stock
  machine they score identically to real voices — so a naive "best voice" heuristic can
  pick a joke voice to read a lesson aloud. Found by testing on a real machine, where
  **no** Enhanced/Premium/Google/Microsoft voice was installed at all and every English
  voice scored 0–1. Weight `voice.default` well above the no-signal case so the OS
  default wins there, since it is always a real, intelligible voice.
- Set `utterance.lang` from the *resolved voice's* locale, not the detected text locale,
  so choosing a British voice does not leave `lang` claiming `en-US`.
- Honest expectation: on a machine with no enhanced voices installed this step changes
  nothing audible. Its value is (a) not picking a novelty voice, and (b) paying off as
  soon as better voices exist — downloaded on macOS, or shipped by Chrome on
  Windows/Android.
- Expose a voice picker in the top bar, persisted under `english_voice_uri`.
  On macOS this also lets Chen use Apple's Enhanced/Premium voices once she has
  downloaded them in System Settings.

**8b. kokoro-js as an opt-in engine.** Default **off**, lazy-loaded on first use so
the ~90MB model is only fetched if she turns it on. Web Speech stays the fallback, and
Hebrew always routes to Web Speech. This slots in behind the existing `useSpeech`
seam, so no component changes.

**GitHub Pages compatibility is a hard requirement (user-stated), and was verified
before committing to this design:**
- **WebGPU needs a secure context (HTTPS) but *not* cross-origin isolation.** Pages
  serves over HTTPS, so WebGPU is available there — this is the fast path.
- **Multi-threaded WASM silently degrades to single-threaded** without `COOP`/`COEP`,
  which Pages cannot set. It still runs, just slower. So the rule is: *never depend on
  `SharedArrayBuffer` or threading.* Configure `device: "webgpu"` with a single-threaded
  `wasm` fallback.
- There is a known service-worker trick to inject `COOP`/`COEP` on static hosts, but it
  is a workaround we do not need if WebGPU is preferred — not worth the complexity.
- **The model must be fetched from the Hugging Face CDN at runtime, not committed.**
  Pages enforces a 100MB per-file hard limit, and an ~80MB weight file in git is bad
  practice regardless.
- Step 8a needs none of this: `speechSynthesis` is a plain browser API with no headers,
  no download and no network, so it is unconditionally Pages-safe. It is therefore the
  guaranteed baseline, and 8b is a bonus layered on top.
- **Must be verified on the deployed site, not just locally**: `localhost` is treated as
  a secure context regardless of HTTPS, so WebGPU availability there does not prove
  anything about Pages.

**Measured during implementation** (all verified in-browser, not assumed):
- `dtype: "q8"` on **both** device paths. The kokoro-js README suggests pairing WebGPU
  with `fp32`, but that weight file measured **326MB** (`content-length: 325532232`) and
  took 82s — four times what the UI promised the user. `q8` measured **88MB**
  (`content-length: 92361116`) and loaded in 36s, and it **does** work on WebGPU, so the
  README's suggestion is not a requirement. Synthesis verified end-to-end: a 264KB
  `audio/wav` blob came back.
- The HF CDN returns `access-control-allow-origin: *`, so the fetch works from any static
  origin — Pages included.
- **transformers.js loads its ONNX WASM from jsDelivr at runtime**, not from our bundle.
  So the 21MB `ort-wasm-simd-threaded.jsep.wasm` Vite emits into `dist/` is dead weight
  for the deployment, and there is a third-party CDN in the runtime path. Worth revisiting
  in Step 12 — either exclude it from the build or pin `env.wasmPaths` to self-host.

---

## Step 9 — Function-size / single-responsibility refactor

> **Outcome: done, re-surveyed against the table below rather than applied blindly**
> (two candidates had already been resolved by the intervening code-quality pass and
> were skipped; one genuine pre-existing bug was found and deliberately left alone).
> See the per-row notes for what actually happened to each candidate.

Added at the user's request, sequenced after localization and TTS so it sweeps the
final shape of the code once rather than chasing a moving target. Behaviour-preserving
only — the 63 tests plus the manual checklist are the safety net, and no test should
need changing.

Concrete candidates already visible (to be re-surveyed at the time, not taken as a
fixed list):

| Location | Problem | Outcome |
|---|---|---|
| `pages/modules/moduleImport.ts`, `pages/unseen/exerciseImport.ts` | One long function doing parse + shape-check + per-item normalization + id generation, with nested loops and early returns interleaved | **Done.** `normalizeCard`/`resolveModuleId`/`resolveTabName` and `normalizeQuestion`/`normalizeFlashcard`/`resolveExerciseId` extracted symmetrically in both files; each top-level function is now parse → validate → map. All 25 import tests pass unchanged. |
| `pages/modules/ModulesPage.tsx` | Three dialog handlers plus a large JSX tree in one component | **Skipped, on re-survey.** The code-quality pass's `confirmDanger`/`notifyCannotDelete` extraction already fixed the actual pain point — each handler is now 5-15 lines of "build a message, delegate." What remains is a page composing five already-extracted components; splitting further would relocate code without reducing what a reader holds in their head. |
| `pages/unseen/ParagraphReader.tsx` | The token `map` computes ids, cleans words, derives four class flags and wires two handlers inline; `readingIndex` is a non-obvious IIFE | **Done**, with one naming correction: `resolveReadingIndex` is a plain function, not a hook (`useReadingIndex`) — it holds no state, just derives a value from two inputs, so calling it a hook would misdescribe it. `useWordTapHandlers()` (genuinely stateful — owns the click-timer ref) and `PassageWord` were extracted as planned. Verified in-browser: single-click-speaks vs double-click-marks discrimination, and the reading highlight following paragraph-by-paragraph, both confirmed via manual step control. |
| `pages/unseen/FlashcardsTab.tsx` | Stats bar + card + assessment + navigation + hotkeys in one component | **Skipped, on re-survey.** Same reasoning as `ModulesPage.tsx`: `AssessmentButtons` and `CardNavigation` (both already extracted) are composed directly, unwrapped — exactly matching how the sibling `ModuleFlashcard.tsx` composes them. A `FlashcardControls` wrapper now would be a pass-through with no logic of its own. |
| `store/listenerMiddleware.ts` | The `unseen` effect performs four unrelated writes in sequence | **Done** exactly as planned. The `settings` and `modules` effects were left alone — each of their writes is already a single `if` + one `writeX` line, with nothing to extract. All 6 persistence tests (which assert exact keys written) pass unchanged. |
| `App.tsx` | Three `useEffect`s with three unrelated purposes | **Done** exactly as planned. **Incidentally found a genuine pre-existing bug while verifying:** the sync-import notification never actually renders — confirmed the effect fires with the correct `importedKeyCount` and calls `notifications.show()`, but no notification ever appears in the DOM (all 6 `Notifications` position containers stay empty). Verified this is **not** something the refactor introduced: reverted to the exact pre-refactor code side-by-side and reproduced the identical failure. Left alone, deliberately, since Step 9 is behaviour-preserving only — flagged for a separate fix. |
| `store/slices/*` `readInitialState` | Hydration mixes reading, merging and defaulting | **Done for `unseenSlice.ts` only.** `resolveCurrentExerciseId` (matching the `resolveModuleId`/`resolveTabName`/`resolveCurrentId` naming already used elsewhere) and `readAllFlashcardProgress` extracted; the id-resolution's two-stage fallback (optimistic legacy-id use, then a final re-validation against the library) preserved exactly and re-verified with a targeted edge case (a legacy mirror pointing at an id no longer in the library correctly falls through to the built-in default). `settingsSlice.ts` and `modulesSlice.ts` were left untouched — the former is already a flat sequence with no merging to extract, the latter already fully delegates to `mergeModules`/`resolveCurrentId`, which is the state this row was asking the others to reach. |

Guard against over-correction: a long function that is a flat, readable sequence of
steps (`theme.ts`'s colour tuples, the translation catalogues) is **not** a target.
The test is whether a reader has to hold several unrelated concerns in their head at
once, not the line count.

---

## Step 10 — CSS Modules: SCSS extension, or typed codegen to drop `cx`

> **Outcome: decided — do neither.** The user chose to keep `cx` as-is: it's 8
> lines, already exercised indirectly by every component that uses it, and
> costs nothing to keep. No `.module.scss` migration, no typed-codegen plugin.
> The investigation below stays as the record of why, in case the question
> comes up again after more CSS Modules are added.

Added at the user's request, sequenced after the refactor pass (so it sees the
final component shape) and before deploy (so Pages gets the final CSS pipeline,
not an interim one).

**Investigated first, because the premise needs a correction: switching to
`.module.scss` does not let us remove `utils/cx.ts`.** Verified directly against
Vite's own ambient types (`node_modules/vite/client.d.ts`):

```ts
type CSSModuleClasses = { readonly [key: string]: string }
declare module '*.module.css'  { const classes: CSSModuleClasses }
declare module '*.module.scss' { const classes: CSSModuleClasses }
```

Both extensions resolve to the same index-signature type. `noUncheckedIndexedAccess`
(deliberately enabled in `tsconfig.app.json`) makes *any* index-signature access
`string | undefined`, regardless of file extension — that is what `cx` exists to
absorb (see its doc comment in `utils/cx.ts`). Changing `.css` to `.scss` changes
nothing here.

**SCSS's usual selling points are also already active.** `postcss-preset-mantine`
(already a dependency) bundles `postcss-nested` and `postcss-mixins`, so `&:hover`
nesting and `@mixin` already work in plain `.module.css` today — confirmed via
`node_modules/postcss-preset-mantine/package.json`. The three existing CSS Module
files (`HubPage`, `FlipCard`, `ParagraphReader` — 39/66/68 lines) use neither
nesting nor mixins currently, and have no repeated raw values to dedupe: Mantine's
`var(--mantine-*)` custom properties already serve as the shared token layer SCSS
variables would provide. So an extension-only migration would not unlock anything
new in this codebase specifically.

**What would actually remove `cx`:** a typed-CSS-Modules codegen — e.g.
`typescript-plugin-css-modules` or a Vite plugin that emits a literal-keyed `.d.ts`
per module (`{ paraRow: string; paraReading: string; ... }`) instead of an index
signature. `classes.paraRow` then resolves to a real, always-defined property, and
`cx`'s only remaining job (joining several classes with a truthy filter) could
still be worth keeping — that part has nothing to do with `undefined`.

**Decision (confirmed with the user):** do neither. Three independent options
were on the table — (1) adopt `.module.scss` for its own sake, cosmetic only
here; (2) add a typed-CSS-Modules codegen, which is what would actually remove
the `string | undefined` problem `cx` exists for; (3) do neither. The user
picked (3); `cx` stays untouched.

---

## Step 11 — Move test infrastructure out of `src/`

> **Outcome: done, exactly as designed below.** `setupTests.ts` → `test/setup.ts`,
> `utils/test-utils.tsx` → `test/render.tsx`, `utils/test-helpers.ts` →
> `test/helpers.ts`. The two moved files' own relative imports (`../store/store`,
> `../theme`, `./i18n`) needed an extra `../src/` hop since `test/` is now a
> sibling of `src/` rather than nested inside it — not called out below since
> the plan predates the later root-level restructuring (see the note at the top
> of this doc). The 4 `test-helpers` importers and `vite.config.ts`/
> `tsconfig.app.json` were updated as planned. Full gate re-run clean: 75/75
> tests (discovered from the new `setupFiles` location), lint, type-check,
> 0 `dupes` clones, build.

Added at the user's request, sequenced after the CSS decision and before deploy so
the final `src/` tree — the thing actually worth calling "the app" — is settled
before shipping it.

**The problem:** `src/setupTests.ts`, `src/utils/test-utils.tsx` and
`src/utils/test-helpers.ts` are test-only infrastructure sitting inside `src/`,
indistinguishable at a glance from the production utilities beside them --
`test-utils.tsx` and `test-helpers.ts` live in the exact same folder as
`cx.ts` / `speech.ts` / `voices.ts`. Checked before proposing this: `test-utils.tsx`
(`renderWithProviders`) currently has **zero usages** anywhere (no component test
exists yet); `test-helpers.ts` is imported by 4 colocated test files
(`voices.test.ts`, `exerciseImport.test.ts`, `moduleImport.test.ts`,
`modulesSlice.test.ts`).

**The move**, renaming to drop the now-redundant `test-` prefix once the directory
itself says it:

```
my-app/
  src/            -- only things that could ship in the production bundle
  test/           -- test-only infrastructure, never bundled
    setup.ts        (was src/setupTests.ts)
    render.tsx      (was src/utils/test-utils.tsx -- renderWithProviders)
    helpers.ts      (was src/utils/test-helpers.ts)
```

Colocated `*.test.ts` files stay exactly where they are, next to the code they
test -- that is a different, deliberate convention (organised by subject, not by
"testness") and is not in scope here.

**Mechanical follow-through:**
- `vite.config.ts`: `test.setupFiles` path updates to `"./test/setup.ts"`.
- `tsconfig.app.json`: `include: ["src"]` becomes `["src", "test"]` -- it is the
  config with JSX + DOM libs, which `test/render.tsx` needs; `tsconfig.node.json`
  is for tooling configs (`vite.config.ts`, `eslint.config.js`), not this.
- The 4 files importing `test-helpers` get updated relative import paths.
- No ESLint config change expected: `eslint .` already covers the whole project
  with no `ignores` excluding a sibling directory, and typescript-eslint's
  `projectService` picks up new files once `tsconfig.app.json`'s `include` covers
  them.

**Deliberately no effect on runtime or bundle size.** Vite only bundles what
`main.tsx`'s reachable import graph touches, so this code was never shipped either
way -- the whole benefit is that the boundary becomes visible in the file tree
instead of only inferable by opening files.

Verification: same gate as any refactor step (`type-check`, `lint`, `dupes`,
`test`, `build`), plus confirming `vitest` still discovers and runs every test
file from its new `setupFiles` location.

---

## Step 12 — Deploy to GitHub Pages (final step)

Target repo: `idan2468/chen-study`, so the site lands at
`https://idan2468.github.io/chen-study/`.

- **`base: "/chen-study/"`** in `vite.config.ts` — without it every asset 404s, since
  Pages serves from a sub-path.
- **`HashRouter` already pays off here**: deep links like `#/modules` work on Pages
  with no rewrite rules, which a `BrowserRouter` would have required and Pages cannot
  provide.
- **Deploy via GitHub Actions**, not a `gh-pages` branch: `actions/configure-pages`,
  build, `actions/upload-pages-artifact` on `dist`, then
  `actions/deploy-pages`. Enable Pages with "GitHub Actions" as the source.
- **Verify `buildSyncUrl` under a sub-path.** It uses `origin + pathname`, so a
  generated link becomes `…/chen-study/?sync=…`. Worth an explicit check, since this
  is the one feature whose correctness depends on the deployed path.
- **The 3 legacy HTML files will not be served.** Only `dist` is published, so
  `Unseen New.html` etc. become unreachable once Pages goes live. That is the intended
  end state, but it means the side-by-side comparison has to happen locally, before
  deploying.
- ~~Interaction with Step 8b~~ — moot. Step 8b (kokoro-js) was removed after
  real-world testing rejected its audio quality; see `docs/remove-neural-tts.md`.
  No WASM/WebGPU/COOP/COEP consideration applies to speech anymore -- the app
  speaks through `window.speechSynthesis` only, which has no such constraints.

---

## Step 13 — Path aliases instead of relative imports

> **Outcome: done.** Reverses the Step 1-era convention that explicitly ruled
> out a `@/*` alias, at the user's later request.

Added two aliases: `@/*` → `src/*` and `@test/*` → `test/*`, configured in both
places that need to agree on them independently — `tsconfig.app.json`'s
`compilerOptions.paths` (for the type checker and editor IntelliSense) and
`vite.config.ts`'s `resolve.alias` (for the actual bundler/dev-server/vitest
resolution, which does not read `tsconfig.json` on its own). No third config
needed: there is no `eslint-plugin-import` resolver in `eslint.config.js`,
so lint has nothing to update.

**Scope rule:** every import that crossed a directory boundary (started with
`../`) was rewritten to the alias form; imports within the same directory
(`./sibling`) were left alone. Same-directory imports are already short and
don't churn on file moves the way multi-level `../../../` chains do, so
converting them would add noise without fixing anything.

Applied mechanically across the whole tree — 116 import specifiers rewritten
across 35 files (both `src/` and `test/`, including the two files moved in
Step 11 whose own relative imports had grown a `../src/` hop:
`test/render.tsx`, `test/setup.ts`). Verified with the same gate as every prior
step: `type-check`, `lint`, `dupes` (0 clones), all 75 tests (setup and helper
files resolve correctly via `@test/*` too), and `build` — which produced
byte-identical output hashes to the pre-refactor build, confirming this was a
pure import-path change with no behavioural difference.

---

## CSS Modules gotchas found in the originals

1. **`rule` HTML strings inject class names.** Module `rule` fields (`Modules Practice.html:820-827`
   etc.) are raw HTML containing `.rule-section` / `.rule-examples` / `<b>`. Hashed CSS-Module class
   names won't match, so those selectors must be declared with `:global(...)` (in `styles/global.css`
   or `RuleBox.module.css`) and the content rendered via `dangerouslySetInnerHTML`. Data is
   author-supplied through the JSON loader — same trust model as today.
2. **Inline-style state mutation.** JS pokes `style.backgroundColor`/`innerHTML` on the filter button,
   audio button and answer options (`Modules:1287-1294,1325-1326,1350-1351`; `Unseen:1549-1568`).
   These become Mantine `variant`/`color` props or CSS-Module `active`/`playing`/`correct` classes
   driven by state.
3. **Reference `var(--mantine-*)` in every CSS Module** — never a raw hex — so light/dark works
   without duplicate override rules. Unseen has **no** custom properties at all today (every colour is
   a hardcoded hex), and Modules hardcodes hexes even where it defined a variable; both get normalised
   onto the theme.
4. `index.html` needs the Lexend Google-Fonts `preconnect` + stylesheet links (only used by dyslexia
   mode) plus the Hebrew `<title>`.

---

## Bugs / missing features to address (per the user's choice)

- **Duplicate `speakWord`** (`Unseen New.html:1809` and `:2053`) — the later no-arg version wins, so
  the flashcard audio button silently ignores its argument and can never show or stop the playing
  state. Resolved for free by `SpeakButton` + `speechSlice`.
- **Marked (highlighter) words are never persisted** — lost on every re-render. Now
  `unseen.markedWords`, persisted.
- **Triplicated JSON parsing** — `loadJSON`/`loadSingleModule`/`loadMultipleModules`
  (`Modules Practice.html:1454-1537`) each re-read and re-`JSON.parse` the same textarea. Collapse into
  one thunk behind `JsonLoader`.
- **Keyboard shortcuts** — implement via `useHotkeys` in `useFlashcardKeys`, reused by both flashcard
  UIs. Must be inert while focus is in a textarea/input.
- **Modules' `#module-desc` is static** and never updated by JS even though the title is data-driven —
  wire it to the active module.
- **`english_reading_all_modules_v4`, once written, replaces the built-in modules entirely**
  (`Modules Practice.html:1091-1097`), so returning users never see newly added built-ins. Merge
  built-ins by `id` on hydrate while honouring user deletions (track deleted built-in ids).

---

## Build order

1. Strip the template + install deps (Step 1).
2. Theme, providers, RTL, `global.css` (Step 2); `store/` skeleton with `storage.ts` +
   `listenerMiddleware.ts` + `settingsSlice`.
3. `hooks/useSpeech` + `utils/speech.ts` + `speechSlice`, then `SpeakButton` (Step 5).
4. `utils/syncUrl.ts` + `SyncModal` + the `main.tsx` bootstrap import (Step 6); `TopBar`.
5. Remaining shared components: `FlipCard`, `JsonLoader`, `DeletableTabs`, `StatCounts`.
6. Router shell + `HubPage` — smallest page, validates theme + RTL + Mantine end-to-end.
7. **Modules page**: `data/defaultModules.ts`, `modulesSlice`, then
   `ModulesPage`, `RuleBox`, `ModuleFlashcard`, `ModuleStats`, hotkeys, `JsonLoader` wiring.
8. **Unseen page**: `data/defaultExercise.ts`, `unseenSlice`, then `UnseenPage`
   (tabs), `ReadingTab` + `ParagraphReader` (word spans, vocab/marked chips, per-paragraph play),
   `QuestionCard`, `FlashcardsTab`, `ExercisePicker`, `JsonLoader` wiring.
9. Tests + `lint`/`format`/`type-check` cleanup.
10. **Localization + English support** (Step 7) — the string-extraction pass, the
    locale-driven direction switch, and the language toggle. After the UI is finished,
    so it sweeps every component exactly once.
11. **Better text-to-speech** (Step 8) — voice selection first, then kokoro-js as an
    opt-in English engine.
12. **Function-size / single-responsibility refactor** (Step 9) — behaviour-preserving,
    over the final shape of the code.
13. **CSS Modules: SCSS or typed codegen** (Step 10) — decide and apply after the
    refactor settles the component shape, before the CSS pipeline is locked in for
    deploy.
14. **Move test infrastructure out of `src/`** (Step 11) — `setup.ts`/`render.tsx`/
    `helpers.ts` into a sibling `test/` directory, once the tree they are moving out
    of has stopped changing shape.
15. **Deploy to GitHub Pages** (Step 12) — last, once everything above is verified
    locally.

Build steps 7 and 8 (the two pages) are independent once 1–6 exist.

---

## Verification

Automated (from the repo root):
- `npm run type-check` — TS strict + `noUnusedLocals`/`noUnusedParameters` clean.
- `npm run lint` — the flat config is `strictTypeChecked` + `stylisticTypeChecked`; expect it to be picky.
- `npm run format:check` — Prettier is `{ semi: false, arrowParens: "avoid" }`.
- **`npm run dupes` — no duplicated code.** `jscpd` over `src`, configured in `.jscpd.json`
  with `threshold: 1` so any clone above 8 lines / 60 tokens fails the run. This is the
  automated backstop for the "export shared components, no duplication" requirement, and
  it earns its place: on first run it caught the prev/counter/next block duplicated
  between `ModuleFlashcard` and `FlashcardsTab`, which became the shared
  `CardNavigation` component.
  Two exclusions, both deliberate — flagging either would be a false positive:
  - `src/data/**` — generated seed data, legitimately repetitive by nature.
  - `src/i18n/{he,en}.ts` — the catalogues are structurally parallel *by design*; that
    parallelism is what makes a missing translation a type error.
- `npm run test` — vitest, `typecheck.enabled: true`. New tests follow the deleted `counterSlice.test.ts`
  pattern (dispatch against `makeStore({ … })`) and `utils/test-utils.tsx`'s `renderWithProviders`
  (which must be extended to also wrap in `MantineProvider` + `DirectionProvider`):
  - `settingsSlice`: dyslexia + speech-rate.
  - `modulesSlice`: `markCardStatus` toggle semantics; shared-word progress keying across modules;
    built-in merge-on-hydrate honouring deletions; delete-last-module guard.
  - `unseenSlice`: JSON import validation (requires `paragraphs` + `questions` + `flashcards`),
    auto-generated `exerciseId`, delete-last-exercise guard, per-exercise progress isolation.
  - `listenerMiddleware`: a `markCard` dispatch writes only the one `flashcards_status_*` key.
  - `syncUrl`: `encode → decode` round-trip, plus a legacy `#sync=` URL.
  - `JsonLoader`, `DeletableTabs`, `FlipCard` component tests via accessible queries.

Manual, side-by-side against the originals (`open "Unseen New.html"` next to `npm run dev`):
- Hub: both cards navigate; hover states match.
- Unseen: all 3 tabs; play whole passage (paragraph highlight + auto-scroll + stop); per-paragraph
  play; single-click a word to hear it vs double-click to highlight; vocab chips highlighted; answer a
  question (green/red + feedback); flashcards flip / known-unknown toggle / prev-next / stats / reset;
  paste JSON to add an exercise; switch and delete exercises.
- Modules: tab strip renders the 5 built-ins; switching updates title + description + rule box + cards;
  known/unknown with the 250 ms auto-advance; "only missed" filter; reset module; hotkeys
  (Space/←/→/S/1/2, and confirm they're inert while typing in the textarea); load a single module and an
  array of modules; delete a tab (and the last-tab guard).
- Cross-cutting: **RTL** — verify Mantine components (Select chevrons, Modal close button, Tabs order,
  Slider direction) flip correctly and no text is left LTR except the deliberate English islands
  (`.word-en`, passage text). Dyslexia toggle changes the font everywhere. Light/dark toggle persists
  across reload and applies to all three pages. Responsive at ≤640px.
- **Localization:** switch to English and confirm the chrome flips to LTR (Mantine
  components mirror, tab order, Modal close button) while Hebrew content islands stay
  RTL and legible; switch back and confirm nothing is stranded. Verify the locale
  survives a reload, and that TTS still picks `he-IL` vs `en-US` per utterance rather
  than following the UI language.
- **Data compatibility:** before starting, open each original HTML file once so real keys exist in
  localStorage; then confirm the React app hydrates that same data (progress, custom modules, custom
  exercises) without a reset. Generate a sync URL in the original HTML and confirm the React app
  imports it.
