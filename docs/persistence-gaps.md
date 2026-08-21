# Persistence gaps: state that resets on reload but arguably shouldn't

## Why

`store/listenerMiddleware.ts` persists most of what matters (exercise/module
libraries, known/unknown progress, marked words, settings) to `localStorage`,
keyed exactly as documented in `utils/storageKeys.ts`. But not every field in
every slice is covered, and a few of the gaps are the kind of thing a user
would actually notice: losing their place in a flashcard deck, or a
half-answered quiz, every time they close the tab.

This is an audit, not a plan — it lists what's missing and flags which gaps
look like real UX loss versus a deliberate "always start fresh" choice, so a
future change can pick which ones (if any) are worth closing.

## Full field-by-field map

### `settingsSlice` — fully persisted

| Field            | Persisted? | Key(s)                  | Flow/interaction missed if lost |
| ---------------- | ---------- | ----------------------- | ------------------------------- |
| `dyslexiaFont`   | Yes        | `dyslexia_font_enabled` | — no gap                        |
| `speechRate`     | Yes        | `english_speech_rate`   | — no gap                        |
| `systemVoiceUri` | Yes        | `english_system_voice`  | — no gap                        |

### `speechSlice` — intentionally not persisted

| Field        | Persisted? | Flow/interaction missed if lost                                                                                                    |
| ------------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `ownerId`    | No         | None. Nothing is ever mid-utterance across a page load, so there is no in-progress playback to resume.                             |
| `queueIndex` | No         | None, same reasoning — the highlighted-word position in a sequential read only means anything while that read is actually running. |

Correct as-is: this is "who currently owns `window.speechSynthesis`", which
resets to nothing on every load regardless of what's stored, since nothing is
ever mid-utterance across a page load.

### `unseenSlice`

| Field         | Persisted? | Key(s)                                                                        | Flow/interaction missed if lost                                                                                                                                                                                                                                                                          |
| ------------- | ---------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `library`     | Yes        | `english_exercise_library`                                                    | — no gap                                                                                                                                                                                                                                                                                                 |
| `currentId`   | Yes        | `english_current_exercise_id` + legacy mirror `current_english_exercise_data` | — no gap                                                                                                                                                                                                                                                                                                 |
| `markedWords` | Yes        | `english_marked_words`                                                        | — no gap                                                                                                                                                                                                                                                                                                 |
| `progress`    | Yes        | `flashcards_status_<exerciseId>` (one key per exercise)                       | — no gap                                                                                                                                                                                                                                                                                                 |
| `cardIndex`   | **No**     | resets to 0 on load, and on `switchExercise`/`addExercise`/`deleteExercise`   | Reopening the app (or just refreshing) always drops the vocabulary-flashcard deck back to card 1. Someone 15 cards into a 20-card exercise loses their spot and has to click "Next" 14 times to get back, or re-encounters cards already reviewed this session.                                          |
| `answers`     | **No**     | resets to `{}` on load, and on the same three actions                         | Every selected answer on the reading-comprehension questions is wiped on reload. A user who answered 3 of 4 questions and closes the tab (or it refreshes/crashes) comes back to a blank quiz, including losing the correct/incorrect feedback already shown — the clearest "lost work" case in the app. |

### `modulesSlice`

| Field               | Persisted? | Key(s)                                                                                                                                                    | Flow/interaction missed if lost                                                                                                                                                                                                                                                              |
| ------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `modules`           | Yes        | `english_reading_all_modules_v4`                                                                                                                          | — no gap                                                                                                                                                                                                                                                                                     |
| `progress`          | Yes        | `english_reading_practice_progress_v3`                                                                                                                    | — no gap                                                                                                                                                                                                                                                                                     |
| `deletedBuiltInIds` | Yes        | `english_reading_deleted_builtins_v1`                                                                                                                     | — no gap                                                                                                                                                                                                                                                                                     |
| `currentModuleId`   | **No**     | recomputed on every load; always prefers the hardcoded `mod3` if present                                                                                  | Switching to a different module tab (say, module 5) and reopening the app silently teleports back to module 3 (or module 1 if 3 was deleted), with no indication anything changed. Combined with `cardIndex` below, a user loses both _which_ module they were practising and _where_ in it. |
| `cardIndex`         | **No**     | resets to 0 on load and on nearly every action (`selectModule`, `toggleFilterMissed`, `toggleMissedReview`, `deleteModule`, `resetCurrentModuleProgress`) | Same "back to card 1" loss as `unseen.cardIndex`, but here it also happens _within_ a session any time the missed-words filter is toggled — so even without a reload, filtering to "only missed" and back loses the current card position.                                                   |
| `filterMissed`      | **No**     | always `false` on load                                                                                                                                    | A user who turned on "show only missed words" to focus a review session has to re-enable it after every reload. Lower severity since several in-session actions already clear it too (see below), but it never survives leaving and coming back to the app.                                  |
| `reviewingMissed`   | **No**     | always `false` on load                                                                                                                                    | Same as `filterMissed`: reopening the app mid "practice missed words across all modules" review silently drops back to normal single-module practice, with no memory of being mid-review.                                                                                                    |

