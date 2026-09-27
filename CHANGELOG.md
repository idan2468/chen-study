# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-09-27

### Added

- Add Israel ISO timestamp helpers
- Add VersionedValue type
- Add versioned-value deletion helper (Step 5)
- Add versioning Zod primitives (Step 5)
- Add versioned-array helpers (Step 6)
- Add module pronunciation recording design doc
- Add newest-wins merge helpers for versioned arrays (Step 8)
- Add the pure PersistedState merge engine (Step 8)
- Test that winning navigation keeps the merged exercises (Step 8)
- Add the Drive progress-v2.json transport (Step 9)
- Add the uninvoked v2 migration coordinator (Step 10)
- Test two devices syncing through a fake Drive (Step 11)

### Changed

- Replace imports with matching IDs
- Clarify final-occurrence reduction
- Simplify final-value reduction
- Centralize legacy sync storage
- Organize project documentation
- Pause interval sync while hidden
- Store module progress as semantic records
- Store unseen progress in exercise records
- Use luxon for Israel timestamps
- Prefer libraries over hand-rolled utils in plan
- Prefix commits with their step number (Step 5)
- Record approved step definitions (Step 6)
- Version Unseen exercises and progress (Step 6)
- Version Modules and their progress (Step 6)
- Version preferences and navigation (Step 6)
- Scope fake timers in module tests (Step 6)
- Name the payload-less timestamp prepare (Step 6)
- Share the word matcher across slices (Step 6)
- Validate timestamps as plain ISO datetimes (Step 6)
- Keep Step 6 decisions in the process doc (Step 6)
- Always record decisions in the process doc (Step 6)
- Define and store the SyncDocumentV2 envelope (Step 7)
- Write the v2 document through on every change (Step 7)
- Move SpeechLang to types to break an import cycle (Step 7)
- Note that steps are verification checkpoints until Step 11 (Step 7)
- Rename the sync document to PersistedState (Step 7.5)
- Name every persisted-state object schema (Step 7.5)
- Name section schemas after their envelope keys (Step 7.5)
- Compare Israel timestamps by instant (Step 8)
- Name section mergers apart from the slice's mergeModules (Step 8)
- Name the per-exercise resolver mergeExercise (Step 8)
- Name the newer-than check isNewer (Step 8)
- Stop shadowing the global document in merge tests (Step 8)
- Rename Israel timestamp helpers to generic timestamps (Step 8)
- Name the localStorage pair readLocal/writeLocalPersistedState (Step 9)
- Extract shared Drive file operations from the legacy store (Step 9)
- Branch the Drive write on the read status (Step 9)
- Name invalid-file backups from one base with a .bck suffix (Step 9)
- List the legacy data keys that migration cleans up (Step 10)
- Share the checkpoint-or-convert step between both paths (Step 10)
- Use the exported marker key in migration tests (Step 10)
- Document the arguments of non-trivial sync functions (Step 10)
- Rename putValue to upsertValue (Step 10)
- Rename deleteValue to tombstoneValue (Step 10)
- Rename setVersionedValue to setValueIfChanged (Step 10)
- Rename downloadFileText to downloadFileContent (Step 10)
- Rename keepFinalOccurrencesBy to keepLastBy (Step 10)
- Hydrate slices from local v2, falling back to legacy keys (Step 11)
- Reload every slice from storage in one action (Step 11)
- Write only the persisted state and system voices through (Step 11)
- Route every sync trigger through the v2 merge (Step 11)
- Extract helpers from the Step 11 hydration and sync code (Step 11)
- Share the test locale setup through a helper (Step 11)
- Group the sync hooks under src/hooks/sync/ (Step 11)
- Share one in-flight sync between overlapping triggers (Step 11)
- Record the legacy-removal audit for Step 12 (Step 11.5)

### Removed

- Remove link-based progress sync
- Remove obsolete data extractor
- Remove unused timestamp comparison
- Drop the migration test's fixture-only merge assertion (Step 10)

### Fixed

- Correct the test-file count in the audit (Step 11.5)

## [1.0.0] - 2026-09-14

### Added

- Add index file
- Allow adding multiple tabs at once and also add full course.
- Add template of react + RTK
- Add project
- Add practice mode for missed words across all modules
- Show a completion banner when a module's cards are all marked
- Add GitHub Pages deployment workflow
- Add component testing plan
- Add plan for tests in docs
- Add components tests
- Add extra tests and update readme
- Add ltr
- Add comment-style rule for Cursor and Claude Code
- Add Google Connect button proving end-to-end token acquisition
- Add rules
- Add Drive REST wrapper with shared auth helpers and schema-validated payloads
- Add a rule to reconsider file-tree organization when adding files
- Add the in-place rehydrate mechanism for Drive pulls
- Add regression coverage for App/TopBar's context wiring
- Add driveSync.ts dirty check, source the Drive token from storage
- Add reissueForSync for mid-session 401s, distinct from boot re-issue
- Add useDriveSync.ts: 30s timer, page-hide push, manual sync, reconnect
- Add a syncing state and success toast to useDriveSync
- Add a Settings menu to the TopBar, and Tabler icons for its buttons
- Add a rule: check library testing docs before hand-debugging
- Add a constants folder for icon size, routes, and flashcard timing
- Add shared mobile breakpoint hook, use it in TopBar
- Show a copyable debug-info modal for JSON import shape errors
- Support importing multiple unseen exercises at once
- Add AppModal/AppDrawer wrappers for the gapMode:padding fix
- Add read-aloud for module rules
- Add exercise completion tracking
- Add synced Unseen answer shuffling

