import { z } from "zod"
import { PERSISTED_STATE_KEY } from "@/store/persistedState"
import { readFlag, readJson, readString } from "@/store/storage"
import type { PersistedState } from "@/types/schemas/persistedState"
import { speechRateSchema } from "@/types/schemas/persistedState"
import { DEFAULT_SPEECH_RATE, SpeechLang } from "@/types/speech"
import { CardStatus } from "@/types/moduleExercise"
import type {
  ModuleExercise,
  ModuleProgressRecord,
} from "@/types/moduleExercise"
import {
  builtInModuleIds,
  defaultModuleExercises,
} from "@/data/defaultModuleExercises"
import type { AnswerRecord, UnseenExercise } from "@/types/unseenExercise"
import type { VersionedValue } from "@/types/versionedValue"
import {
  INITIAL_UPDATED_AT,
  liveValues,
  markDeleted,
  toVersionedValue,
} from "@/utils/sync/versionedValue"

export const syncPayloadSchema = z.record(z.string(), z.string())
export type SyncPayload = z.infer<typeof syncPayloadSchema>

/** Storage keys inherited from the original standalone HTML apps. */
export const StorageKeys = {
  darkMode: "dark_mode_enabled",
  dyslexiaFont: "dyslexia_font_enabled",
  speechRate: "english_speech_rate",
  speechRateHe: "hebrew_speech_rate",
  shuffleUnseenAnswers: "english_shuffle_unseen_answers",
  locale: "english_locale",
  systemVoice: "english_system_voice",
  systemVoiceHe: "hebrew_system_voice",
  googleAccessToken: "google_access_token",
  googleLastSyncedHash: "google_last_synced_hash",
  exerciseLibrary: "english_exercise_library",
  currentExerciseId: "english_current_exercise_id",
  currentExerciseData: "current_english_exercise_data",
  markedWords: "english_marked_words",
  quizAnswers: "english_quiz_answers",
  flashcardIndex: "english_flashcard_index",
  allModules: "english_reading_all_modules_v4",
  modulesProgress: "english_reading_practice_progress_v3",
  deletedBuiltInModules: "english_reading_deleted_builtins_v1",
  moduleCardIndex: "english_module_card_index",
  currentModuleId: "english_current_module_id",
} as const

const FLASHCARD_STATUS_PREFIX = "flashcards_status_"

export const flashcardStatusKey = (exerciseId: string) =>
  `${FLASHCARD_STATUS_PREFIX}${exerciseId || "default"}`

const DEVICE_LOCAL_KEYS = new Set<string>([
  StorageKeys.systemVoice,
  StorageKeys.systemVoiceHe,
  StorageKeys.googleAccessToken,
  StorageKeys.googleLastSyncedHash,
])

export const isSyncableKey = (key: string) =>
  !DEVICE_LOCAL_KEYS.has(key) &&
  key !== PERSISTED_STATE_KEY &&
  (key.startsWith(FLASHCARD_STATUS_PREFIX) ||
    key.startsWith("english_") ||
    key.startsWith("hebrew_") ||
    key.includes("dyslexia") ||
    key.includes("dark_mode"))

/** Everything the persisted state replaces, plus the legacy sync hash; device settings are not listed. */
const LEGACY_DATA_KEYS = new Set<string>([
  StorageKeys.dyslexiaFont,
  StorageKeys.speechRate,
  StorageKeys.speechRateHe,
  StorageKeys.shuffleUnseenAnswers,
  StorageKeys.googleLastSyncedHash,
  StorageKeys.exerciseLibrary,
  StorageKeys.currentExerciseId,
  StorageKeys.currentExerciseData,
  StorageKeys.markedWords,
  StorageKeys.quizAnswers,
  StorageKeys.flashcardIndex,
  StorageKeys.allModules,
  StorageKeys.modulesProgress,
  StorageKeys.deletedBuiltInModules,
  StorageKeys.moduleCardIndex,
  StorageKeys.currentModuleId,
])

export const isLegacyDataKey = (key: string) =>
  LEGACY_DATA_KEYS.has(key) || key.startsWith(FLASHCARD_STATUS_PREFIX)

