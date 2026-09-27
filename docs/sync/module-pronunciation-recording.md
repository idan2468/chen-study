# Design: module pronunciation recording

**Status: proposed design. Assumes the v2 merge-sync design
([google-merge-sync-plan.md](./google-merge-sync-plan.md)) is already
implemented and active** — canonical models wrap values in `VersionedValue<T>`,
the shared Drive v2 document is live, and the legacy `progress.json` path is
retired.

## Why

On a module flashcard the user can already hear the correct pronunciation of the
English word via the existing `SpeakButton` (`window.speechSynthesis`). This
feature lets the user **record their own pronunciation** of that word and play
it back to compare against the correct one. The core feature has no automated
scoring; scoring is written up as an optional add-on below (it needs a paid
service plus a token broker). The core is a listen-and-self-compare aid.

No backend: capture uses the browser's `MediaRecorder` + `getUserMedia`, and the
audio is stored in the user's own Google Drive `appDataFolder`, exactly like all
other synced state today.

## Decisions taken

| Decision | Choice |
| --- | --- |
| Recordings kept per word | **One — latest overwrites.** No history. |
| Identity key | The English word (`ModuleCard.en`), matching `ModuleProgressRecord.word`. |
| Where audio bytes live | A per-word binary file in the Drive `appDataFolder`, **not** in the v2 document. |
| What the v2 document holds | Only a pointer (`driveFileId`), wrapped in `VersionedValue<T>`. |
| Overwrite semantics | Upload new blob → repoint record → delete the previous Drive file. One file per word, bounded storage. |
| Conflict resolution | Inherited from v2: last-write-wins on `updatedAt`; a deleted record clears the pointer. |
| Cross-device playback | Lazy download from Drive when the card opens on another device. |
| Scoring / grading | Out of scope — requires a backend or external API. |

## Canonical model

A new synced collection on the canonical document, following the same
`VersionedValue<T>` + semantic-ID array shape as Module progress:

```ts
interface RecordingRecord {
  /** English word, the same identity key as ModuleProgressRecord.word. */
  word: string
  /** Id of the audio file in the Drive appDataFolder. */
  driveFileId: string
}

// On the canonical document, alongside the existing collections:
//   recordings: VersionedValue<RecordingRecord>[]
```

"Latest overwrites" is not special-cased: re-recording a word updates that
word's `VersionedValue` (new `updatedAt`, new `driveFileId`) and the v2 merge
keeps the newest. Clearing a recording sets `deleted: true` per the standard
deletion rule; the merge treats it as a permanent absence for that word until a
new recording creates a fresh value.

## Audio storage (Drive, no backend)

Audio blobs are stored as individual binary files in the same hidden
`appDataFolder` the v2 document uses — no user-visible files, no backend.

- **Upload:** on stop, `MediaRecorder` produces a `Blob` (WebM/Opus). Upload it
  via the multipart Drive upload endpoint (the same `DRIVE_UPLOAD_URL` +
  `authorizedFetch` already used for the v2 document in
  `src/utils/sync/google/driveStore.ts`), then write `driveFileId` into the
  record and let the normal sync trigger push the updated v2 document.
- **Overwrite:** upload the new blob first, repoint the record, then delete the
  old file id. Doing it in that order means a mid-way failure never leaves a
  record pointing at a deleted file.
- **Download:** when a module card opens on any device, if its record has a
  `driveFileId` and the blob is not cached locally, download it on demand and
  cache it (see below) for instant replay.
- **Orphan cleanup:** because there is exactly one file per word and overwrite
  deletes the predecessor, orphans only arise from an interrupted overwrite. A
  lightweight reconciliation (list `appDataFolder` audio files, delete any not
  referenced by a live `recordings` record) can run opportunistically; it is not
  required for correctness.

## Local caching

To keep playback instant and avoid re-downloading on every card visit, cache the
downloaded/just-recorded blob per word in **IndexedDB** (blobs do not belong in
`localStorage`, and are never part of the synced string document). The cache is
a device-local convenience only — the Drive file plus the v2 pointer remain the
source of truth, so a cleared cache simply re-downloads.

## UI

On the module flashcard back (`src/pages/modules/ModuleFlashcard.tsx`), beside
the existing `SpeakButton`:

- A **record / stop** control — an `ActionIcon` mirroring `SpeakButton`'s
  play/stop toggle look (record = idle, stop = recording), so the visual
  language is consistent.
- A **play-my-recording** control that appears only once a recording exists for
  the current word.
