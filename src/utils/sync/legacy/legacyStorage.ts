import { z } from "zod"
import { listKeys, readJson, readString } from "@/store/storage"
import { CardStatus } from "@/types/moduleExercise"
import type { ModuleProgressRecord } from "@/types/moduleExercise"

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
