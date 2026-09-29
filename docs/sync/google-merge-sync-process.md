# Implementation process: Google merge sync

**Status: Steps 1–11.6 approved (released through v2.1.0); Step 12 is in progress on `retire-legacy-sync`.**

**This file is the repository source of truth for rollout progress, commit IDs, validation results, review status, and the next step. Keep [google-merge-sync-plan.md](./google-merge-sync-plan.md) static as design documentation.**

## Completed

- [x] Step 1 — remove link sync (`0fb5850`), manually approved.
- [x] Step 2 — import identity/replacement (`9c78308`, `b27d40d`, `d4f7187`), CI/review/manual approved.
- [x] Step 3 — centralize legacy persistence (`74e221b`), 259 tests/full gate/review/manual approved.
- [x] Step 3.5 — visibility-aware interval sync (`cc1eb93`), 259 tests/full gate/review/manual approved.
- [x] Step 4 — plain semantic-ID arrays (`0b52449`, `4d519db`, `11b709f`, `4c5c84e`), 263 tests/full gate/review/manual approved.
- [x] Step 5 — version/timestamp foundations (`a9c8cf3`, `5b65723`, `948b92c`, `413f263`, `01d514b`, `d067b9e`), 268 tests/full gate/review/manual approved; follow-ups `f9ac709`, `36defff`.
- [x] Step 6 — versioned arrays, preferences, and navigation (`e21d999`, `e8f7d27`, `ba149dd`, `bc9c468`, `2aac946`, `3cc30b1`, `eeee890`, `b52b38d`), 291 tests/full gate/review/manual approved.
  - Decisions: legacy-loaded values get the epoch `updatedAt`; deleted entities are tombstones (replacing `deletedBuiltInIds`); versioned preferences are `dyslexiaFont`, `shuffleUnseenAnswers`, and both speech rates; system voice stays device-local; dark mode and locale stay with Mantine/i18n.
- [x] Step 7 — canonical local v2 (`220a8c8`, `53b664f`, `70fa4d9`), 298 tests/full gate/review/manual approved.
  - Decisions: envelope is `{ schemaVersion: 2, unseen: { exercises, currentId, cardIndex }, modules: { modules, progress, currentModuleId, cardIndex }, preferences: { dyslexiaFont, shuffleUnseenAnswers, speechRateByLang } }`; `filterMissed`, `reviewingMissed`, and system voice stay out; app hydration keeps reading legacy keys until Step 11 while `english_progress_v2` is written through on every change (loader tested, not wired into startup); a missing, corrupt, or Zod-invalid v2 document falls back to legacy with a console warning on validation failure; `english_progress_v2` is excluded from the legacy Google payload; `SpeechLang` lives in `src/types/speech.ts` so schemas never import store slices; `src/utils/sync/` stays flat (v2 subfolder proposed, not accepted).
- [x] Step 7.5 — rename the sync document to `PersistedState` (`8f8e626`, `54223ae`, `41ca337`), 298 tests/full gate/manual approved; full `review-code-quality` stopped at the user's request, only F2 applied.
  - Decisions: it's the app's main storage in both localStorage and Drive, not a sync-only format, so `SyncDocumentV2` became `PersistedState` (`persistedStateSchema`, `selectPersistedState`, `readPersistedState`/`writePersistedState`); the V2 suffix is dropped from names while the storage key `english_progress_v2` and `schemaVersion: 2` stay; the selector, key, and read/write helpers live in `src/store/persistedState.ts` and the schema in `src/types/schemas/persistedState.ts`; every object schema there is a named variable, with section schemas named after their envelope keys.
- [x] Step 8 — pure merge engine (`f39f66c`, `811b7d0`, `c1d2bcb`, `32ab173`, `7b80663`, `9a19496`, `20745cf`, `14f4e3b`, `95a8eee`, `47a398d`), 324 tests/full gate/review/manual approved.
  - Decisions: newest `updatedAt` wins, compared as parsed instants, and Drive wins ties; deletion is plain newest-wins with tombstones kept forever, so a later re-import beats an older tombstone; a newer Unseen exercise wins with its whole subtree, while equal live versions keep Drive's exercise fields and merge each child record by newest-wins; Modules, global Module progress words, and each preference merge independently; navigation merges as a pair (differing current IDs → the side that switched more recently wins both ID and card index; same ID → each field newest-wins); merged arrays keep Drive's order, then append local-only IDs in local order; timestamp helpers are generic (`timestamp.ts`, `IsoTimestamp`, `Asia/Jerusalem` as the default zone); a merged current ID can point at an entity the other side deleted — left to Step 11 hydration.
