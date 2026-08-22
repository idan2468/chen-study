# Plan: sync progress through the user's own Google account

**Status: in progress — see [Rollout](#rollout) for what's done.**

## Why

`?s=` share links aren't real sync: the link grows with the exercise library
(already ~2,600 characters gzipped for a 5 KB snapshot), importing **replaces**
the receiving device's storage, and every handoff is a manual copy-paste.

Goal: progress follows the learner across devices, with no backend and no
database — the app stays a static bundle on GitHub Pages.

## Decisions taken

| Decision                    | Choice                                                                                                                             |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Storage location            | `drive.appdata` — hidden app-data folder, not user-editable                                                                        |
| Merge strategy              | whole-file last-write-wins, guarded only by a dirty check (below)                                                                  |
| Sync triggers               | manual "Sync now", a 30-second timer, and on page hide                                                                             |
| No-account usage            | fully usable without one — local-only storage plus `?s=` links; "Connect" can be dismissed for good                                |
| Connected-account display   | show the signed-in email, via an added `userinfo.email` scope                                                                      |
| Device preferences          | dark mode, dyslexia font and speech rate keep syncing; only `english_system_voice` stays local                                     |
| Client ID storage           | `VITE_GOOGLE_CLIENT_ID` env var, injected at build time by the GitHub Pages workflow                                               |
| Browser/platform support    | Chrome only, on macOS, Windows and Android                                                                                         |
| Two-device conflicts        | not detected — whichever syncs second silently wins; see [Possible future additions](#possible-future-additions)                   |
| First connect               | if Drive already has `progress.json`, pull it (same overwrite as a `?s=` import); if not, push local                               |
| Step-3 trigger              | Connect itself runs that first pull-or-push — no extra Sync button until [Rollout](#rollout) step 5                                |
| Unreadable Drive file       | treat as missing — push local over it                                                                                              |
| Duplicate `progress.json`   | the one with the newest `modifiedTime` is the snapshot; extras are left alone                                                      |
| After a pull                | re-read localStorage into the running app (store, locale, colour scheme) — no page reload                                          |
| Access token                | `localStorage` — survives tab close and a second tab; Disconnect clears it. Key is device-local (never in `?s=` / Drive snapshots) |
| Boot with a saved token     | same pull-or-push as Connect, but _after_ mount, reusing `useGoogleConnect`'s existing restore effect — silent re-issue needs `@react-oauth/google`'s React context, so it can't run before `createRoot().render()` |
| `?s=` link plus saved token | share link wins this load — import it and skip the Drive pull; the next sync pushes that snapshot up                               |
| Expired token at boot       | silent GIS re-issue (`prompt: ''`); stay connected if a Google session is live, otherwise clear the token and show **Connect**     |

## Why a Google Cloud project is still needed

Google won't issue an access token to an anonymous caller — the OAuth client
identifies _this app_. Same arrangement as WhatsApp's Drive backup: data lives
in the user's Drive, but WhatsApp itself is a registered OAuth client. The
project stores no data and costs nothing.

### Setting it up by hand

Everything lives under **APIs & Services → Google Auth Platform** (Branding,
Audience, Clients, Data Access tabs) — the old "OAuth consent screen" page is
gone.

1. **Create a project** at <https://console.cloud.google.com> (no billing
   needed).
2. **Enable the Drive API** (**APIs & Services → Library**) — skip this and
   every Drive call 403s even with a good token.
3. **Register the app** (**Google Auth Platform → Get started**): app name,
   support email, Audience = **External**, accept the data policy.
4. **Declare scopes** (**Data Access**): `drive.appdata` and
   `userinfo.email`. Confirm both land under **non-sensitive**.
5. **Create an OAuth client** (**Clients → Create client → Web application**).
   Authorized JavaScript origins: `https://idan2468.github.io` and
   `http://localhost:5173` (origin only, no path). Leave redirect URIs empty —
   this flow returns the token to the page itself.
6. **Copy the client ID** into `VITE_GOOGLE_CLIENT_ID`. It's public either way
   (ships in the bundle), but note `idan2468.github.io` is a shared origin
   across every project published there. Ignore the client **secret** — never
   used, never committed.
7. **Publishing mode**: Testing (capped at 100 listed accounts, but the usual
   7-day refresh-token expiry doesn't apply since this flow never issues one)
   is a fine permanent state for a family app; Production works too once
   verified on a real device.

### Why there is no refresh token

Only the Authorization Code flow issues one; the token client this plan uses
(`initTokenClient`) never does. Getting a refresh token requires POSTing the
auth code to `oauth2.googleapis.com/token` and reading the response — but that
endpoint sends no CORS headers, so the response is unreachable from
client-side code. There's no client-type workaround for this; only a
server can read that response, which is the backend this plan avoids.

Instead: an access token lasting ~1 hour, persisted in `localStorage` and
silently renewed via `requestAccessToken({ prompt: '' })` while the browser
holds a live Google session — including at boot, once the app has mounted
(the same `useGoogleConnect` effect Connect uses, since silent re-issue needs
`@react-oauth/google`'s React context). If that fails (session gone, popup
blocked), boot clears the token and shows **Connect**; a mid-session timer
failure shows "tap to reconnect" rather than pretending to have synced.

## Design sketch

`buildSyncPayload()` / `applySyncPayload()` in `src/utils/sync/syncPayload.ts` --
split out of `syncUrl.ts` since Drive sync needs the snapshot but nothing
URL-specific -- already produce the exact snapshot this needs; the Drive file
is that same object, so
links and Drive sync can't drift apart. Connect is the first I/O: locate
`progress.json` (newest `modifiedTime` if several exist), pull-and-apply if
the body is a valid snapshot, otherwise push local over it (see
[Decisions taken](#decisions-taken)). A pull applies the snapshot to
localStorage, then calls `useRehydrateFromStorage()` to reset the running
store, i18n locale and colour scheme in place — no navigation, no reload.
The same pull-or-push also runs at boot when `localStorage` already has a
token, via `useGoogleConnect`'s existing restore effect -- after mount, not
before `makeStore()`, since a silent GIS re-issue needs
`@react-oauth/google`'s React context. A 401 there first tries that silent
re-issue; if it fails, clear the token and fall back to **Connect** rather
than retrying Drive with a dead token. A `?s=` import on that same load wins:
skip the Drive pull and let the next sync push the imported snapshot.

### Modules to add

Google-specific modules live under `src/utils/sync/google/` -- `sync/` groups
everything for the "get progress onto another device" feature (`storageKeys.ts`,
`syncPayload.ts`, `syncUrl.ts`, and this `google/` subfolder), separate from
unrelated helpers like `speech/`. Each pairs a plain module (state/API calls,
no React) with a hook that wires it into the UI — same split as
`googleAuth.ts` / `useGoogleConnect.ts` already in place.

| Path                             | Responsibility                                                                                     |
| -------------------------------- | -------------------------------------------------------------------------------------------------- |
| `@react-oauth/google`            | the token client: GIS script load, `useGoogleLogin()` hook, popup/consent handling                 |
| `src/utils/sync/google/googleAuth.ts` | what the library doesn't cover -- hold the access token in `localStorage`, `fetchConnectedEmail()` |
| `src/hooks/useGoogleConnect.ts`  | wires `googleAuth.ts` + `useGoogleLogin()` into connect/disconnect state for the UI                |
| `src/utils/sync/google/driveStore.ts` | `readSnapshot()` / `writeSnapshot()` against the Drive REST API                                    |
| `src/utils/sync/google/driveSync.ts` | the policy: dirty check, last-synced state                                                         |
| `src/hooks/useDriveSync.ts`      | the triggers -- 30-second timer, page-hide, manual button -- calling into `driveSync.ts`           |
| `src/components/AccountModal/`   | connect/disconnect, connected email, last-synced time, "Sync now"                                  |

`syncUrl.ts` itself is unchanged beyond that split — the link stays as the
no-account fallback.

### Drive REST calls

All requests carry `Authorization: Bearer <token>`; a `401` means re-request
the token and retry once. Not yet implemented anywhere -- lands with the
boot-restore commit, since that's the realistic case (a token saved a while
ago that's since expired). Connect itself doesn't get this treatment: its
token was just minted by the GIS popup, so an immediate 401 there points to
something other than plain expiry, and today just surfaces the generic
connect-error toast (see `useGoogleConnect.test.tsx`).

A **general retry/backoff for transient failures** (network blips, a 500,
timeout) is a separate, not-yet-scoped concern -- there's currently none at
all; a failed sync just shows the error toast and the user retries manually.
Revisit scope (which module owns it, backoff strategy, max attempts) when it
comes up.

| Purpose  | Request                                                                                          |
| -------- | ------------------------------------------------------------------------------------------------ |
| Locate   | `GET /drive/v3/files?spaces=appDataFolder&q=name='progress.json'&fields=files(id,modifiedTime)`  |
| Download | `GET /drive/v3/files/{id}?alt=media`                                                             |
| Create   | `POST /upload/drive/v3/files?uploadType=multipart`, metadata `{name, parents:["appDataFolder"]}` |
| Update   | `PATCH /upload/drive/v3/files/{id}?uploadType=media`                                             |

### The dirty check

Whole-file LWW plus a timer is unsafe on its own: an idle device (e.g. an
iPad left open elsewhere) would otherwise re-upload its stale snapshot and
clobber a device that's actively being used. Fix: hash the local snapshot and
compare to the hash from the last successful sync — unchanged means the timer
is a no-op. This is also what makes a 30-second interval cheap: an idle
device never actually calls Drive, it only re-hashes localStorage. This does
not cover two devices genuinely edited before either synced; that's an
accepted trade-off (see [Decisions taken](#decisions-taken)).

### Trigger mechanics

| Trigger          | Mechanism                     | Caveat                                                                                                |
| ---------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------- |
| "Sync now"       | button                        | always available; the only path guaranteed to carry a user gesture                                    |
| Every 30 seconds | `setInterval`                 | after ~1 h the silent token re-issue can be popup-blocked — must degrade to "tap to reconnect"        |
| Leaving the page | `visibilitychange` → `hidden` | not `beforeunload`; `fetch(…, { keepalive: true })` survives unload and can still set `Authorization` |

All three triggers only push (`writeSnapshot()`); a pull only ever happens at
Connect and at boot. So the timer can't make another device see changes any
sooner -- that's already handled immediately by page-hide/manual sync on the
writing device. Its only job is bounding how much progress a crash or killed
tab could lose on a long-lived, never-hidden tab, which is why 30 seconds is
already generous rather than tight -- no need to go lower.

## Rollout

Steps 2–5 are each independently shippable, suited to committing one at a
time.

- [x] 1. **Google Cloud setup** — no code; see [above](#setting-it-up-by-hand).
      Project created, client ID is in `.env.local`.
- [x] 2. **`googleAuth.ts` + Connect button** — prove a token can be obtained,
      no Drive calls yet. Connect/disconnect works end to end.
- [ ] 3. **`driveStore.ts`** — on Connect, pull if Drive has `progress.json`
      (overwrite local as a `?s=` import does), else push local. **Next up.**
- [ ] 4. **`driveSync.ts`** — add the dirty check. Deserves the most test
      attention.
- [ ] 5. **Triggers and reconnect UI** — button, timer, page-hide push, "tap
      to reconnect" state.
- [ ] 6. **Docs** — README section, note in `storageKeys.ts` that its keys are
      now a wire format for the Drive file too.

## Testing

Fake the auth/Drive `fetch` boundary rather than testing it deeply; real
coverage belongs in `driveSync.ts`'s decision logic — an idle device's timer
must be provably a no-op, not just observed to behave. Still needs one real
two-device check by hand, including progress made on both sides before either
syncs.

## Definition of done

Standard checks (tests, lint, format, typecheck) cover the code; these need
verifying by hand once real Google infrastructure is involved:

- [ ] Client ID authenticates only from `https://idan2468.github.io/chen-study/`
      and `http://localhost:5173`.
- [ ] GitHub Pages workflow passes `VITE_GOOGLE_CLIENT_ID` at build time; a
      local build without it set simply doesn't render the Connect control,
      rather than shipping a broken one.
- [ ] `Data Access` lists both `drive.appdata` and `userinfo.email` as
      **non-sensitive**.
- [ ] No client secret anywhere in the repo, `dist/`, or history (search for
      `GOCSPX-`).
- [ ] Connecting with no Drive file uploads local `progress.json` and leaves
      on-screen state unchanged.
- [ ] Connecting when Drive already has a file applies that snapshot to
      localStorage the same way a `?s=` import does — including wiping any
      unsynced local work from before the reconnect — and the on-screen
      progress, theme and language update without a page reload.
- [ ] An unreadable Drive file (empty, not JSON, or not a string-to-string
      map) is overwritten by a local push, same as a missing file.
- [ ] Two `progress.json` files in app-data: the newer `modifiedTime` is the
      one pulled; the older file is left in place.
- [ ] Editing on device A, syncing, then syncing an **untouched** device B
      does not revert A's write (the dirty-check guard, verified concretely).
- [ ] Editing on both A and B before either syncs, then syncing A then B,
      leaves B's snapshot as final — no error, no alert, as designed.
- [ ] Killing the network mid-write leaves the previous Drive revision intact.
- [ ] Coming back after the ~1 h token life, with Chrome still signed into
      Google, stays connected — no Connect tap. With no Google session, the
      token is cleared and **Connect** is shown.
- [ ] Reopening the app with a still-valid token runs pull-or-push before the
      UI hydrates, then shows already-connected — including a second tab.
- [ ] Opening a `?s=` link while a token is stored imports the link and skips
      the Drive pull; the next sync uploads that imported snapshot.
- [ ] Disconnecting clears the localStorage token (no Google-side revoke) and
      falls back cleanly to local-only. The token key never appears in a `?s=`
      payload or the Drive file.
- [ ] `AccountModal` shows the actual signed-in email and updates if the user
      connects with a different account — Google's account chooser shows on
      every connect by default, so switching needs no revoke step.
- [ ] Dismissing "Connect" without ever authorising leaves `?s=` links fully
      functional, and the prompt doesn't resurface.
- [ ] The 30-second timer doesn't push while the tab is hidden (network panel,
      not assumption); closing the tab still lands the last change in Drive.
- [ ] A mid-session token expiry degrades to "tap to reconnect", never a
      silent no-op.
- [ ] "Sync now" surfaces real errors (offline, revoked access, quota), not a
      generic failure.
- [ ] A full round trip on two genuinely different devices (Chrome on macOS,
      Windows, Android), with real progress added on each before first sync.
- [ ] The `?s=` share link still works independently of Drive sync.
- [ ] README gained the promised section; `storageKeys.ts` notes its keys are
      now a wire format for the Drive file too.

## Possible future additions

Deliberately out of scope for v1:

- **Detect two-device conflicts** — keep the `ETag` from the last read, send
  as `If-Match` on update, surface the rejection instead of silently
  overwriting.
- **Per-record merge** — replace whole-file LWW with a union merge over the
  keyed records (`flashcards_status_*`, etc.), removing the need for
  "last sync wins" at the cost of a real conflict rule per record.

Worth revisiting only if two devices end up edited in genuine parallel often
enough for the current trade-off to actually bite.
