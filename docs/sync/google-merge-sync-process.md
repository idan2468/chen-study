# Implementation process: Google merge sync

**Status: in progress on `google-merge-sync` — Steps 1–3 approved; Step 4 is next.**

**This file is the repository source of truth for rollout progress, commit IDs, validation results, review status, and the next step. Keep [google-merge-sync-plan.md](./google-merge-sync-plan.md) static as design documentation.**

## Completed

- [x] Step 1 — remove link sync (`0fb5850`), manually approved.
- [x] Step 2 — import identity/replacement (`9c78308`, `b27d40d`, `d4f7187`), CI/review/manual approved.
- [x] Step 3 — centralize legacy persistence (`74e221b`), 259 tests/full gate/review/manual approved.

## Next review gate

### Step 4 — plain semantic-ID arrays

- Convert current v1 maps to plain arrays.
- Add identity fields directly to values.
- Do not add `VersionedValue`, timestamps, deleted flags, or v2 persistence yet.
- Preserve legacy storage through `src/utils/sync/legacy/legacyStorage.ts`.
- Use separate logical commits where they improve reviewability.
- Apply KISS and helper extraction throughout.
- Run full validation and `review-code-quality`, then stop for manual approval.

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

No next step starts without manual approval.
