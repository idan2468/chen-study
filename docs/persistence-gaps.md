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

| Field            | Persisted? | Key(s)                                                                            |
| ---------------- | ---------- | --------------------------------------------------------------------------------- |
| `dyslexiaFont`   | Yes        | `dyslexia_font_enabled` + `dyslexia_font_enabled_modules` (both written together) |
| `speechRate`     | Yes        | `english_speech_rate`                                                             |
| `systemVoiceUri` | Yes        | `english_system_voice`                                                            |

### `speechSlice` — intentionally not persisted

| Field        | Persisted? |
| ------------ | ---------- |
| `ownerId`    | No         |
| `queueIndex` | No         |

Correct as-is: this is "who currently owns `window.speechSynthesis`", which
resets to nothing on every load regardless of what's stored, since nothing is
ever mid-utterance across a page load.

### `unseenSlice`

| Field         | Persisted? | Key(s)                                                                        |
| ------------- | ---------- | ----------------------------------------------------------------------------- |
| `library`     | Yes        | `english_exercise_library`                                                    |
| `currentId`   | Yes        | `english_current_exercise_id` + legacy mirror `current_english_exercise_data` |
| `markedWords` | Yes        | `english_marked_words`                                                        |
| `progress`    | Yes        | `flashcards_status_<exerciseId>` (one key per exercise)                       |
| `cardIndex`   | **No**     | resets to 0 on load, and on `switchExercise`/`addExercise`/`deleteExercise`   |
| `answers`     | **No**     | resets to `{}` on load, and on the same three actions                         |

### `modulesSlice`

| Field               | Persisted? | Key(s)                                                                                                                                                    |
| ------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `modules`           | Yes        | `english_reading_all_modules_v4`                                                                                                                          |
| `progress`          | Yes        | `english_reading_practice_progress_v3`                                                                                                                    |
| `deletedBuiltInIds` | Yes        | `english_reading_deleted_builtins_v1`                                                                                                                     |
| `currentModuleId`   | **No**     | recomputed on every load; always prefers the hardcoded `mod3` if present                                                                                  |
| `cardIndex`         | **No**     | resets to 0 on load and on nearly every action (`selectModule`, `toggleFilterMissed`, `toggleMissedReview`, `deleteModule`, `resetCurrentModuleProgress`) |
| `filterMissed`      | **No**     | always `false` on load                                                                                                                                    |
| `reviewingMissed`   | **No**     | always `false` on load                                                                                                                                    |

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
disappears on reload:

- `UnseenPage.tsx` — `const [tab, setTab] = useState<TabValue>("reading")`.
  Which of the three tabs (reading / flashcards / json) is open. Also reset to
  `"reading"` programmatically after a successful JSON import.
- `JsonLoader.tsx` — the pasted textarea contents and the last parse
  result/error. Lost on reload, and also lost on tab switch away from the
  JSON tab (`Tabs` uses `keepMounted={false}`).
- `ModuleFlashcard.tsx` / `FlashcardsTab.tsx` — `flipped` card state. This one
  is fine as ephemeral: each card is a mount-scoped "did I flip _this_ card"
  flag, not lost progress.
- `TopBar.tsx` — sync-modal / speech-settings-modal open state. Correctly
  ephemeral; a modal should not reopen on its own after a reload.

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
