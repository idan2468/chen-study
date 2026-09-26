# Implementation process: Google merge sync

**Status: in progress on `google-merge-sync` — Steps 1–5 approved; Step 6 is next.**

**This file is the repository source of truth for rollout progress, commit IDs, validation results, review status, and the next step. Keep [google-merge-sync-plan.md](./google-merge-sync-plan.md) static as design documentation.**

## Completed

- [x] Step 1 — remove link sync (`0fb5850`), manually approved.
- [x] Step 2 — import identity/replacement (`9c78308`, `b27d40d`, `d4f7187`), CI/review/manual approved.
- [x] Step 3 — centralize legacy persistence (`74e221b`), 259 tests/full gate/review/manual approved.
- [x] Step 3.5 — visibility-aware interval sync (`cc1eb93`), 259 tests/full gate/review/manual approved.
- [x] Step 4 — plain semantic-ID arrays (`0b52449`, `4d519db`, `11b709f`, `4c5c84e`), 263 tests/full gate/review/manual approved.
- [x] Step 5 — version/timestamp foundations (`a9c8cf3`, `5b65723`, `948b92c`, `413f263`, `01d514b`, `d067b9e`), 268 tests/full gate/review/manual approved.

## Current review gate

### Step 6 — versioned arrays

- Not yet started.

## Remaining rollout

7. Canonical local v2.
8. Pure merge engine.
9. Drive v2 transport.
10. Uninvoked migration coordinator.
11. V2 activation.
12. Legacy retirement and docs.

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
- No next step starts without manual approval.
