import { z } from "zod"
import { listKeys, readJson, readString } from "@/store/storage"
import { CardStatus } from "@/types/moduleExercise"
import type { ModuleProgressRecord } from "@/types/moduleExercise"
import type { AnswerRecord, UnseenExercise } from "@/types/unseenExercise"

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

export const flashcardStatusKey = (exerciseId: string) =>
  `flashcards_status_${exerciseId || "default"}`

const DEVICE_LOCAL_KEYS = new Set<string>([
  StorageKeys.systemVoice,
  StorageKeys.systemVoiceHe,
  StorageKeys.googleAccessToken,
  StorageKeys.googleLastSyncedHash,
])

export const isSyncableKey = (key: string) =>
  !DEVICE_LOCAL_KEYS.has(key) &&
  (key.startsWith("flashcards_status_") ||
    key.startsWith("english_") ||
    key.startsWith("hebrew_") ||
    key.includes("dyslexia") ||
    key.includes("dark_mode"))

export const buildSyncPayload = (): SyncPayload => {
  const payload: SyncPayload = {}
  for (const key of listKeys()) {
    if (isSyncableKey(key)) {
      payload[key] = readString(key)
    }
  }
  return payload
}

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

export const readLegacyModuleProgress = (): ModuleProgressRecord[] =>
  Object.entries(
    readJson<Record<string, CardStatus>>(StorageKeys.modulesProgress, {}),
  ).map(([word, status]) => ({ word, status }))

export const toLegacyModuleProgress = (
  progress: readonly ModuleProgressRecord[],
): Record<string, CardStatus> =>
  Object.fromEntries(
    progress
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

export const readLegacyUnseenState = (
  defaultExercise: UnseenExercise,
): {
  exercises: UnseenExercise[]
  currentId: string
  cardIndex: number
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
    exercises: Object.values(library).map(exercise => ({
      ...exercise,
      answers: Object.entries(answersByExercise[exercise.exerciseId] ?? {}).map(
        ([questionId, answer]) => ({ questionId, ...answer }),
      ),
      highlights: (markedWords[exercise.exerciseId] ?? []).map(word => ({
        word,
      })),
      flashcardProgress: Object.entries(
        readJson<Record<string, boolean>>(
          flashcardStatusKey(exercise.exerciseId),
          {},
        ),
      ).map(([word, isKnown]) => ({ word, isKnown })),
    })),
    currentId,
    cardIndex: readJson<number>(StorageKeys.flashcardIndex, 0),
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
      .filter(exercise => exercise.answers.length > 0)
      .map(exercise => [
        exercise.exerciseId,
        Object.fromEntries(
          exercise.answers.map(({ questionId, selected, correct }) => [
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
      .filter(exercise => exercise.highlights.length > 0)
      .map(exercise => [
        exercise.exerciseId,
        exercise.highlights.map(({ word }) => word),
      ]),
  )

export const toLegacyFlashcardProgress = (
  exercise: UnseenExercise,
): Record<string, boolean> =>
  Object.fromEntries(
    exercise.flashcardProgress.map(({ word, isKnown }) => [word, isKnown]),
  )
