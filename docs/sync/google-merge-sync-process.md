# Implementation process: Google merge sync

**Status: in progress on `google-merge-sync` — Steps 1–3.5 approved; Step 4 awaits manual approval.**

**This file is the repository source of truth for rollout progress, commit IDs, validation results, review status, and the next step. Keep [google-merge-sync-plan.md](./google-merge-sync-plan.md) static as design documentation.**

## Completed

- [x] Step 1 — remove link sync (`0fb5850`), manually approved.
- [x] Step 2 — import identity/replacement (`9c78308`, `b27d40d`, `d4f7187`), CI/review/manual approved.
- [x] Step 3 — centralize legacy persistence (`74e221b`), 259 tests/full gate/review/manual approved.
- [x] Step 3.5 — visibility-aware interval sync (`cc1eb93`), 259 tests/full gate/review/manual approved.

## Current review gate

### Step 4 — plain semantic-ID arrays

- Module progress is stored as global semantic-word records (`0b52449`).
- Unseen exercises and their answer, highlight, and flashcard progress are nested semantic-ID arrays (`4d519db`).
- Legacy local/Drive key shapes remain unchanged through adapters in `src/utils/sync/legacy/legacyStorage.ts`.
- No `VersionedValue`, timestamps, deleted flags, or v2 persistence were added.
- `review-code-quality` completed. The generated-data finding was resolved by removing the obsolete one-off extractor (`11b709f`); duplicate-projection and test-fixture refactors were not selected.
- Full gate passed with 263 tests, type-check, lint, changed-file Prettier, build, and `git diff --check`.
- Awaiting manual approval before Step 5.

## Remaining rollout

5. Version/timestamp foundations.
6. Versioned arrays.
7. Canonical local v2.
8. Pure merge engine.
9. Drive v2 transport.
10. Uninvoked migration coordinator.
11. V2 activation.
12. Legacy retirement and docs.

## Per-step gate

1. Complete logical commits on `google-merge-sync`.
2. Run targeted checks after each commit.
3. Run tests, type-check, lint, changed-file formatting, build, and diff checks.
4. Run `review-code-quality` against the exact step diff.
5. Apply accepted findings in separate logical `[QS]` commits and rerun validation.
6. Present commits, combined diff, validation evidence, review findings, and dispositions.
7. Wait for manual approval before continuing.

## Execution rules

- Apply KISS and extract focused helpers for repeated or multi-step logic.
- Do not invent behavior, expand scope, or resolve an issue not covered by the approved plan. Stop and ask the user first.
- No next step starts without manual approval.
