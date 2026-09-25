# Google account sync

The app can optionally back up progress to the user's own Google Drive. It remains a static GitHub Pages application: there is no application backend or database.

## Storage

The app stores one hidden `progress.json` file in Drive's `appDataFolder`. It contains the syncable `localStorage` key/value snapshot produced by `src/utils/sync/legacy/legacyStorage.ts`.

The file is not visible in the user's normal Drive UI. The `drive.appdata` scope limits the app to its own hidden data.

## Authentication

Google Identity Services issues a browser access token through `@react-oauth/google`. The app also requests `userinfo.email` so the connected account can be identified in the UI.

The token is stored locally and never included in the Drive snapshot. It normally lasts about one hour. A saved token is silently reissued once after a `401`; if that fails, the UI asks the user to reconnect.

## Current synchronization policy

The current implementation uses whole-file last-write-wins:

- **Connect** — read Drive and apply its snapshot when present; otherwise upload local state.
- **Boot with a saved token** — run the same pull-or-push flow before showing the app.
- **Every 30 seconds while visible** — upload only when the local snapshot differs from the last successful sync; hidden tabs skip interval ticks.
- **Page hidden** — attempt a final dirty push with `keepalive`.
- **Page visible again** — run an immediate silent dirty push.
- **Sync now** — run the dirty push immediately and show success or failure.

In the current legacy strategy, the timer and visibility paths are push-only; pulls happen only on connect and boot. After v2 activation, every approved trigger runs read → merge → write, and this document will be updated to describe only that strategy.

## Dirty check

`src/utils/sync/google/driveSync.ts` hashes the current payload and compares it with the hash recorded after the last successful pull or push. An unchanged device does not upload, preventing an idle stale tab from repeatedly overwriting another device.

This does not merge simultaneous edits made on two devices. The last dirty device to upload wins the whole file.

## Drive API calls

Requests use `Authorization: Bearer <access token>`.

| Purpose  | Request                                                           |
| -------- | ----------------------------------------------------------------- |
| Locate   | `GET /drive/v3/files?spaces=appDataFolder&q=name='progress.json'` |
| Download | `GET /drive/v3/files/{id}?alt=media`                              |
| Create   | `POST /upload/drive/v3/files?uploadType=multipart`                |
| Update   | `PATCH /upload/drive/v3/files/{id}?uploadType=media`              |

If duplicate files exist, the file with the newest `modifiedTime` is used. Older duplicates are left unchanged.

## Snapshot validation

The Drive boundary accepts a string-to-string object. `applySyncPayload()` writes only keys accepted by `isSyncableKey()`, preventing a Drive file from replacing device-local values such as the Google access token or installed system voices.

A malformed or unreadable Drive file is treated as missing, so the current local snapshot is uploaded.

## Rehydration

After a successful pull, `useRehydrateFromStorage()` reloads Redux state, locale, and colour scheme from local storage without refreshing the page.

## No-account behavior

Google connection is optional. Without it, all learning tools and local persistence continue working on that device.

## Google Cloud setup

1. Create a Google Cloud project; billing is not required.
2. Enable the Google Drive API.
3. Configure an external Google Auth application.
4. Add the `drive.appdata` and `userinfo.email` scopes.
5. Create a Web application OAuth client.
6. Add authorized JavaScript origins for the deployed GitHub Pages origin and local development origin.
7. Provide the public client ID as `VITE_GOOGLE_CLIENT_ID` during the build.

No client secret is used by the browser application.

## Testing

Unit and component tests mock Google Identity Services and `fetch`. They cover:

- connect/disconnect;
- existing-file pull and missing-file upload;
- boot restoration and one-time token reissue;
- dirty push behavior;
- timer, page-hide, and manual triggers;
- reconnect and notification behavior;
- device-local key exclusion.

A real two-device check is still required for Google infrastructure and browser-session behavior.