- The existing correct-pronunciation `SpeakButton` is unchanged; the two sit
  side by side so the user can play mine, then play correct.

Reuse over new markup, per the component-reuse rule: prefer Mantine
`ActionIcon` / `Tooltip` and the existing `SpeakButton` visual pattern rather
than hand-rolled controls.

## Suggested code shape

- `useMediaRecorder` hook — wraps `getUserMedia({ audio: true })` +
  `MediaRecorder`, exposes `start` / `stop` and the resulting `Blob`, and reports
  unsupported / permission-denied so the UI can hide or disable the control
  (mirroring how `SpeakButton` returns `null` when speech is unsupported).
- Recording Drive helpers next to `driveStore.ts` (e.g. under
  `src/utils/sync/google/`): `uploadRecording(blob) -> fileId`,
  `downloadRecording(fileId) -> Blob`, `deleteRecording(fileId)`.
- An IndexedDB blob cache keyed by word.
- A `recordings` slice / selectors following the Module-progress pattern, exposed
  to the UI as a keyed view so components never touch `VersionedValue` metadata.

## Optional addition: automated pronunciation scoring

The record-and-compare feature above is fully frontend-only and requires no
paid service. Automated **scoring** ("how good was your pronunciation?") is an
optional layer on top, not part of the core feature.

- **Provider:** Azure AI Speech — Pronunciation Assessment. It is purpose-built
  for language learning and returns accuracy, fluency, completeness, and
  per-phoneme scores against the expected word. It ships a first-class browser
  JavaScript SDK that captures from the mic, so it reuses the same
  `useMediaRecorder` capture. Speechace and SpeechSuper are comparable but are
  commercial/contact-for-pricing with only trial free tiers; Google/AWS have no
  equivalent dedicated scoring product.
- **Cost:** pronunciation assessment is billed as standard speech-to-text, per
  second of audio. Azure's free tier (F0) is a **permanent 5 audio hours per
  month**. At ~1–2 seconds per module word, that is roughly 9,000–18,000 word
  attempts/month free — a single-user vocabulary app will effectively never
  leave the free tier. Beyond it, Standard is on the order of ~$1 per audio hour
  (verify the current rate in the Azure pricing calculator for the region).
- **Why this breaks "no backend":** the scoring API authenticates with a secret
  key that must never ship in the static GitHub Pages bundle. The standard
  pattern is a **tiny token-broker endpoint** (e.g. an Azure Function) that holds
  the secret and hands the browser a short-lived token; the browser SDK then does
  the audio streaming directly. So this addition needs one small serverless
  function — not a full backend, but not zero infrastructure either. This is the
  reason it is optional and separate from the core record-and-compare feature.
- **UX:** reuse the recorded blob; after playback, send it to Azure via the
  token broker and show the returned score alongside the play controls. No new
  sync data is required — a score is transient feedback, not persisted state.



- **HTTPS only.** `getUserMedia` requires a secure origin. GitHub Pages (prod)
  and `localhost` (dev) both qualify.
- **Mic permission.** First use prompts; a denied state must degrade gracefully
  (hide/disable the record control), not throw.
- **Not connected to Google.** If Drive is not connected, recording still works
  locally (IndexedDB) but does not sync; the pointer is written to the canonical
  document and uploads on the next connect, consistent with how other state
  becomes syncable once connected. (Open point — see below.)
- **No pronunciation scoring in the core feature** — it is an optional
  add-on that requires a paid service and a token broker (see "Optional addition:
  automated pronunciation scoring" above). The core feature is listen-only: no
  waveform/spectrogram comparison.

## Open points

- **Not-connected behavior:** allow local-only record with deferred upload on
  connect, or require a Google connection before recording is offered.
- **Cache eviction:** whether to bound the IndexedDB cache size or keep every
  downloaded word (one small blob per word is modest, so likely no eviction
  needed initially).

## Testing

- `useMediaRecorder`: supported / unsupported / permission-denied paths (stub
  `getUserMedia` and `MediaRecorder` in jsdom).
- Drive helpers: upload writes a file and returns an id; overwrite uploads then
  deletes the predecessor; download returns the blob; delete removes it (mock
  `authorizedFetch`).
- Slice/selectors: re-recording a word overwrites its record with a newer
  `updatedAt`; clearing marks it deleted; the keyed view exposes only the latest
  per word.
- Merge: two devices recording the same word resolve last-write-wins on
  `updatedAt`, consistent with the v2 merge rules.
- Component: record control toggles record/stop; play-my-recording appears only
  after a recording exists; the correct-pronunciation button is unaffected.
