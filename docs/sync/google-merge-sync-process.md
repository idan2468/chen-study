# Implementation process: Google merge sync

**Status: in progress on `google-merge-sync` — Steps 1–7.5 approved; Step 8 is in review.**

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

## Current review gate

### Step 8 — pure merge engine

- Newest `updatedAt` wins, compared as parsed instants; Drive wins ties so every device converges on the shared copy.
- Deletion is plain newest-wins: tombstones are kept forever, but a later re-import of the same ID beats an older tombstone.
- Unseen exercises: a newer exercise wins with its whole subtree (answers, highlights, flashcard progress); equal live versions keep Drive's exercise fields and merge each child record by newest-wins.
- Modules, global Module progress words, and each preference merge independently by newest-wins.
- Navigation merges as a pair: when the current IDs differ, the side that switched more recently wins both the ID and its card index; when they match, each field is newest-wins.
- Merged arrays keep Drive's order, then append local-only IDs in local order.
- Commits: `f39f66c`, `811b7d0`, `c1d2bcb`; review `[QS]` commits: `32ab173`, `7b80663`, `9a19496`, `20745cf`, `14f4e3b`.
- `mergePersistedState(local, remote)` is pure and has no callers outside its tests; production sync is unchanged.
- Validation: 323 tests, type-check, lint, changed-file format, build, and diff checks pass.
- Review: all five findings accepted and applied (section mergers renamed apart from the slice's `mergeModules`, per-exercise resolver named `mergeExercise`, `isNewer` predicate, no global `document` shadowing in tests, navigation-vs-exercises regression test).
- Awaiting manual approval.

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

### Step 12 — Retire legacy migration and finalize docs

- After known devices migrate and Step 11 is approved, delete legacy code/keys.
- Update README and [google-account-sync.md](./google-account-sync.md).
- Review: no legacy imports remain; full CI and final manual smoke.

## Per-step gate

1. Complete logical commits on `google-merge-sync`, each prefixed with its step number (e.g. `[Step 5] Add VersionedValue type`, `[Step 5] [QS] Remove unused timestamp comparison`).
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
