import { z } from "zod"
import { SpeechLang } from "@/types/speech"
import { CardStatus } from "@/types/moduleExercise"
import type {
  ModuleCard,
  ModuleExercise,
  ModuleProgressRecord,
} from "@/types/moduleExercise"
import type {
  AnswerRecord,
  Flashcard,
  FlashcardProgressRecord,
  HighlightRecord,
  Question,
  QuestionOption,
  UnseenExercise,
} from "@/types/unseenExercise"
import { versionedValueSchema } from "@/types/schemas/versionedValue"

const idSchema = z.string().min(1)

const questionOptionSchema = z.object({
  text: z.string(),
  isCorrect: z.boolean(),
}) satisfies z.ZodType<QuestionOption>

const questionSchema = z.object({
  id: idSchema,
  title: z.string(),
  options: z.array(questionOptionSchema),
}) satisfies z.ZodType<Question>

const flashcardSchema = z.object({
  en: z.string(),
  he: z.string(),
  trans: z.string(),
}) satisfies z.ZodType<Flashcard>

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

const unseenExerciseSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  exerciseId: idSchema,
  paragraphs: z.array(z.string()),
  questions: z.array(questionSchema),
  flashcards: z.array(flashcardSchema),
  answers: z.array(versionedValueSchema(answerRecordSchema)),
  highlights: z.array(versionedValueSchema(highlightRecordSchema)),
  flashcardProgress: z.array(
    versionedValueSchema(flashcardProgressRecordSchema),
  ),
}) satisfies z.ZodType<UnseenExercise>

const moduleCardSchema = z.object({
  en: z.string(),
  he: z.string(),
  meaning: z.string(),
}) satisfies z.ZodType<ModuleCard>

const moduleExerciseSchema = z.object({
  id: idSchema,
  tabName: z.string(),
  title: z.string(),
  rule: z.string(),
  cards: z.array(moduleCardSchema),
}) satisfies z.ZodType<ModuleExercise>

const moduleProgressRecordSchema = z.object({
  word: z.string(),
  status: z.enum(CardStatus),
}) satisfies z.ZodType<ModuleProgressRecord>

const cardIndexSchema = versionedValueSchema(z.number().int().nonnegative())

const unseenStateSchema = z.object({
  exercises: z.array(versionedValueSchema(unseenExerciseSchema)),
  currentId: versionedValueSchema(z.string()),
  cardIndex: cardIndexSchema,
})

const modulesStateSchema = z.object({
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
    versionedValueSchema(z.number()),
  ),
})

export const PERSISTED_STATE_VERSION = 2

export const persistedStateSchema = z.object({
  schemaVersion: z.literal(PERSISTED_STATE_VERSION),
  unseen: unseenStateSchema,
  modules: modulesStateSchema,
  preferences: preferencesSchema,
})

export type PersistedState = z.infer<typeof persistedStateSchema>