export const applySyncPayload = (payload: SyncPayload) => {
  let applied = 0
  for (const [key, value] of Object.entries(payload)) {
    if (!isSyncableKey(key)) {
      continue
    }
    try {
      window.localStorage.setItem(key, value)
      applied += 1
    } catch (error) {
      console.warn(`Could not import "${key}"`, error)
    }
  }
  return applied
}

/** Deleted built-ins become tombstones; a deletion wins over a stored copy, as before. */
export const readLegacyModules = (): VersionedValue<ModuleExercise>[] => {
  const deletedIds = new Set(
    readJson<string[]>(StorageKeys.deletedBuiltInModules, []),
  )
  const stored = readJson<ModuleExercise[]>(StorageKeys.allModules, [])
    .filter(module => !deletedIds.has(module.id))
    .map(module => toVersionedValue(module))
  const tombstones = defaultModuleExercises
    .filter(module => deletedIds.has(module.id))
    .map(module => markDeleted(toVersionedValue(module), INITIAL_UPDATED_AT))
  return [...stored, ...tombstones]
}

export const toLegacyDeletedBuiltInIds = (
  modules: readonly VersionedValue<ModuleExercise>[],
): string[] =>
  modules
    .filter(entry => entry.deleted && builtInModuleIds.includes(entry.value.id))
    .map(entry => entry.value.id)

export const readLegacyModuleProgress =
  (): VersionedValue<ModuleProgressRecord>[] =>
    Object.entries(
      readJson<Record<string, CardStatus>>(StorageKeys.modulesProgress, {}),
    ).map(([word, status]) => toVersionedValue({ word, status }))

/** Before built-in seeding and index clamping, which the Modules slice applies to either source. */
export const readLegacyModulesState = (): PersistedState["modules"] => ({
  modules: readLegacyModules(),
  progress: readLegacyModuleProgress(),
  currentModuleId: toVersionedValue(
    readString(StorageKeys.currentModuleId, ""),
  ),
  cardIndex: toVersionedValue(readJson<number>(StorageKeys.moduleCardIndex, 0)),
})

const readLegacyRate = (key: string) =>
  toVersionedValue(
    speechRateSchema
      .catch(DEFAULT_SPEECH_RATE)
      .parse(Number.parseFloat(readString(key, ""))),
  )

export const readLegacyPreferences = (): PersistedState["preferences"] => ({
  dyslexiaFont: toVersionedValue(readFlag(StorageKeys.dyslexiaFont, false)),
  shuffleUnseenAnswers: toVersionedValue(
    readFlag(StorageKeys.shuffleUnseenAnswers, false),
  ),
  speechRateByLang: {
    [SpeechLang.English]: readLegacyRate(StorageKeys.speechRate),
    [SpeechLang.Hebrew]: readLegacyRate(StorageKeys.speechRateHe),
  },
})

export const toLegacyModuleProgress = (
  progress: readonly VersionedValue<ModuleProgressRecord>[],
): Record<string, CardStatus> =>
  Object.fromEntries(
    liveValues(progress)
      .filter(record => record.status !== CardStatus.None)
      .map(record => [record.word, record.status]),
  )

type LegacyUnseenExercise = Omit<
  UnseenExercise,
  "answers" | "highlights" | "flashcardProgress"
>
type LegacyAnswerRecord = Omit<AnswerRecord, "questionId">
type LegacyExerciseAnswers = Record<string, LegacyAnswerRecord>
type LegacyAnswersByExercise = Record<string, LegacyExerciseAnswers>

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const isLegacyAnswerRecord = (value: unknown): value is LegacyAnswerRecord =>
  isRecord(value) &&
  Number.isInteger(value.selected) &&
  typeof value.correct === "boolean"

const isLegacyExerciseAnswers = (
  value: unknown,
): value is LegacyExerciseAnswers =>
  isRecord(value) && Object.values(value).every(isLegacyAnswerRecord)

const readLegacyAnswersByExercise = (
  currentId: string,
): LegacyAnswersByExercise => {
  const stored = readJson<unknown>(StorageKeys.quizAnswers, {})
  if (!isRecord(stored)) {
    return {}
  }

  const entries = Object.entries(stored)
  if (entries.length === 0) {
    return {}
  }
  if (entries.every(([, answer]) => isLegacyAnswerRecord(answer))) {
    return { [currentId]: stored as LegacyExerciseAnswers }
  }

  return Object.fromEntries(
    entries.filter((entry): entry is [string, LegacyExerciseAnswers] =>
      isLegacyExerciseAnswers(entry[1]),
    ),
  )
}

