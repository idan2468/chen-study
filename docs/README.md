# Docs

Docs live in domain folders (`sync/`, `speech/`, `testing/`). A plan that has been carried out in full moves to `completed/<domain>/`, keeping its domain folder, and is kept as a record. Each doc starts with a status line.

## Reference

How things work now; updated with the code, never moved to `completed/`.

- [sync/google-account-sync.md](./sync/google-account-sync.md) — the Google Drive sync design and Google Cloud setup

## Active plans

- [testing/component-testing-plan.md](./testing/component-testing-plan.md) — the component testing rollout plan; Phase 3 and the RTL/LTR smoke test are still open

## Proposed

- [speech/module-pronunciation-recording.md](./speech/module-pronunciation-recording.md) — design for recording and syncing the user's own pronunciation of a module word

## Completed

- [completed/migration/react-conversion-plan.md](./completed/migration/react-conversion-plan.md) — the original HTML-to-React conversion plan and decision log
- [completed/speech/kokoro-tts.md](./completed/speech/kokoro-tts.md) / [completed/speech/remove-neural-tts.md](./completed/speech/remove-neural-tts.md) — the neural TTS experiment and why it was removed (the app now speaks only through `window.speechSynthesis`, with a voice-ranking layer on top)
- [completed/sync/google-merge-sync-plan.md](./completed/sync/google-merge-sync-plan.md) — the merge-sync design, shipped across v2.0.0–v3.0.0
- [completed/sync/google-merge-sync-process.md](./completed/sync/google-merge-sync-process.md) — the step-by-step rollout record for that design
