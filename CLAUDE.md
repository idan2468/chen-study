# Comment style rules

Apply these rules whenever adding, editing, or reviewing comments in this repo:

1. If a comment exists to explain something that could instead be made self-explanatory through refactoring (renaming a variable/function, extracting a well-named helper), do the refactor and remove the comment rather than keeping both.
2. If a comment explains a crucial, non-obvious edge case (a real bug fix, a platform quirk, a business rule that isn't visible in the code), keep it — but keep it concise, not verbose. One or two sentences, not a paragraph.
3. Config files are lower priority for comment cleanup than business logic files. Don't spend effort stripping comments from config; focus on `src/` application code.
4. Doc comments on functions are worth keeping only if they add real clarity beyond the function signature. Prefer a clearer name or a small refactor over adding/keeping a comment when either would make the comment unnecessary.

Target audience for comments: a mid-level full-stack developer (~4 years experience) working in this repo. Don't over-explain basics; only keep what a competent dev would actually need to safely change the code.

# Component reuse rule

Apply this before creating any new component, icon, or piece of UI markup in this repo:

1. Search `src/components/` first for an existing component that already covers this responsibility (by name and by purpose) — reuse or extend it instead of adding a near-duplicate.
2. Check Mantine (`@mantine/core`, `@mantine/hooks`, `@mantine/notifications`, `@mantine/modals` — our UI library) for a built-in component or prop that already covers it (e.g. `Button`'s `leftSection` instead of hand-wrapping an icon layout) before writing custom markup.
3. For things Mantine doesn't ship as a component (e.g. brand icons/logos), check Mantine's own published recipes at [ui.mantine.dev](https://ui.mantine.dev) before reaching for a separate npm package or hand-rolling one from scratch.
4. Only add a new dependency or write something fully from scratch once 1–3 are confirmed to not cover it, and the need is generic enough to justify it.

# File tree organization rule

Apply this whenever adding a new file to a shared directory (e.g. `src/utils/`, `src/components/`, `src/hooks/`):

1. Before adding the file, look at what already sits in that directory. If the new file plus 2+ existing ones share a clear domain (e.g. all speech-related, all sync-related) that isn't yet reflected in the folder structure, propose grouping them into a subfolder instead of leaving everything flat.
2. Group by domain/responsibility, not by file type — prefer `speech/`, `sync/` over `types/`, `helpers/`, `constants/`, so a feature's files sit together.
3. Only propose a reorg when a real pattern with multiple files emerges. Don't create a subfolder speculatively for one file, "in case" related files show up later.
4. This is a suggestion only. Describe the proposed tree and stop — do not run any move, rename, or import update until the user explicitly approves it in that same turn. Adding the file you were already asked to add is not itself approval to also reorganize.
5. Once approved, use `git mv` to preserve history and update every import path across the codebase in the same change.

# Check library testing docs first

When a test fails, hangs, or times out because of how a third-party library (Mantine, Floating UI, etc.) behaves in jsdom — not because of a bug in our own code — look for that library's own testing guidance before reverse-engineering a fix:

1. Check the library's official docs/changelog for a "Testing" section, a documented test-environment flag or prop, or a recommended jsdom setup (e.g. Mantine's `MantineProvider` has an `env="test"` prop, documented as disabling transitions and portals for exactly this kind of jsdom flakiness).
2. Search the library's own repo/issues for the specific error or symptom before assuming it needs a manual polyfill or workaround.
3. Only fall back to a manual polyfill (e.g. stubbing `ResizeObserver`) once a real browser API is confirmed missing in jsdom and the library has no built-in test-mode support for it.
4. Prefer the documented mechanism over ad-hoc timeouts, retries, or extra `waitFor` calls, even if the ad-hoc fix happens to work — the documented path holds up better across library versions and other tests using the same component.

# Push feature branches to their own remote branch

Pushing to `main` deploys straight to GitHub Pages (`.github/workflows/deploy.yml` runs on every push to `main`), so feature work never goes there directly:

1. Create a feature branch without tracking its base: `git switch -c <feature-branch> --no-track origin/main`. Starting from `origin/main` otherwise makes the branch track `main`, so a plain push (or an IDE push) targets `main`.
2. Push it to its own branch on origin: `git push -u origin <feature-branch>`.
3. Before any push, check the upstream is the branch's own: `git rev-parse --abbrev-ref @{upstream}` must print `origin/<feature-branch>`, never `origin/main`. If it is wrong, fix it first: `git branch --unset-upstream`, then step 2.
4. Never push a feature branch's commits to `main`, and never fast-forward `main` to a feature branch, unless the user explicitly asks for it in that same turn.
5. Getting feature work into `main` is its own explicit step, done only when the user asks for it.

# Manual web testing with the fake Drive

When testing Google sync in a browser (e.g. through the Chrome DevTools MCP), never sign in to or touch a real Google account. Fake Google with `test/fakeDrive.ts`, the same fake the Drive integration test uses:

1. Start the dev server (`npm run dev`) and the fake Drive (`npm run fake-drive`, on `http://localhost:5299`). The fake Drive keeps its files in memory, so they reset when it stops.
2. Open each device in its own isolated browser context (DevTools MCP: `new_page` with a distinct `isolatedContext`), so each has its own localStorage while all of them share one Drive.
3. Load the app with this init script (DevTools MCP: `navigate_page` with `initScript`). It stores the fake token as a saved sign-in and sends every `googleapis.com` request to the fake Drive:

   ```js
   localStorage.setItem("google_access_token", "fake-token")
   const realFetch = window.fetch.bind(window)
   window.fetch = (input, init) => {
     const url =
       typeof input === "string"
         ? input
         : input instanceof URL
           ? input.href
           : input.url
     return url.startsWith("https://www.googleapis.com")
       ? realFetch(
           url.replace("https://www.googleapis.com", "http://localhost:5299"),
           init,
         )
       : realFetch(input, init)
   }
   ```

   Init scripts only run on a new document, so give each device its own query string (e.g. `?device=laptop#/modules`): a hash-only change keeps the current document. Leave out the token line to test a device that never connected.

4. Check what reached Drive at `http://localhost:5299/__drive` (files and the request log) and `http://localhost:5299/__drive/v2` (the parsed `progress-v2.json`).
5. Stop the dev server and the fake Drive when done.