### Changed

- Initial commit
- Few updates to the modules.
- Extract confirmDanger/notifyCannotDelete helper
- Move listen button to back
- Move listen button to back
- Move inline styling to CSS Modules
- Use a real close icon for tab delete, styled red with a hover highlight
- Move home button first in the top bar and use a cleaner icon
- Change delete button to mantine
- Stop tracking old/ (legacy HTML reference files)
- Stop tracking old/ (legacy HTML reference files)
- Note Step 12's deploy-workflow outcome in the plan doc
- Change to node version 24
- Pin the public npm registry so CI doesn't try our internal Nexus mirror
- Pin Node version via .nvmrc, single source of truth for CI
- Bump vitest, jsdom, @testing-library/jest-dom, globals to latest majors
- Bump vite + @vitejs/plugin-react to v8/v6 (Rolldown pipeline)
- Bump eslint-plugin-react-hooks to v7, fix the new rule findings
- Bump typescript to 6.0.3 and @types/node to ^24, matching .nvmrc
- Chore: add pre-commit hook to prevent debug files
- Voices: rank Windows Natural voices and Android network TTS higher
- Unseen: auto-advance to next flashcard after marking known/unknown
- Docs: audit Redux state that isn't persisted to localStorage
- Update persistence gaps
- Unseen: persist quiz answers across reload
- Unseen+modules: persist flashcard/module deck position across reload
- Modules: persist current module id, fix stale preferred-default id
- Chore: trim verbose inline comments in persistence code
- Docs: trim/remove non-essential comments per new comment-style rules
- Sync: gzip the share link instead of double-encoding it
- Docs: plan Google-account sync with no backend of our own
- Docs: settle Google-sync decisions and add Cloud setup steps
- Docs: explain why no refresh token, move open questions up
- Docs: add a definition of done for the Google-sync plan
- Update doc
- Trim doc
- Simplify Google disconnect and group Google modules under utils/google/
- Persist the Google access token so a reload stays connected.
- Extract buildSyncPayload/applySyncPayload out of syncUrl.ts
- Reorganize src/utils into speech/ and sync/ domain folders
- Update plan
- Rename readInitialState to loadFromStorage and expand hydration tests
- Refactor useRehydrateFromStorage to simplify callback structure
- Sync Mantine's direction context in useRehydrateFromStorage
- Replace Hebrew placeholders in test fixtures and comments with English
- Pull-or-push a Drive snapshot on Connect
- Check off Rollout step 3, split boot-time restore into its own step
- Wire boot-time Drive restore with silent 401 re-issue
- Gate boot on a Drive restore spinner, share connect state via context
- Sync design doc: check off boot-time restore, refresh the 401 section
- Sync design doc: check off Rollout step 5, point Next up at step 6
- Rename the ?s= link button to avoid clashing with Google sync now
- Thread keepalive through the Drive push path for page-hide syncs
- Wire Drive sync triggers into the TopBar
- Document the Google Drive sync feature
- Give the Sync now button a spinning icon and a visible label
- Clean up Mantine notification queue between tests
- Bump TopBar icon sizes for visibility
- Give the Unseen exercise picker its own centered, wider row
- Replace remaining emoji-as-icon buttons with Tabler icons
- Trim verbose comments down to one or two sentences
- Pass VITE_GOOGLE_CLIENT_ID into the GitHub Pages build
- Redesign mobile TopBar as a hamburger + Drawer, split into TopBarDesktop/TopBarMobile
- Squashed commit of the following:
- Set a 360px layout floor and support notched phones
- Tighten Hub/Unseen/Modules chrome for narrow screens
- Scale flashcards and their controls for narrow screens
- Raise touch targets and retarget copy for mobile
- Validate module/exercise JSON imports with zod schemas
- Rename Exercise/PracticeModule to UnseenExercise/ModuleExercise
- Finish renaming default data files to match the type rename
- Load built-in module content from resources/ JSON instead of inlining it
- Update gitignore
- Force LTR direction on the import debug info text
- Move the JSON import result alert above the textarea
- Ignore .playwright-mcp/ browser-testing artifacts
- Rename type files to match ModuleExercise/UnseenExercise types
- Move Google connect/reconnect into mobile top row
- Split speech voice and rate settings by language
- Convert CardStatus and FlipCardStatus to one enum
- Trim verbose comments per comment-style rules

### Removed

- Remove agentbridge config
- Remove relative imports
- Remove relative imports
- Drop the retired Modules-page dyslexia key
- Drop legacy-key cleanup for now

### Fixed

- Fix renderWithProviders crashing on Mantine colour-scheme hooks
- Fix createSnapshot to send multipart/related, not multipart/form-data
- Fix Mantine Popover/Modal test rendering in jsdom
- Fix a stuck boot spinner when a silent re-issue popup is blocked
- Fix stale file-path references left by the speech/sync reorg
- Fix applySyncPayload accepting any key from untrusted input
- Fix connectedEmail lingering after a failed boot re-issue
- Fix TopBar buttons on mobile: centered icons, move Readable font
- Fix 15px horizontal overflow when a Modal/Drawer opens on mobile
- Fix mobile overflow without breaking modal scroll lock
- Fix horizontal scroll caused by RTL scrollbar gutter
- Fix RTL horizontal drift on the Notifications portal
