import { z } from "zod"
import { SpeechLang } from "@/types/speech"
import { CardStatus } from "@/types/moduleExercise"
import type { ModuleProgressRecord } from "@/types/moduleExercise"
import type {
  AnswerRecord,
  FlashcardProgressRecord,
  HighlightRecord,
  UnseenExercise,
} from "@/types/unseenExercise"
import { moduleExerciseSchema } from "@/types/schemas/moduleExercise"
import { exerciseContentSchema } from "@/types/schemas/unseenExercise"
import { versionedValueSchema } from "@/types/schemas/versionedValue"
import { MAX_SPEECH_RATE, MIN_SPEECH_RATE } from "@/utils/speech/speechRate"

const idSchema = z.string().min(1)

const answerRecordSchema = z.object({
  questionId: idSchema,
  selected: z.number().int(),
  correct: z.boolean(),
}) satisfies z.ZodType<AnswerRecord>

const highlightRecordSchema = z.object({
  word: z.string(),
}) satisfies z.ZodType<HighlightRecord>

const flashcardProgressRecordSchema = z.object({
  word: z.string(),
  isKnown: z.boolean(),
}) satisfies z.ZodType<FlashcardProgressRecord>

const unseenExerciseSchema = exerciseContentSchema.extend({
  answers: z.array(versionedValueSchema(answerRecordSchema)),
  highlights: z.array(versionedValueSchema(highlightRecordSchema)),
  flashcardProgress: z.array(
    versionedValueSchema(flashcardProgressRecordSchema),
  ),
}) satisfies z.ZodType<UnseenExercise>

const moduleProgressRecordSchema = z.object({
  word: z.string(),
  status: z.enum(CardStatus),
}) satisfies z.ZodType<ModuleProgressRecord>

const cardIndexSchema = versionedValueSchema(z.number().int().nonnegative())

const unseenSchema = z.object({
  exercises: z.array(versionedValueSchema(unseenExerciseSchema)),
  currentId: versionedValueSchema(z.string()),
  cardIndex: cardIndexSchema,
})

const modulesSchema = z.object({
  modules: z.array(versionedValueSchema(moduleExerciseSchema)),
  progress: z.array(versionedValueSchema(moduleProgressRecordSchema)),
  currentModuleId: versionedValueSchema(z.string()),
  cardIndex: cardIndexSchema,
})

const preferencesSchema = z.object({
  dyslexiaFont: versionedValueSchema(z.boolean()),
  shuffleUnseenAnswers: versionedValueSchema(z.boolean()),
  speechRateByLang: z.record(
    z.enum(SpeechLang),
    versionedValueSchema(z.number().min(MIN_SPEECH_RATE).max(MAX_SPEECH_RATE)),
  ),
})

export const PERSISTED_STATE_VERSION = 2

export const persistedStateSchema = z.object({
  schemaVersion: z.literal(PERSISTED_STATE_VERSION),
  unseen: unseenSchema,
  modules: modulesSchema,
  preferences: preferencesSchema,
})

export type PersistedState = z.infer<typeof persistedStateSchema>