- [x] Step 9 — Drive v2 transport (`7c34326`, `814bc02`, `6a2b27f`, `f93021f`, `b1d6087`), 336 tests/full gate/review/manual approved.
  - Decisions: `progress-v2.json` lives in `appDataFolder`, is validated with `persistedStateSchema`, and duplicates resolve to the newest `modifiedTime`; no `keepalive`; a write reuses the file ID from the preceding read (reviewed concurrent-write limitation stands); an unparsable or Zod-invalid Drive file is never overwritten — it is renamed to `progress-v2.invalid-<IsoTimestamp>.json.bck` and a fresh `progress-v2.json` is created; the write is skipped when the state equals the Drive copy just read (`object-hash`); the localStorage pair is `readLocalPersistedState`/`writeLocalPersistedState` and the Drive pair `readDrivePersistedState`/`writeDrivePersistedState`; shared file operations live in `google/driveFiles.ts`.
- [x] Step 10 — migration/activation coordinator, uninvoked (`453e44f`, `5563643`, `d312bdf`, `9b8d7dc`, `672d84f`, `27fbe40`, `5937935`, `da907db`, `848ee7f`, `6e4e5de`, `cb272f3`), 345 tests/full gate/review/manual approved.
  - Decisions: the coordinator is temporary legacy code in `src/utils/sync/legacy/migrateToV2.ts`, converting via `selectPersistedState(makeStore().getState())` with epoch timestamps; a device-local `sync_v2_activated` marker is set only after every earlier step succeeds, after which only idempotent cleanup reruns; never-connected devices migrate locally with no Drive calls; with valid Drive v2 the legacy pull is skipped and converted local data merges into Drive v2; with missing or invalid Drive v2, `progress.json` is pulled into the legacy keys before converting; local v2 is written before Drive v2 as a checkpoint, and a retry resumes from it (skipping pull and conversion) so pending edits keep real timestamps; cleanup deletes only legacy data keys plus `google_last_synced_hash`, keeping dark mode, locale, system voices, the Google token, and Drive's `progress.json` until Step 12; non-trivial sync functions carry short `@param` docs; utilities renamed `upsertValue`, `tombstoneValue`, `setValueIfChanged`, `downloadFileContent`, `keepLastBy`.
