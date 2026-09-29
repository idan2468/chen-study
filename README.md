# chen-study

Interactive English practice apps for Chen: a hub page linking to two Hebrew
RTL/English learning tools —

- **Unseen (reading practice)** — reading passages with text-to-speech, tappable
  vocabulary, multiple-choice comprehension questions, and vocabulary flashcards.
- **Modules (phonics flashcards)** — tabbed practice sets by phonics module, with
  known/unknown progress tracking and keyboard shortcuts.

Both pages support optional Google Drive sync for automatic cross-device
backup, a dyslexia-friendly font toggle, light/dark
mode, and an English/Hebrew UI language toggle (the learning content itself
stays Hebrew — only the chrome translates).

This app started as three standalone static HTML files (still kept in `old/` for
reference) and was converted to React + Redux Toolkit + Mantine + CSS Modules. See
`docs/completed/migration/react-conversion-plan.md` for the full conversion history and design
decisions.

## Stack

- [Vite](https://vitejs.dev/) + [React](https://react.dev/) + TypeScript (strict)
- [Redux Toolkit](https://redux-toolkit.js.org/) for state, persisted to
  `localStorage` via a listener middleware
- [Mantine](https://mantine.dev/) for components/theming, chosen for its CSS
  Modules support and first-class RTL handling
- [react-i18next](https://react.i18next.com/) for UI chrome localization
  (Hebrew/English)
- [react-router-dom](https://reactrouter.com/) (`HashRouter`, for GitHub Pages
  compatibility)
- [Vitest](https://vitest.dev/) + [React Testing Library](https://testing-library.com/)
  for tests

## Getting started

Requires the Node version in `.nvmrc` (24).

```sh
npm install
npm run dev
```

## Scripts

- `dev` / `start` — start the dev server and open the browser
- `build` — type-check and build for production
- `preview` — locally preview the production build
- `test` — run the test suite once (Vitest)
- `type-check` — TypeScript in `--noEmit` mode
- `lint` / `lint:fix` — ESLint
- `format` / `format:check` — Prettier
- `dupes` — [jscpd](https://github.com/kucherenko/jscpd) duplicate-code check over
  `src/` (see `.jscpd.json`)
- `knip` — [knip](https://knip.dev) check for unused files, exports, and
  dependencies, in default and production mode (see `knip.json`)
- `fake-drive` — serve the test fake of Google Drive on port 5299 for manual
  browser testing of sync (see "Manual web testing with the fake Drive" in
  `CLAUDE.md`)

## Testing

Tests are colocated with the code they test (`X.test.ts`/`X.test.tsx` next to
`X.ts`/`X.tsx`), split into two layers:

- **Logic tests** (`*.test.ts`) — Redux slices, selectors, and pure utilities.
  Dispatch actions against `makeStore({ ... })` and assert on the resulting state
  or persisted `localStorage` keys.
- **Component tests** (`*.test.tsx`) — render with `test/render.tsx`'s
  `renderWithProviders` (mirrors the real provider stack: Redux `Provider` →
  `DirectionProvider` → `MantineProvider` → `ModalsProvider` → `Notifications` →
  router) and drive interaction through `@testing-library/user-event`. These
  assert on rendered output, dispatched state changes, and callback calls — not
  implementation details like internal state or CSS class names. See
  `docs/testing/component-testing-plan.md` for the full rationale and rollout plan.

`test/setup.ts` stubs the browser APIs jsdom doesn't implement
(`window.matchMedia`, `window.speechSynthesis`, `navigator.clipboard`) and
initializes i18n. `test/helpers.ts` has small shared assertion helpers.

Run the suite:

```sh
npm run test
```

## Google Drive sync

An optional, opt-in cross-device backup. Connecting a Google account keeps
the app's progress in a single `progress-v2.json` file in the app's hidden
Drive `appDataFolder` — never a user-visible file, and no backend or database
of our own. Each sync reads that file, merges it with the device's progress
(the most recent change to each answer, mark, or setting wins), and uploads
the result only when something changed. It runs on connect and boot, every 30
seconds while the tab is visible, on returning to the tab, and on "Sync now".
See `docs/sync/google-account-sync.md` for the full design and Google Cloud
setup.

## Deployment

Deployed to GitHub Pages via `.github/workflows/deploy.yml` on every push to
`main` (or manually via `workflow_dispatch`). Because Pages serves from a
sub-path, `vite.config.ts` sets `base: "/chen-study/"`, and the app uses
`HashRouter` so deep links work without server-side rewrite rules.

## Docs

See [`docs/README.md`](docs/README.md) for every design doc and plan, grouped by status (reference, active, proposed, completed).
