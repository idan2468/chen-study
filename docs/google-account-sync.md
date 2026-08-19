# Plan: sync progress through the user's own Google account

**Status: proposal, nothing implemented.** Several decisions in
[Open questions](#open-questions) change the shape of the code and are
deliberately left unanswered — this document should not be executed until they
are settled.

## Why

`?s=` share links work, but they are a one-way handoff, not sync:

- The whole snapshot rides in the URL, so the link grows with the exercise
  library. Post-gzip a 5 KB snapshot is ~2,600 characters; at ~15 exercises it is
  back over 10,000 and messaging apps start truncating it.
- Importing **replaces** the receiving device's storage. Progress made on that
  device since the last link is lost.
- Every handoff is a manual act: open the modal, copy, send, open on the other
  device.

The goal is for progress to follow the learner across devices, with the hard
constraint that **there is no backend and no database on our side**. The app is a
static bundle on GitHub Pages and must stay that way.

## Why this is possible without a backend

Google Drive can act as the store, using the _user's own_ Drive:

| Piece  | Choice                                            | Note                                                                                      |
| ------ | ------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Auth   | Google Identity Services token client, in-browser | `google.accounts.oauth2.initTokenClient`, implicit flow, no client secret                 |
| Scope  | `drive.appdata` (or `drive.file`, see Q1)         | Both are **non-sensitive**: no security assessment, and app verification is not mandatory |
| Store  | one JSON file in the app-data folder              | Read/written with plain `fetch`; no client library needed                                 |
| Server | none                                              | The browser talks to `googleapis.com` directly                                            |

The OAuth client ID is not a secret — it ships in the bundle by design. The only
setup outside the repo is a Google Cloud project with an OAuth consent screen and
`https://idan2468.github.io` (plus `http://localhost:5173` for `npm run dev`)
registered as authorized JavaScript origins.

### What still cannot work without a backend

- **Silent background sync.** Browser-only OAuth issues access tokens that last
  about an hour and gives **no refresh token**. A new token needs
  `requestAccessToken()`, which opens a popup and therefore wants a user gesture.
  It can be re-issued without a consent prompt while the Google session cookie is
  alive, but it can also be blocked — notably on iOS Safari. So syncing has to be
  something the user can always trigger by tapping, and the UI has to have an
  honest "tap to reconnect" state.
- Sharing progress with a second person (a teacher's dashboard), or anything that
  needs to run while nobody has the app open.

## Design sketch

### The snapshot

Reuse what already exists. `buildSyncPayload()` and `applySyncPayload()` in
`src/utils/syncUrl.ts` already produce and consume the exact
`Record<localStorageKey, string>` snapshot this needs, and `isSyncableKey`
already encodes which keys are shareable versus device-local. The Drive file is
that same object, so links and Drive sync cannot drift apart.

### Modules to add

| Path                           | Responsibility                                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------------- |
| `src/utils/googleAuth.ts`      | load the GIS script, hold the access token in memory, expose `requestToken()` / `signOut()` |
| `src/utils/driveStore.ts`      | `readSnapshot()` / `writeSnapshot()` against the Drive REST API                             |
| `src/utils/syncMerge.ts`       | merge a remote snapshot into local storage (see Q2/Q3)                                      |
| `src/components/AccountModal/` | connect/disconnect, last-synced time, "Sync now"                                            |

`syncUrl.ts` keeps its current job — the link stays as the no-account fallback.

### Drive REST calls

Four requests, all with `Authorization: Bearer <token>`:

| Purpose  | Request                                                                                          |
| -------- | ------------------------------------------------------------------------------------------------ |
| Locate   | `GET /drive/v3/files?spaces=appDataFolder&q=name='progress.json'&fields=files(id,modifiedTime)`  |
| Download | `GET /drive/v3/files/{id}?alt=media`                                                             |
| Create   | `POST /upload/drive/v3/files?uploadType=multipart`, metadata `{name, parents:["appDataFolder"]}` |
| Update   | `PATCH /upload/drive/v3/files/{id}?uploadType=media`                                             |

A `401` means the token aged out: re-request it and retry once.

### The actual hard part: merging

Everything above is plumbing. The real design problem is that two devices can
both change progress before either syncs, and the current import strategy
("overwrite everything") silently destroys one side's work. The data shapes help,
because nearly all of it is a keyed record where union is the obvious answer:

| Key                                                                  | Shape                                | Natural merge                                  |
| -------------------------------------------------------------------- | ------------------------------------ | ---------------------------------------------- |
| `english_reading_practice_progress_v3`                               | `Record<word, "known" \| "unknown">` | union; needs a rule when the two disagree (Q3) |
| `flashcards_status_*`                                                | `Record<word, boolean>`              | union, same caveat                             |
| `english_exercise_library`, `english_reading_all_modules_v4`         | `Record<id, …>`                      | union by id; deletions need thought (Q4)       |
| `english_current_*_id`, deck positions                               | scalar                               | last write wins; arguably device-local         |
| `dark_mode_enabled`, `dyslexia_font_enabled*`, `english_speech_rate` | scalar                               | last write wins (Q5)                           |

Union merging needs no timestamps and no schema change, which is why it is worth
preferring over stamping every localStorage write with an `updatedAt`.

## Rollout

1. **Google Cloud setup** (no code): project, consent screen, OAuth client, both
   authorized origins. Publish to production so use is not capped at 100 test
   users — with non-sensitive scopes only, this should not trigger a verification
   review, but confirm the consent screen is clean on a real device before
   relying on it.
2. **`googleAuth.ts` + a Connect button** that proves a token can be obtained,
   with no Drive calls yet.
3. **`driveStore.ts`** — write the snapshot, then read it back on a second
   device, still overwriting on import as the link does today.
4. **`syncMerge.ts`** — replace overwrite with merge; this is where the tests
   matter most, since it is the only part that can lose data.
5. **Trigger policy** (Q6) and the reconnect UI.
6. **Docs**: README section, and note in `storageKeys.ts` that key names are now
   also a wire format for the Drive file.

Steps 2–4 are each independently shippable and independently useless, which
suits the one-commit-at-a-time workflow.

## Testing

The auth and Drive layers are thin wrappers over `fetch` and a Google-hosted
script, so they are worth faking at the boundary rather than unit-testing
deeply. `syncMerge.ts` is pure and deserves real coverage: two snapshots in, one
result out, including the conflict cases from Q3 and the deletion case from Q4.

End to end it needs a real device check — two browsers, one account, progress
made on both before either syncs.

## Open questions

Nothing below is assumed; each answer changes the code.

1. **`drive.appdata` or `drive.file`?** App-data is hidden: the user cannot see,
   inspect, back up or accidentally delete the file. `drive.file` puts a visible
   `chen-study-progress.json` in their Drive: transparent and manually
   recoverable, but it is clutter and it can be deleted or edited by hand. Both
   are non-sensitive.
2. **Merge or last-write-wins?** Whole-file LWW is a fraction of the work and is
   fine if only one device is ever "live" at a time. Per-record union merge is
   the correct answer if two devices are genuinely used in parallel.
3. **Conflict rule** when the same word is `known` on one device and `unknown` on
   the other. Options: "known wins" (optimistic, never re-tests a mastered word),
   "unknown wins" (conservative, may re-test), or "most recent device wins"
   (needs timestamps).
4. **Do deletions propagate?** With union merge, an exercise deleted on one
   device comes back from the other. Making deletion stick needs tombstones —
   `english_reading_deleted_builtins_v1` already does this for built-in modules,
   so the pattern exists.
5. **Should device preferences sync at all?** Dark mode, dyslexia font and speech
   rate are currently in share links. `english_system_voice` was deliberately
   excluded because a `voiceURI` is meaningless on another machine. Screen size
   and reading speed arguably belong to the device too.
6. **When does sync run?** Manual "Sync now" only; on every app start when a
   token can be obtained silently; or debounced after changes. Automatic is
   nicer, but every attempt can hit the popup-blocked path described above.
7. **Show which account is connected?** Displaying an email address means asking
   for an extra identity scope. Otherwise the UI can only say "connected".
8. **Is the app fully usable with no Google account?** Assumed yes — local-only
   plus `?s=` links — but this decides whether a "Connect" prompt can be
   dismissed permanently.
9. **Client ID: `VITE_GOOGLE_CLIENT_ID` or committed constant?** It is public
   either way. An env var needs the GitHub Pages workflow to pass it at build
   time.
10. **Who owns the Google Cloud project?** It has to be a real account that keeps
    owning the OAuth client; the app breaks if that project is deleted.