Note: `selectModule` is in the modules listener's `isAnyOf` matcher, but the
effect body only diffs `modules`/`progress`/`deletedBuiltInIds` — including it
in the matcher just makes the effect re-run as a no-op when the module
changes; the id itself is never written anywhere.

### Outside Redux, but still cross-reload UI state

- `dark_mode_enabled` and `english_locale` — persisted, but not through
  `listenerMiddleware`. Dark mode is owned by Mantine's `colorSchemeManager`
  (`theme.ts`); locale is owned by `react-i18next` via `i18n/useLocale.ts`.
  Both survive a reload correctly; called out here only so this file is a
  complete map, not because either is a gap.

## Non-Redux local component state

None of this is Redux, so none of it could persist without deliberately
lifting it into a slice. Listed for completeness, since it's still state that
disappears on reload, with the same "what does the user lose" framing:

| Location                                    | State                                              | Flow/interaction missed if lost                                                                                                                                                                             |
| ------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `UnseenPage.tsx`                            | `tab` (`"reading"` / `"flashcards"` / `"json"`)    | Reopening the app always lands on the reading tab even if the user was deep into flashcards or mid-way through pasting a custom exercise's JSON. Also force-reset to `"reading"` after a successful import. |
| `JsonLoader.tsx`                            | pasted textarea contents + last parse result/error | Lost on reload, and also lost just by switching away from the JSON tab (`Tabs` uses `keepMounted={false}`) — a half-typed or already-validated JSON payload has to be re-pasted from scratch.               |
| `ModuleFlashcard.tsx` / `FlashcardsTab.tsx` | `flipped` card state                               | None — this is fine as ephemeral. Each card is a mount-scoped "did I flip _this_ card" flag, not lost progress.                                                                                             |
| `TopBar.tsx`                                | sync-modal / speech-settings-modal open state      | None — correctly ephemeral. A modal reopening on its own after a reload would be a bug, not a missing feature.                                                                                              |

## Which gaps look like real UX loss

Judged by whether the reducers only reset the field on _load_, or reset it
routinely during normal use too — the latter suggests "always start fresh" is
a deliberate product choice already baked into the interaction, not just a
missing persistence write.

**Likely worth persisting, if this is picked up:**

1. **`unseen.answers`** (quiz answers). This is the one clearest case of lost
   user work: answer a few comprehension questions, close the tab, come back
   to a blank quiz. Nothing about the reducers resets this mid-session except
   switching exercises, which is a reasonable place to also clear it.
2. **`unseen.cardIndex` / `modules.cardIndex`** (flashcard/module position).
   Reopening the app always drops you back to card 1. Mildly annoying on its
   own; more so combined with #3.
3. **`modules.currentModuleId`**. Always reopens on `mod3` regardless of what
   the user was last practising. Combined with #2, switching devices or just
   reopening the tab loses both _which_ module and _where in it_.
4. **`UnseenPage`'s `tab` state**. Reopening always lands back on the reading
   tab even if the user was deep into flashcards.

**Probably a deliberate "start fresh" choice, not an oversight** — the
reducers themselves reset these on almost every relevant action, not just on
load, so persisting them would fight the app's own logic rather than complete
it:

5. **`modules.filterMissed` / `modules.reviewingMissed`**. These are cleared
   by `selectModule`, `deleteModule`, and `resetCurrentModuleProgress` too —
   the app already treats "switch context → drop the filter" as correct
   behaviour within a single session, so carrying it across a reload as well
   would be inconsistent with how it behaves the rest of the time.

## Not a plan

This file intentionally stops at "here's what's missing and how it's
categorized." If any of the above gets picked up, it's a small, mechanical
change in the same shape as the existing listener effects:
`unseen.answers`/`cardIndex` and `modules.cardIndex`/`currentModuleId` would
each need one more `StorageKeys` entry, one more diff-and-write block in the
matching `listenerMiddleware.ts` effect, and one more `readJson`/`readString`
call in the slice's `readInitialState`. `UnseenPage`'s `tab` would need
lifting into a slice first, since it isn't Redux state at all today.
