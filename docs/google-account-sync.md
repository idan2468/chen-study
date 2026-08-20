# Plan: sync progress through the user's own Google account

**Status: proposal, nothing implemented.**

## Why

`?s=` share links aren't real sync: the link grows with the exercise library
(already ~2,600 characters gzipped for a 5 KB snapshot), importing **replaces**
the receiving device's storage, and every handoff is a manual copy-paste.

Goal: progress follows the learner across devices, with no backend and no
database — the app stays a static bundle on GitHub Pages.

## Decisions taken

| Decision                  | Choice                                                                                                           |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Storage location          | `drive.appdata` — hidden app-data folder, not user-editable                                                      |
| Merge strategy            | whole-file last-write-wins, guarded only by a dirty check (below)                                                |
| Sync triggers             | manual "Sync now", a 2-minute timer, and on page hide                                                            |
| No-account usage          | fully usable without one — local-only storage plus `?s=` links; "Connect" can be dismissed for good              |
| Connected-account display | show the signed-in email, via an added `userinfo.email` scope                                                    |
| Device preferences        | dark mode, dyslexia font and speech rate keep syncing; only `english_system_voice` stays local                   |
| Client ID storage         | `VITE_GOOGLE_CLIENT_ID` env var, injected at build time by the GitHub Pages workflow                             |
| Browser/platform support  | Chrome only, on macOS, Windows and Android                                                                       |
| Two-device conflicts      | not detected — whichever syncs second silently wins; see [Possible future additions](#possible-future-additions) |

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

Instead: an access token lasting ~1 hour, silently renewed via
`requestAccessToken({ prompt: '' })` while the browser holds a live Google
session. If that fails (session gone, popup blocked), the UI shows "tap to
reconnect" rather than pretending to have synced — why the plan pairs the
2-minute timer with a manual button.

## Design sketch

`buildSyncPayload()` / `applySyncPayload()` in `src/utils/syncUrl.ts` already
produce the exact snapshot this needs; the Drive file is that same object, so
links and Drive sync can't drift apart.

### Modules to add

Google-specific modules live under `src/utils/google/`, not the flat
`src/utils/`, so they don't pile up alongside unrelated helpers
(`voices.ts`, `speech.ts`, ...). Each pairs a plain module (state/API calls,
no React) with a hook that wires it into the UI — same split as
`googleAuth.ts` / `useGoogleConnect.ts` already in place.

| Path                             | Responsibility                                                                             |
| -------------------------------- | ------------------------------------------------------------------------------------------ |
| `@react-oauth/google`            | the token client: GIS script load, `useGoogleLogin()` hook, popup/consent handling         |
| `src/utils/google/googleAuth.ts` | what the library doesn't cover -- hold the access token in memory, `fetchConnectedEmail()` |
| `src/hooks/useGoogleConnect.ts`  | wires `googleAuth.ts` + `useGoogleLogin()` into connect/disconnect state for the UI        |
| `src/utils/google/driveStore.ts` | `readSnapshot()` / `writeSnapshot()` against the Drive REST API                            |
| `src/utils/google/driveSync.ts`  | the policy: dirty check, last-synced state                                                 |
| `src/hooks/useDriveSync.ts`      | the triggers -- 2-minute timer, page-hide, manual button -- calling into `driveSync.ts`    |
| `src/components/AccountModal/`   | connect/disconnect, connected email, last-synced time, "Sync now"                          |

`syncUrl.ts` is unchanged — the link stays as the no-account fallback.

### Drive REST calls

All requests carry `Authorization: Bearer <token>`; a `401` means re-request
the token and retry once.

| Purpose  | Request                                                                                          |
| -------- | ------------------------------------------------------------------------------------------------ |
| Locate   | `GET /drive/v3/files?spaces=appDataFolder&q=name='progress.json'&fields=files(id,modifiedTime)`  |
| Download | `GET /drive/v3/files/{id}?alt=media`                                                             |
| Create   | `POST /upload/drive/v3/files?uploadType=multipart`, metadata `{name, parents:["appDataFolder"]}` |
| Update   | `PATCH /upload/drive/v3/files/{id}?uploadType=media`                                             |

### The dirty check

Whole-file LWW plus a 2-minute timer is unsafe on its own: an idle device
(e.g. an iPad left open elsewhere) would otherwise re-upload its stale
snapshot and clobber a device that's actively being used. Fix: hash the local
snapshot and compare to the hash from the last successful sync — unchanged
means the timer is a no-op. This does not cover two devices genuinely edited
before either synced; that's an accepted trade-off (see
[Decisions taken](#decisions-taken)).

### Trigger mechanics

| Trigger          | Mechanism                     | Caveat                                                                                                |
| ---------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------- |
| "Sync now"       | button                        | always available; the only path guaranteed to carry a user gesture                                    |
| Every 2 minutes  | `setInterval`                 | after ~1 h the silent token re-issue can be popup-blocked — must degrade to "tap to reconnect"        |
| Leaving the page | `visibilitychange` → `hidden` | not `beforeunload`; `fetch(…, { keepalive: true })` survives unload and can still set `Authorization` |

## Rollout

1. **Google Cloud setup** — no code; see [above](#setting-it-up-by-hand).
2. **`googleAuth.ts` + Connect button** — prove a token can be obtained, no
   Drive calls yet.
3. **`driveStore.ts`** — push/pull the snapshot, overwriting local storage
   exactly as an imported link does today.
4. **`driveSync.ts`** — add the dirty check. Deserves the most test attention.
5. **Triggers and reconnect UI** — button, timer, page-hide push, "tap to
   reconnect" state.
6. **Docs** — README section, note in `storageKeys.ts` that its keys are now a
   wire format for the Drive file too.

Steps 2–5 are each independently shippable, suited to committing one at a
time.

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
- [ ] Editing on device A, syncing, then syncing an **untouched** device B
      does not revert A's write (the dirty-check guard, verified concretely).
- [ ] Editing on both A and B before either syncs, then syncing A then B,
      leaves B's snapshot as final — no error, no alert, as designed.
- [ ] Killing the network mid-write leaves the previous Drive revision intact.
- [ ] Expired token re-authenticates silently while a Google session is live;
      with no session, the app shows "tap to reconnect", never a silent no-op.
- [ ] Disconnecting clears the local token (no Google-side revoke) and falls
      back cleanly to local-only.
- [ ] `AccountModal` shows the actual signed-in email and updates if the user
      connects with a different account — Google's account chooser shows on
      every connect by default, so switching needs no revoke step.
- [ ] Dismissing "Connect" without ever authorising leaves `?s=` links fully
      functional, and the prompt doesn't resurface.
- [ ] The 2-minute timer doesn't push while the tab is hidden (network panel,
      not assumption); closing the tab still lands the last change in Drive.
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