- [x] Step 11 — activate v2 synchronization (`3e6ec42`, `ca13121`, `f7783b6`, `b4a3f0b`, `8495e8e`, `4c9ab34`, `0e15d39`, `fa3f965`, `bbda6d5`), 351 tests/full gate/review/manual approved.
  - Decisions and results:
    - Slices hydrate from local v2 whenever it is valid, otherwise from legacy keys, applying the legacy loader's repairs (seed new built-in modules and the default exercise unless tombstoned, fall back from a current ID that points at a deleted entity, clamp the module card index). A repaired current ID keeps its `updatedAt` and resets its card index to 0, since a position belongs to its own exercise or module (Step 8's navigation pair); an empty stored module ID still reopens on the stored index, as the legacy loader did.
    - Boot without a token runs `migrateToV2(false)` in `main.tsx` before the store is created; boot with a token runs `migrateToV2(true)` inside the existing restore, behind the spinner.
    - Connect, boot, the visible 30-second timer, return-to-visible, and **Sync now** share one entry point: a not-yet-activated device runs `migrateToV2(true)` (resuming from its checkpoint); an activated one reads Drive v2, merges it with the live store's state, applies the result, then writes Drive (skipped when unchanged). Merge and apply run synchronously after the read, so edits made during the upload are kept and pushed next sync.
    - The page-hide `keepalive` push is removed; the existing 401 → one silent re-issue → retry and silent passive failures stay.
    - Legacy write-through is removed: only local v2 (plus device-local system voices) is written.
    - An activated device connecting with only a legacy `progress.json` on Drive ignores it and creates Drive v2 from its own state; the other device's data arrives when it migrates.
    - The unreachable legacy push path (`syncIfDirty`, `recordSynced`, `writeSnapshot`, the sync-hash key usage) is deleted now; `readSnapshot` stays for the migration.
    - Applying merged Drive state reuses the slices' reload reducers and is skipped when the merge changed nothing, so view-only Modules toggles reset only when another device's edits arrive.
    - After Step 11, a full manual test runs in Chrome via MCP (the user can sign in to Google if needed).
    - The slices share one `reloadFromStorage` action (in `store/persistedState.ts`): separate per-slice reloads let the write-through save a half-reloaded state over local v2 between dispatches.
    - Functions added in this step are split into small named helpers (`withDefaultExercise`, `resolveCurrentExerciseId`, `clampCardIndex`, `isRepairedId`, `mergeWithDrive`, `applyLocallyIfChanged`, `syncActivatedDevice`, `syncSilentlyIfVisible`, `migrateTokenlessDevice`); the refactor runs before the review.
    - The sync hooks live in `src/hooks/sync/` (`GoogleConnectContext`, `useDriveSync`, `useGoogleConnect`, `useRehydrateFromStorage`, `useSyncWithDrive`).
    - Validation: 351 tests, type-check (including forced `tsc -b --force`), lint, changed-file format, build, and diff checks pass.
    - Review: F2 (shared `storeTestLocale` test helper) and the `hooks/sync/` grouping accepted and applied; F1 (parse local v2 once per store instead of once per slice) declined.
    - Google sign-in cannot complete in the automated browser, so Google is faked at the `fetch` boundary: `test/fakeDrive.ts` answers the Drive and userinfo calls and logs every request; a stored access token stands in for sign-in. `driveSync.integration.test.ts` (`fa3f965`) runs two devices through it with the real migration, transport, and merge; mutation checks (merge disabled, local always wins) make it fail.
    - Manual Chrome test (dev server, isolated contexts, the fake Drive served locally; the user's real Drive was never touched):
      - Tokenless boot migrates legacy data (epoch timestamps, tombstoned deleted built-in, legacy keys removed, device settings kept) and the UI reflects it; edits write only v2 with real timestamps and survive reload; a current module pointing at a deleted module falls back to the default at card 1.
      - An activated device connecting creates `progress-v2.json` from its own state and ignores `progress.json`; a second legacy device joins via the existing-v2 path (Drive wins the epoch tie, device-only words append, `progress.json` never read).
      - Return-to-visible and the 30-second timer bring the other device's edits into the running UI without reload; **Sync now** shows the success toast and PATCHes the existing file; idle timer syncs are read-only; `progress.json` stays unchanged.
      - Console is clean on fresh loads; the only errors came from a dev-server hot reload during mutation testing.
    - Finding (resolved with a single-flight guard: a `syncWithDrive` call while one is running shares that run; two devices at once stays the reviewed limitation): overlapping syncs in one tab can each find Drive empty and both create `progress-v2.json`. Seen via React StrictMode's doubled boot effect in dev; in production it needs two overlapping syncs before Drive v2 exists. Duplicates resolve to the newest `modifiedTime` (the reviewed limitation), but the stale copy remains.

- [x] Step 11.5 — audit what legacy removal leaves unused (docs only, no code), manually approved.
  - Method: knip 6.38 in production mode (so exports used only by tests count as unused) on the tree, then again in a throwaway worktree with Step 12's removal simulated; every hit was checked by hand. Its list is Step 12's removal checklist below; its open decisions are resolved there.
- [x] Step 11.6 — strict persisted schema, repair-free hydration (`b05e4cc`, `1f5b161`, `1793a8f`, `14cf3de`, `59f7241`, `9d4bc21`, `5cdf4e5`, `b8b9e94`, `294b6ab`, `6bcdfe0`, `528bdc5`), 364 tests/full gate/review/manual approved; merged to `main` (`d0baf65`) and released as v2.1.0.
  - Decisions and results:
    - Goal: `loadFromStorage` only parses local v2 or falls back, with no repairs; the schema guarantees what the slices rely on. No backward compatibility is needed: every v2 document so far was written from already-clamped store state.
    - Schema rules: speech rates within 0.1–1, defined once as `speechRateSchema` (constants in `types/speech.ts`, so schemas don't import slices); an out-of-range rate from input or legacy storage falls back to 0.5 via `.catch`, with no clamp helper (user decision); non-empty `word` identities and a non-negative integer `selected`; unique IDs within every array; stored content reuses the import schemas' rules instead of looser copies (built-ins verified to pass).
    - Current IDs are repaired by the schema itself (user decision): parsing any document, local or Drive, turns a current exercise or module that isn't live into the first live entity (empty when none is live) at card 0. This also repairs v2.0.0 documents, whose merge could save a current ID the other device deleted (load-time repair then fixed it only in memory). The merge no longer repairs navigation, so there is one fallback rule.
    - Card indexes are not schema rules (their range depends on the unpersisted review/filter modes): selectors clamp the stored index to the active list when reading, replacing the hydration clamp.
    - Built-ins are only the default for an empty state (user rule): when local v2 exists, loading uses it as stored, adding no built-in modules or exercises and not reordering them. A first run saves the defaults (with built-ins) immediately, so every new user starts from saved data. Built-ins added in a later release reach only new users. Seeding and reordering move into the legacy fallback readers, which Step 12 deletes.
    - A rejected local v2 is kept under a backup key before falling back, so a stricter rule can't silently erase progress.
    - Branch: `strict-persisted-schema`, created with `--no-track` from `origin/main`.
    - `loadFromStorage` is now `readLocalPersistedState()?.<section> ?? <legacy reader>` in every slice (plus Modules' unpersisted view flags and settings' device-local voices).
    - Validation: 364 tests, type-check (including forced `tsc -b --force`), lint, changed-file format, build, and diff checks pass.
    - Review: both findings accepted and applied (`294b6ab` one `liveIds` helper shared by the schema and the merge; `6bcdfe0` one plain test per section instead of a cast-heavy `test.each`).
    - Follow-up `528bdc5`: current IDs are repaired by the schema (see above); this supersedes `59f7241`'s merge-side repair, which is removed, and the schema no longer rejects a current ID that isn't live.

## Current review gate

### Step 12 — retire legacy migration and finalize docs

- Branch: `retire-legacy-sync`, created with `--no-track` from `origin/main`.
- Decisions (2026-09-29, all by the user):
  - Every device has migrated, so nothing reads the legacy keys or Drive's `progress.json` any more; a device still on legacy keys would start from the defaults.
  - Drive's `progress.json` and each device's `sync_v2_activated` key are left in place: they're never read again, and no temporary cleanup code is added for them.
  - The device-local keys move to `src/store/deviceStorageKeys.ts` as `DeviceStorageKeys`, with the same key strings.
  - A first run still saves the defaults immediately (Step 11.6's rule, which the migration did until now): once the store is created, `main.tsx` writes its state when there's no valid local v2.
  - A new user's empty state holds every built-in in canonical order, with the **first** module and the default exercise open at card 0. `PREFERRED_DEFAULT_MODULE_ID` (`mod3_short_i`) is dropped, a user-visible change noted in the changelog.
  - `useRehydrateFromStorage` folds into `useSyncWithDrive` as `dispatch(reloadFromStorage())`; the locale and colour-scheme reload goes with the legacy pull that needed it.
  - Pre-existing dead code (D below) is in scope, in its own commits.
  - Exports: drop `export` on anything used only inside its own file. For exports used only by tests, drop it on functions (their tests go through the public API) and keep it on variables, Zod schemas included (e.g. `isoTimestampSchema`).
  - knip becomes a devDependency with `npm run knip` and a config, used for repeated removal passes until nothing unneeded is left.
  - Tests of legacy behavior are deleted. Tests that only seeded state through legacy keys set it up through the store instead (real actions plus the write-through), not hand-written v2 JSON.
  - Imports in `src/` and `test/` go through the `@/`, `@test/`, and `@resources/` aliases, never relative paths: every existing relative import is converted in one commit, and ESLint's `no-restricted-imports` rejects new ones there (config files at the root keep relative imports, which the aliases don't cover).
  - Docs: rewrite `google-account-sync.md` for v2 only, update the README sync paragraph and this doc. `persistence-gaps.md`, the plan doc, and the "legacy" wording in `index.html`/`theme.ts` (the original apps' `'1'`/`'0'` format) stay as they are.

#### Removal checklist (Step 11.5 audit)

**A. Delete — legacy code**

- `src/utils/sync/legacy/legacyStorage.ts` (+ test) and `src/utils/sync/legacy/migrateToV2.ts` (+ test); the `legacy/` folder goes.
- `src/utils/sync/google/driveStore.ts` (+ test): `readSnapshot` only served the migration's `progress.json` pull.
- Hydration fallbacks: `readLegacyPreferences` (settings), `readLegacyUnseenState` (unseen), `readLegacyModulesState` (modules) are replaced by empty-state defaults. Since Step 11.6 local v2 loads as stored, so those defaults are the only place built-ins enter: all built-in modules in canonical order, the first module as current, and the default exercise as current. `withBuiltInModules`, `resolveCurrentModuleId`, and `PREFERRED_DEFAULT_MODULE_ID` (now in `legacyStorage.ts`) go with the legacy file.
- Migration wiring: `runSync`'s unactivated branch and the `isV2Activated`/`migrateToV2` import in `driveSync.ts`; `migrateTokenlessDevice` and its imports in `main.tsx`.
- Tests: `useGoogleConnect.test.tsx`'s migration test, the legacy half of `driveSync.integration.test.ts` (seeded `progress.json`, "migrating two legacy devices"), and `driveSync.test.ts`'s unactivated-device test.

**B. Keep, but move — permanent device keys**

- `StorageKeys.darkMode`, `locale`, `systemVoice`, `systemVoiceHe`, `googleAccessToken` (same key strings, so device settings survive) move out of `legacyStorage.ts`. Importers: `theme.ts`, `i18n/index.ts`, `i18n/useLocale.ts`, `googleAuth.ts`, `settingsSlice.ts`, `listenerMiddleware.ts`, `test/helpers.ts`, and 11 test files.

**C. Becomes unused once A is gone — delete**

- `readFlag`, `writeFlag`, `listKeys` in `src/store/storage.ts` (their only callers were legacy readers, the activation marker, and cleanup).
- `useRehydrateFromStorage`'s locale and colour-scheme reload: only a legacy `progress.json` pull could change those device-local keys, so a sync reload needs just `dispatch(reloadFromStorage())`; the hook can fold into `useSyncWithDrive`.
- Legacy-only comment: `versionedValue.ts:5` (`INITIAL_UPDATED_AT` "legacy storage"). `theme.ts:112,127` and `voices.ts:80` use "legacy" for other meanings and stay.
- Exports only tests import after A: `PERSISTED_STATE_KEY` (`persistedState.ts`), `INITIAL_UPDATED_AT` (`versionedValue.ts`). Both are variables, so they stay exported.

**D. Already unused before legacy removal (not caused by it)**

- Dead code — no production caller: reducers/actions `setCardIndex` (modules), `setDyslexiaFont` (settings), `setFlashcardIndex` (unseen); `addExercise` (unseen, tests only); selectors `selectLibrary`, `selectAllMarkedWords`, `selectAllProgress`, and (since `missed-review-session`) `selectModuleCardIndex`, `selectMissedReview`, `selectModulesProgress`, `selectFlashcardIndex` (tests only); type `AppThunk` (`store.ts`); file `src/store/records.ts` (`deleteEntry`); devDependency `eslint-plugin-prettier` (only `eslint-config-prettier` is imported).
- Exported but used only inside their own file — drop `export`: `selectModuleEntries`, `selectModuleProgressEntries`, `selectExerciseEntries`, `selectExercises`, `moduleCardSchema`, `moduleExerciseSchema`, `flashcardSchema`, `cleanSpeechText`, `detectLang`, `locales`, the `i18next` re-export (`i18n/index.ts`), types `DeletableSelectItem`, `StatCount`, `SpeechState`.
- Exported only for tests: `pickBestVoice` (a function: drop `export`, test through `voices.ts`'s public API); `isoTimestampSchema` and `REJECTED_PERSISTED_STATE_KEY` (variables: stay exported).

**E. Unused parameter**

- `toIsoTimestamp`'s `zone`: no production caller passes it (only its test). It exists by the Step 8 decision (Israel as the default zone), so it stays unless that decision changes.

**F. knip false positives — keep**

- `scripts/check-no-debug-files.cjs` (run by `.husky/pre-commit`), the `vite` "unlisted binary" (a devDependency, hidden only in production mode), and `test/*` helpers (production mode skips tests).

## Step definitions

Each step's approved scope and review focus. Progress lives in [Completed](#completed) and [Current review gate](#current-review-gate).

### Step 1 — Remove link sync

- Remove UI, URL codec/import, startup precedence, translations, tests, and docs.
- Preserve legacy Google sync and local-only behavior.
- Review: link feature is gone with no Google regression.

### Step 2 — Implement import identity/replacement behavior

- Preserve supplied IDs; same live ID replaces and clears progress; final batch occurrence wins.
- Apply to Unseen and Modules using current structures.
- Review: behavior isolated from v2 persistence.

### Step 3 — Centralize legacy persistence without behavior changes

- Move old keys/snapshot logic under `src/utils/sync/legacy/`.
- Keep Redux and Google behavior equivalent.
- Review: structural boundary only; one façade.

### Step 4 — Convert current v1 models to plain semantic-ID arrays

- No `VersionedValue` yet.
- Convert answers to `AnswerRecord[]` with `questionId`.
- Convert highlights to `HighlightRecord[]` with `word`.
- Convert Unseen flashcard progress to `FlashcardProgressRecord[]` with `word`.
- Convert global Module progress to `ModuleProgressRecord[]` with `word`.
- Nest plain Unseen progress arrays inside `UnseenExercise`.
- Legacy adapter translates arrays back to old persisted maps.
- May use separate green commits for Unseen answers, highlights, flashcards, Module progress, and final nesting.
- Review: identity/collection shape only; no timestamps, deletion metadata, or v2 document.

### Step 5 — Add versioning/timestamp foundations

- Add `VersionedValue<T>`, Israel ISO timestamp generation/parsing, comparison, deletion, and Zod primitives.
- Keep utilities additive and unused by production state.
- Review: pure, focused utility tests; no runtime behavior change.

### Step 6 — Wrap canonical arrays with version metadata

- Change plain Unseen/Module arrays to `VersionedValue<T>[]`.
- Add versioned preferences and four navigation fields.
- Preserve legacy Google/local wire behavior through the adapter.
- May split Unseen, Modules, and preferences/navigation into separate green commits.
- Review: version metadata only; collection identities already settled in Step 4.

### Step 7 — Assemble and persist canonical `SyncDocumentV2`

- Define full approved Zod envelope.
- Hydrate/persist `english_progress_v2`.
- Continue projecting to legacy keys/Google `progress.json` temporarily.
- Review: aggregate local persistence and reload behavior; no Drive v2 yet.

### Step 8 — Add pure merge engine

- Implement array merge, Unseen parent-subtree resolution, timestamps, deletion, and ties.
- Keep disconnected from Drive/runtime orchestration.
- Review: exhaustive matrix tests; no production sync change.

### Step 9 — Add Drive v2 transport

- Add `progress-v2.json` locate/read/write/Zod/no-op behavior.
- Leave legacy Google sync active.
- Review: mocked transport only; no activation.

### Step 10 — Add migration/activation coordinator, uninvoked

- Implement existing-v2 and legacy conversion, ordering, marker, recovery, and cleanup.
- Do not call it from startup.
- Review: state-machine tests and proof no activation path exists.

### Step 11 — Activate v2 synchronization

- Invoke migration at boot/connect.
- Route approved three triggers through v2 merge.
- Remove visibility/page-hide sync and apply retry/notification behavior.
- Review: sole activation step; full CI plus manual two-device acceptance.

### Step 11.5 — Audit what legacy removal leaves unused

- After Step 11 is approved, list every legacy file, function, key, and test Step 12 must delete.
- Then list every function, export, file, and dependency that becomes unused once that legacy code is gone, even exported ones, using a dead-code tool (knip) plus manual verification.
- Writes the results into this doc only; no code changes. Step 12 deletes from this list.
- Review: the list is complete and each entry is verified unused.

### Step 12 — Retire legacy migration and finalize docs

- After known devices migrate and Step 11 is approved, delete legacy code/keys.
- Update README and [google-account-sync.md](./google-account-sync.md).
- Review: no legacy imports remain; full CI and final manual smoke.

## Per-step gate

1. Complete logical commits on the step's feature branch (`google-merge-sync` through Step 11), each prefixed with its step number (e.g. `[Step 5] Add VersionedValue type`, `[Step 5] [QS] Remove unused timestamp comparison`).
2. Run targeted checks after each commit.
3. Run tests, type-check, lint, changed-file formatting, build, and diff checks.
4. Run `review-code-quality` against the exact step diff.
5. Apply accepted findings in separate logical `[QS]` commits and rerun validation.
6. Present commits, combined diff, validation evidence, review findings, and dispositions.
7. Wait for manual approval before continuing.

## Execution rules

- Apply KISS and extract focused helpers for repeated or multi-step logic.
- Do not invent behavior, expand scope, or resolve an issue not covered by the approved plan. Stop and ask the user first.
- Steps are checkpoints for manual verification only; nothing ships to production until Step 11 is complete.
- No next step starts without manual approval.
- Record every new decision in this doc as soon as it's made, and keep it under the step's Completed entry when the step is approved — never drop decisions when clearing a review gate.
