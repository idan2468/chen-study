# Plan: sync progress through the user's own Google account

**Status: proposal, nothing implemented.** All design decisions are settled —
see [Decisions taken](#decisions-taken).

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

## Decisions taken

| Decision                  | Choice                                                                                         |
| ------------------------- | ---------------------------------------------------------------------------------------------- |
| Storage location          | `drive.appdata` — hidden app-data folder, so the file cannot be edited or deleted by hand      |
| Merge strategy            | whole-file last-write-wins, with only the dirty-check guard below                              |
| Sync triggers             | manual "Sync now", a 2-minute timer, and on page hide                                          |
| No-account usage          | fully usable without one — local-only storage plus `?s=` links                                 |
| Connected-account display | show the signed-in email, via an added `userinfo.email` scope                                  |
| Device preferences        | dark mode, dyslexia font and speech rate keep syncing; only `english_system_voice` stays local |
| Client ID storage         | `VITE_GOOGLE_CLIENT_ID` env var, injected at build time by the GitHub Pages workflow           |
| Browser/platform support  | Chrome only, on macOS, Windows and Android — no iOS Safari support required                    |

The Google account is additive, never required. Nothing in the app degrades or
nags if the user never connects one: the "Connect" prompt can be dismissed for
good, not just snoozed.

Two devices that both edit before either syncs are not detected and not merged —
whichever syncs second simply overwrites the other, with no alert. Simpler to
build and to reason about, and reasonable for how this app is actually used: a
single learner, rarely editing the same content on two devices in the same few
minutes. Detecting that case, and per-record merging generally, are both
deferred — see [Possible future additions](#possible-future-additions).

## Why a Google Cloud project is still needed

The file lives in the user's own Drive, but Google will not issue an access token
to an anonymous caller. The OAuth client identifies _this app_ — which origin may
request a token, and what the consent screen names. This is the same arrangement
WhatsApp uses for chat backups: the backup is in the user's Drive, while WhatsApp
itself is a registered OAuth client, which is why Android asks "WhatsApp wants to
access your Google Account".

The project stores no data, runs nothing, and costs nothing. The only truly
registration-free alternative is the user moving an exported JSON file into Drive
themselves, which is a manual fallback rather than sync.

### Setting it up by hand

Console navigation was reorganised: the old **APIs & Services → OAuth consent
screen** page no longer exists, and everything below lives under **APIs &
Services → Google Auth Platform**, split across Branding, Audience, Clients and
Data Access tabs.

1. **Create the project.** <https://console.cloud.google.com> → project picker →
   **New project**. Name it anything (`chen-study`); no billing account is
   needed.
2. **Enable the Drive API.** **APIs & Services → Library** → search
   "Google Drive API" → **Enable**. Easy to miss, and without it every Drive
   call returns 403 even with a perfectly good token.
3. **Register the app.** **Google Auth Platform** → **Get started**:
   - App name — this is what the consent screen shows her, so make it something
     recognisable rather than the project id.
   - User support email — your own address.
   - Audience — **External**. "Internal" only exists for Google Workspace
     organisations.
   - Contact email, then accept the User Data Policy and **Create**.
4. **Declare the scopes.** **Data Access** → **Add or remove scopes** → tick both
   `https://www.googleapis.com/auth/drive.appdata` and
   `https://www.googleapis.com/auth/userinfo.email` (the second is what lets the
   UI show which account is connected). Confirm both land in the
   **non-sensitive** group; if either appears under sensitive or restricted, the
   wrong scope got selected. Save.
5. **Create the client.** **Clients** → **Create client** → type **Web
   application**. Under **Authorized JavaScript origins** add both:
   - `https://idan2468.github.io`
   - `http://localhost:5173`

   Origins are scheme, host and port only — no path, so **not**
   `https://idan2468.github.io/chen-study/`. HTTPS is mandatory except for
   localhost, which is exempt. Leave **Authorized redirect URIs empty**: the
   token model used here returns the token to the page itself, so it never
   redirects.

6. **Copy the client ID** (it ends in `.apps.googleusercontent.com`) into
   `VITE_GOOGLE_CLIENT_ID`. It is public either way, since it ships in the
   bundle — but as an env var it needs the GitHub Pages workflow to pass it at
   build time, rather than being committed as a constant. Worth noting that
   `idan2468.github.io` is one origin shared by every project published there,
   so any page on it could use this client ID. Google also issues a client
   **secret** for this client type — we never use it, and it must not go
   anywhere near the repo.
7. **Choose a publishing mode.** Under **Audience**:
   - **Testing** — only accounts listed under **Audience → Test users** can
     authorise, capped at 100, so every device's account has to be added there.
     The usual drawback of this mode, refresh tokens expiring after seven days,
     does not apply because this flow never issues one — which makes Testing a
     perfectly viable permanent state for a family app.
   - **In production** — anyone can authorise. Google's guidance on whether a
     non-sensitive-scope app is nudged toward basic brand verification is not
     unambiguous, so publish, then check on a real device whether the consent
     screen is clean before depending on it. Testing mode remains the fallback.

Once step 6 exists, the app's side of the setup is a single env var; see
[Client ID storage](#decisions-taken).

## Why this is possible without a backend

Google Drive can act as the store, using the _user's own_ Drive:

| Piece  | Choice                                            | Note                                                                           |
| ------ | ------------------------------------------------- | ------------------------------------------------------------------------------ |
| Auth   | Google Identity Services token client, in-browser | `google.accounts.oauth2.initTokenClient`, implicit flow, no client secret      |
| Scopes | `drive.appdata` and `userinfo.email`              | Both **non-sensitive**: no security assessment, app verification not mandatory |
| Store  | one JSON file in the app-data folder              | Read/written with plain `fetch`; no client library needed                      |
| Server | none                                              | The browser talks to `googleapis.com` directly                                 |

The OAuth client ID is not a secret — it ships in the bundle by design. The only
setup outside the repo is a Google Cloud project with an OAuth consent screen and
`https://idan2468.github.io` (plus `http://localhost:5173` for `npm run dev`)
registered as authorized JavaScript origins.

### What still cannot work without a backend

- **A refresh token.** See below — this is the one that keeps getting asked
  about, so it gets its own explanation.
- Sharing progress with a second person (a teacher's dashboard), or anything that
  needs to run while nobody has the app open.

### Why there is no way to get a refresh token here

Only Google's **Authorization Code** flow issues a refresh token; the token
client this plan uses (`initTokenClient`, an implicit-style flow) never does —
that is not a missing option, it is how that flow is defined.

Switching flows does not help. Getting a refresh token means POSTing the
authorization code to `https://oauth2.googleapis.com/token` and reading the
JSON response — containing the refresh token — back into the page's own
JavaScript. That endpoint does not send CORS headers to a browser `fetch`, so the
response is simply unreachable from client-side code. This is not a workaround
away: it is how Google's endpoint behaves, confirmed by Google's own docs, which
offer a separate `initCodeClient` specifically for apps that _already have a
backend_ to receive the code, and by consistent reports of that exact call
being blocked.

Registering the OAuth client as a public "Desktop app" type does not fix this
either. It only removes the requirement for a confidential client secret (and
even that inconsistently, per Google's own developer forum) — it changes nothing
about CORS. The only thing that can read that response is something running
server-side, even a single stateless function invoked once per sign-in. That is
a backend by the constraint this whole plan works under, so it is out of scope
here.

What is left instead: an access token that lasts about an hour, renewed by
calling `requestAccessToken({ prompt: '' })`. While the browser still holds a
live Google session, this typically succeeds with no visible prompt; if it
can't — the session cookie is gone, or Chrome blocks the popup it opens
internally — it fails, and the UI has to show an honest "tap to reconnect"
rather than pretend to have synced. That is exactly why the plan pairs the
2-minute timer with a manual button rather than relying on the timer alone.

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
| `src/utils/driveSync.ts`       | the policy: dirty check, triggers, last-synced state                                        |
| `src/components/AccountModal/` | connect/disconnect, connected account's email, last-synced time, "Sync now"                 |

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

### The one guard that is worth keeping: the dirty check

Whole-file last-write-wins combined with a 2-minute timer is unsafe on its own,
but the failure mode it actually needs guarding against is narrower than "two
devices disagree" — it is an **idle device with nothing new to say** clobbering
one that has been actively used. Picture an iPad left open in another room while
the laptop is in use: its timer fires, uploads the snapshot it has held since
this morning, and the laptop's newer progress is gone. Nobody touched the iPad —
the timer alone did it.

The fix costs nothing extra to build: hash the local snapshot and keep the hash
from the last successful sync. An unchanged device then has nothing to push, so
its timer becomes a no-op rather than a hazard.

This does **not** cover two devices that were both genuinely edited before either
synced — by decision, that case is simply not detected; see
[Decisions taken](#decisions-taken).

### Trigger mechanics

| Trigger          | Mechanism                     | Caveat                                                                                                                                                                                                                              |
| ---------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Sync now"       | button                        | always available, and the only path guaranteed to carry a user gesture                                                                                                                                                              |
| Every 2 minutes  | `setInterval`                 | roughly every thirtieth tick lands after the ~1 h token expiry and needs a silent re-issue, which can be popup-blocked. It has to degrade to a visible "tap to reconnect", never a silent failure                                   |
| Leaving the page | `visibilitychange` → `hidden` | not `beforeunload`, which cannot reliably finish an async request. `fetch(…, { keepalive: true })` survives unload and, unlike `sendBeacon`, can still set the `Authorization` header; its 64 KB body cap dwarfs our ~5 KB snapshot |

## Rollout

1. **Google Cloud setup** — no code; see
   [Setting it up by hand](#setting-it-up-by-hand).
2. **`googleAuth.ts` and a Connect button** that proves a token can be obtained,
   with no Drive calls at all yet.
3. **`driveStore.ts`** — push the snapshot, then read it back on a second device,
   still overwriting local storage exactly as an imported link does today.
4. **`driveSync.ts`** — add the dirty check, so an idle device's timer can no
   longer clobber an active one. This is the step that protects data and it
   deserves the most test attention.
5. **Triggers and the reconnect UI** — the button, the 2-minute timer, the
   page-hide push, and the "tap to reconnect" state when a token cannot be
   obtained silently.
6. **Docs** — a README section, and a note in `storageKeys.ts` that these key
   names are now a wire format for the Drive file too, not just for links.

Steps 2 to 5 are each independently shippable and individually useless, which
suits committing one at a time.

## Testing

The auth and Drive layers are thin wrappers over `fetch` and a Google-hosted
script, so fake them at the boundary rather than testing them deeply. The
decision logic in `driveSync.ts` is where real coverage belongs: unchanged local
data must never push, so an idle device's timer is provably a no-op rather than
something only observed to behave by accident.

End to end this still needs a real two-device check on one account, including
progress made on both sides before either syncs.

## Definition of done

Standard checks — full test suite, lint, format, typecheck — cover the code but
not the parts that only exist once real Google infrastructure is involved. Those
need to be verified by hand, once, before calling this done:

### Config, not code

- [ ] The client ID authenticates from `https://idan2468.github.io/chen-study/`
      and from `npm run dev` (`http://localhost:5173`), and from nowhere else.
- [ ] The GitHub Pages workflow passes `VITE_GOOGLE_CLIENT_ID` at build time, and
      the deployed bundle actually contains it — a local `npm run build` without
      the env var set should fail loudly rather than ship a broken Connect
      button.
- [ ] `Data Access` in the Cloud console lists both `drive.appdata` and
      `userinfo.email` under **non-sensitive**, not sensitive or restricted.
- [ ] No client secret exists anywhere in the repo, the built `dist/` bundle, or
      any commit — `git log -p` on the files touched by this feature, and a
      search of the production bundle for `GOCSPX-` (the secret's standard
      prefix).

### The write path behaves as designed

- [ ] Editing progress on device A, syncing, then syncing an **untouched**
      device B does not revert A's write. This is the dirty-check guard,
      verified concretely rather than trusted on faith.
- [ ] Editing on both A and B before either syncs, then syncing A followed by B,
      leaves B's snapshot as the final state in Drive, with no error and no
      alert — confirming the accepted trade-off in
      [Decisions taken](#decisions-taken) behaves as intended, not as an
      unnoticed bug.
- [ ] Killing the network mid-write leaves the previous Drive revision intact —
      a half-finished multipart upload does not corrupt the file.

### Auth actually degrades honestly

- [ ] After the access token is left to expire (or is force-cleared), the app
      re-authenticates silently with no visible prompt, while the browser still
      holds a live Google session.
- [ ] With the Google session itself signed out, the app shows "tap to
      reconnect" — never a silent no-op and never a thrown error in the console.
- [ ] Disconnecting revokes the token (`google.accounts.oauth2.revoke`) and the
      app falls back cleanly to local-only.
- [ ] The `AccountModal` shows the actual signed-in email, not just "connected" —
      and updates if the user reconnects with a different Google account.
- [ ] Dismissing the "Connect" prompt without ever authorising leaves the app
      fully functional on `?s=` links alone, and the prompt does not resurface.

### Triggers behave as designed

- [ ] The 2-minute timer does not run, or does not push, while the tab is
      backgrounded/hidden — confirm via the network panel, not assumption.
- [ ] Closing the tab (not just blurring it) still lands the last change in
      Drive — the `visibilitychange`/`keepalive` push, checked against the
      actual Drive revision afterward.
- [ ] The manual "Sync now" button reflects a real error (offline, revoked
      access, Drive quota) rather than a generic failure state.

### Cross-device (Chrome on macOS, Windows, Android)

- [ ] A full round trip on two genuinely different devices — not two tabs on
      one machine — with real added progress on each before the first sync.
- [ ] Covers Chrome on macOS, Windows and Android specifically — no other
      browser or platform is in scope, per
      [Decisions taken](#decisions-taken).

### Fallback preserved

- [ ] The `?s=` share link (see [Why](#why)) still works independently — Drive
      sync is additive, not a replacement that could strand a user with no
      Google account.

### Docs

- [ ] README gained the promised section; `storageKeys.ts` gained the note that
      its key names are now a wire format for the Drive file, not only for
      links.

## Possible future additions

Deliberately out of scope for the first version, kept here so the simplification
is a recorded decision rather than something later mistaken for an oversight.

- **Detect the two-device conflict.** Keep the `ETag` from the last read and send
  it as `If-Match` on update. Drive then rejects a write built on a revision it
  never saw, turning today's silent overwrite into a detectable event — surface
  it to the user, or auto-resolve with "most recent wins" if writes carry a
  timestamp. This is a small addition on top of the current design, not a
  rewrite, since the dirty check already tracks the last-synced state needed to
  know whether a conflict is even possible.
- **Per-record merge.** Replace whole-file last-write-wins with a union merge.
  Most of the synced state is a keyed record —
  `english_reading_practice_progress_v3`, `flashcards_status_*`, the exercise
  and module libraries — where union is the natural merge, needing no
  timestamps. This is the one that removes the need for "last sync wins" or a
  conflict alert entirely, at the cost of a real conflict rule for cases like
  the same word being `known` on one device and `unknown` on the other.

Worth revisiting if two devices end up being edited in genuine parallel often
enough for the current trade-off to actually bite; not worth building
speculatively before that happens.
