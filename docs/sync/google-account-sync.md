# Google account sync

The app can optionally back up progress to the user's own Google Drive. It remains a static GitHub Pages application: there is no application backend or database.

## Storage

Progress lives in one persisted-state document (`src/types/schemas/persistedState.ts`): Unseen exercises with their answers, highlights, and flashcard marks; Modules with their global word progress; the synced preferences (readable font, answer shuffling, speech rate per language); and where each page was left. Every entry carries an `updatedAt` timestamp, and deleted entities stay as tombstones.

- **On the device** it is stored under the `english_progress_v2` localStorage key, written on every change. A document that fails validation is kept under `english_progress_v2_rejected` before the app falls back to the defaults. A first run saves the defaults straight away.
- **In Drive** it is the hidden `progress-v2.json` file in the app's `appDataFolder`. The `drive.appdata` scope limits the app to its own hidden data, which is not visible in the user's normal Drive UI.

Some settings stay on the device and are never synced (`src/store/deviceStorageKeys.ts`): dark mode, interface language, the chosen system voice per language, and the Google access token.

## Authentication

Google Identity Services issues a browser access token through `@react-oauth/google`. The app also requests `userinfo.email` so the connected account can be identified in the UI.

The token is stored locally and never included in the Drive file. It normally lasts about one hour. A saved token is silently reissued once after a `401`; if that fails, the UI asks the user to reconnect. A failed connect shows an error with copyable debug details (never the token).

## Synchronization

Every trigger runs the same sync (`src/utils/sync/google/driveSync.ts`):

1. Read `progress-v2.json` from Drive.
2. Merge it with the running app's state: for each entry, the newer `updatedAt` wins, and Drive wins ties. The full merge rules are in [google-merge-sync-plan.md](./google-merge-sync-plan.md).
3. If the merge changed anything, save it locally and reload the store from it, without a page reload.
4. Upload the merge, skipped when Drive already holds the same state.

The merge and local apply run right after the read, so edits made while the upload is in flight are kept and go out with the next sync. A sync started while another is running shares that run.

Triggers:

- **Connect**, and **boot with a saved token**, behind a full-page spinner.
- **Every 30 seconds while the tab is visible**; hidden tabs skip it.
- **Returning to the tab.**
- **Sync now**, which shows a success or failure message.

Background syncs fail silently; after a failed silent reissue they stop until the user reconnects.

Two devices syncing at the same moment can overwrite each other's upload. The overwritten device still has its edits locally, so its next sync merges them back in. This is the accepted limitation of a single shared file.

## Drive API calls

Requests use `Authorization: Bearer <access token>`.

| Purpose  | Request                                                                    |
| -------- | -------------------------------------------------------------------------- |
| Locate   | `GET /drive/v3/files?spaces=appDataFolder&q=name='progress-v2.json'`       |
| Download | `GET /drive/v3/files/{id}?alt=media`                                       |
| Create   | `POST /upload/drive/v3/files?uploadType=multipart`                         |
| Update   | `PATCH /upload/drive/v3/files/{id}?uploadType=media`                       |
| Rename   | `PATCH /drive/v3/files/{id}` (metadata only, to set an invalid file aside) |

If duplicate files exist, the file with the newest `modifiedTime` is used. Older duplicates are left unchanged.

## Validation

Both copies are validated with the same Zod schema. A Drive file that isn't valid JSON or fails the schema is never overwritten: it is renamed to `progress-v2.invalid-<timestamp>.json.bck`, and a fresh `progress-v2.json` is created from the local state.

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

Unit and component tests mock Google Identity Services and `fetch`. They cover connect and disconnect, boot restore and the one-time token reissue, each trigger, merging and uploading, skipped uploads, invalid-file backups, and reconnect and notification behavior.

`src/utils/sync/google/driveSync.integration.test.ts` runs two devices through a fake Drive (`test/fakeDrive.ts`) with the real transport and merge. A real two-device check is still needed for Google infrastructure and browser-session behavior.