const toLegacyUnseenExercise = (
  exercise: UnseenExercise,
): LegacyUnseenExercise => ({
  title: exercise.title,
  subtitle: exercise.subtitle,
  exerciseId: exercise.exerciseId,
  paragraphs: exercise.paragraphs,
  questions: exercise.questions,
  flashcards: exercise.flashcards,
})

/**
 * Converts the legacy Unseen keys into versioned state, all stamped `INITIAL_UPDATED_AT`.
 * @param defaultExercise The built-in exercise, added when the stored library lacks it and used when no stored current ID is valid.
 */
export const readLegacyUnseenState = (
  defaultExercise: UnseenExercise,
): {
  exercises: VersionedValue<UnseenExercise>[]
  currentId: VersionedValue<string>
  cardIndex: VersionedValue<number>
} => {
  const library = readJson<Record<string, LegacyUnseenExercise>>(
    StorageKeys.exerciseLibrary,
    {},
  )
  library[defaultExercise.exerciseId] ??=
    toLegacyUnseenExercise(defaultExercise)

  const storedId = readString(StorageKeys.currentExerciseId, "")
  const legacyCurrent = readJson<LegacyUnseenExercise | null>(
    StorageKeys.currentExerciseData,
    null,
  )
  const preferredId =
    storedId && storedId in library
      ? storedId
      : (legacyCurrent?.exerciseId ?? defaultExercise.exerciseId)
  const currentId =
    preferredId in library ? preferredId : defaultExercise.exerciseId
  const answersByExercise = readLegacyAnswersByExercise(currentId)
  const markedWords = readJson<Record<string, string[]>>(
    StorageKeys.markedWords,
    {},
  )

  return {
    exercises: Object.values(library).map(exercise =>
      toVersionedValue({
        ...exercise,
        answers: Object.entries(
          answersByExercise[exercise.exerciseId] ?? {},
        ).map(([questionId, answer]) =>
          toVersionedValue({ questionId, ...answer }),
        ),
        highlights: (markedWords[exercise.exerciseId] ?? []).map(word =>
          toVersionedValue({ word }),
        ),
        flashcardProgress: Object.entries(
          readJson<Record<string, boolean>>(
            flashcardStatusKey(exercise.exerciseId),
            {},
          ),
        ).map(([word, isKnown]) => toVersionedValue({ word, isKnown })),
      }),
    ),
    currentId: toVersionedValue(currentId),
    cardIndex: toVersionedValue(
      readJson<number>(StorageKeys.flashcardIndex, 0),
    ),
  }
}

export const toLegacyUnseenLibrary = (
  exercises: readonly UnseenExercise[],
): Record<string, LegacyUnseenExercise> =>
  Object.fromEntries(
    exercises.map(exercise => [
      exercise.exerciseId,
      toLegacyUnseenExercise(exercise),
    ]),
  )

export const toLegacyUnseenAnswers = (
  exercises: readonly UnseenExercise[],
): LegacyAnswersByExercise =>
  Object.fromEntries(
    exercises
      .map(
        exercise =>
          [exercise.exerciseId, liveValues(exercise.answers)] as const,
      )
      .filter(([, answers]) => answers.length > 0)
      .map(([exerciseId, answers]) => [
        exerciseId,
        Object.fromEntries(
          answers.map(({ questionId, selected, correct }) => [
            questionId,
            { selected, correct },
          ]),
        ),
      ]),
  )

export const toLegacyMarkedWords = (
  exercises: readonly UnseenExercise[],
): Record<string, string[]> =>
  Object.fromEntries(
    exercises
      .map(
        exercise =>
          [
            exercise.exerciseId,
            liveValues(exercise.highlights).map(({ word }) => word),
          ] as const,
      )
      .filter(([, words]) => words.length > 0),
  )

export const toLegacyFlashcardProgress = (
  exercise: UnseenExercise,
): Record<string, boolean> =>
  Object.fromEntries(
    liveValues(exercise.flashcardProgress).map(({ word, isKnown }) => [
      word,
      isKnown,
    ]),
  )
