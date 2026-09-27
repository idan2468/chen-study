# Plan: merge Google Drive and local progress

**Status: approved design. Implementation progress is tracked only in [google-merge-sync-process.md](./google-merge-sync-process.md).**

## Approved design

- Remove link sync; Google is the only cross-device mechanism while local-only use remains.
- Canonical models use semantic-ID arrays and later `VersionedValue<T>` wrappers.
- All entity and question IDs are mandatory.
- Store timestamps as offset-bearing `Asia/Jerusalem` ISO strings and compare parsed instants.
- Validate timestamps only as offset-bearing ISO datetimes; convert to Israel time when working with them logically.
- Entity deletion is permanent for that ID.
- Unseen replacement selects the complete parent subtree.
- Module reset stores `CardStatus.None`; stale later progress may win.
- Use one shared Drive v2 document and accept the reviewed rare concurrent-write limitation.
- Sync on connect/boot, the visible-tab 30-second timer, return-to-visible, and **Sync now**.
- Hidden tabs skip interval sync; returning to visible syncs immediately and silently.
- The current one-time page-hide push remains only for legacy sync and is removed at v2 activation.
- Keep current minimal retries and silent passive transient failures.
- Migrate through legacy pull → local conversion → local v2 → Drive v2 → activation → idempotent legacy deletion.
- Keep temporary legacy behavior centralized and removable.

## Canonical model

```ts
type IsoTimestamp = string

interface VersionedValue<T> {
  value: T
  updatedAt: IsoTimestamp
  deleted: boolean
}

interface AnswerRecord {
  questionId: string
  selected: number
  correct: boolean
}

interface HighlightRecord {
  word: string
}

interface FlashcardProgressRecord {
  word: string
  isKnown: boolean
}

interface ModuleProgressRecord {
  word: string
  status: CardStatus
}
```

Dynamic identities are exercise ID, question ID, word, Module ID, and global Module-progress word. Canonical collections are semantic-ID arrays; merge helpers may temporarily index them.

## Legacy boundary

Temporary legacy storage and migration code lives under `src/utils/sync/legacy/`. Canonical models, reducers, components, v2 schema, and merge logic must not contain legacy branches. Permanent device-local keys are extracted before the legacy folder is retired.

## Implementation quality rules

- Apply KISS throughout.
- Refactor repeated or multi-step logic into focused, well-named helpers.
- Keep reducers, hooks, migration, merge, and Drive orchestration easy to scan.
- Avoid trivial wrappers and speculative abstractions.
- Before writing a utility from scratch, look for an established library that already covers it (e.g. luxon for dates and time zones) and prefer it over hand-rolled helpers.
- If implementation exposes an issue or decision not explicitly covered here, stop and ask the user instead of assuming behavior or expanding scope.
- Run `review-code-quality` after every completed step and before manual review.

## Branch and validation policy

All implementation stays on `google-merge-sync`; no push unless requested. Every commit compiles and passes relevant targeted checks. Every completed step passes tests, type-check, lint, changed-file format validation, build, and diff checks before review.

## Approved test coverage

Coverage includes link removal; mandatory identities/import replacement; map-to-array conversion; versioning and Israel timestamps; Unseen/Module conflict behavior; preferences/navigation; migration success/failure/cleanup; Drive validation/race; three triggers; retries/auth; legacy-boundary deletion; and macOS/Android manual acceptance.

## Approved rollout

The approved twelve-step design and all completion state live exclusively in [google-merge-sync-process.md](./google-merge-sync-process.md). This document records design decisions only and must not duplicate step status, commit IDs, validation results, or the current next step.
