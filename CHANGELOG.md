# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - 2026-09-28

### Changed

- Your exercises and modules load exactly as you saved them: built-in ones are only added when you start fresh, and are no longer re-added or moved back to their original order.
- If the exercise or module you had open was deleted on another device, the first one still available opens instead, at its first card.
- A saved speech rate that's out of range resets to the default instead of the nearest limit.

### Added

- If this device's saved progress can't be read, it's kept as a backup instead of being overwritten.

### Fixed

- Filtering to missed words no longer says "Well done! No cards left to show." while missed words remain; you land on the last remaining card.
- A vocabulary deck that got shorter, for example after importing a new version of the exercise, no longer shows "This exercise has no vocabulary cards."

## [2.0.0] - 2026-09-27

### Added

- Progress from several devices is now combined: each answer, highlight, card mark, and setting keeps its most recent change, instead of the last device to sync replacing everything.
- Changes from your other devices appear on their own: when you connect, open the app, return to the tab, every 30 seconds while it's open, or with **Sync now**.

### Changed

- Your existing progress carries over automatically the first time you open this version; if that is interrupted, it finishes next time.
- A deleted exercise or module stays deleted on all your devices, unless you import it again.
- Importing an exercise or module that already exists replaces it and starts its progress over.
- If the Drive backup is ever damaged, it is set aside instead of being overwritten, so nothing is lost.

### Removed

- Sharing progress through a link; use Google Drive sync instead.
- Syncing while the tab is hidden or closing; it now syncs when you come back.

## [1.0.0] - 2026-09-14

### Added

- Unseen reading practice: passages with text-to-speech, word highlighting, multiple-choice questions with optional answer shuffling, and vocabulary flashcards.
- Module flashcards with per-word progress, missed-word review across modules, and a completion banner.
- JSON import for custom exercises and modules, validated with a copyable error report.
- Hebrew and English UI with RTL support, dark mode, a readable font, and per-language voice and speech-rate settings.
- Optional Google Drive backup of all progress, plus link-based sync.
- Mobile layout down to 360px, deployed on GitHub Pages.

[2.1.0]: https://github.com/idan2468/chen-study/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/idan2468/chen-study/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/idan2468/chen-study/releases/tag/v1.0.0
