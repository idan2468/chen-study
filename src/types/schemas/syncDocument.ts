import { z } from "zod"
import { SpeechLang } from "@/types/speech"
import { CardStatus } from "@/types/moduleExercise"
import type { ModuleExercise } from "@/types/moduleExercise"
import type { UnseenExercise } from "@/types/unseenExercise"
import { versionedValueSchema } from "@/types/schemas/versionedValue"

const idSchema = z.string().min(1)

const unseenExerciseSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  exerciseId: idSchema,
  paragraphs: z.array(z.string()),
  questions: z.array(
    z.object({
      id: idSchema,
      title: z.string(),
      options: z.array(z.object({ text: z.string(), isCorrect: z.boolean() })),
    }),
  ),
  flashcards: z.array(
    z.object({ en: z.string(), he: z.string(), trans: z.string() }),
  ),
  answers: z.array(
    versionedValueSchema(
      z.object({
        questionId: idSchema,
        selected: z.number().int(),
        correct: z.boolean(),
      }),
    ),
  ),
  highlights: z.array(versionedValueSchema(z.object({ word: z.string() }))),
  flashcardProgress: z.array(
    versionedValueSchema(z.object({ word: z.string(), isKnown: z.boolean() })),
  ),
}) satisfies z.ZodType<UnseenExercise>

const moduleExerciseSchema = z.object({
  id: idSchema,
  tabName: z.string(),
  title: z.string(),
  rule: z.string(),
  cards: z.array(
    z.object({ en: z.string(), he: z.string(), meaning: z.string() }),
  ),
}) satisfies z.ZodType<ModuleExercise>

const cardIndexSchema = versionedValueSchema(z.number().int().nonnegative())

export const SYNC_DOCUMENT_VERSION = 2

export const syncDocumentV2Schema = z.object({
  schemaVersion: z.literal(SYNC_DOCUMENT_VERSION),
  unseen: z.object({
    exercises: z.array(versionedValueSchema(unseenExerciseSchema)),
    currentId: versionedValueSchema(z.string()),
    cardIndex: cardIndexSchema,
  }),
  modules: z.object({
    modules: z.array(versionedValueSchema(moduleExerciseSchema)),
    progress: z.array(
      versionedValueSchema(
        z.object({ word: z.string(), status: z.enum(CardStatus) }),
      ),
    ),
    currentModuleId: versionedValueSchema(z.string()),
    cardIndex: cardIndexSchema,
  }),
  preferences: z.object({
    dyslexiaFont: versionedValueSchema(z.boolean()),
    shuffleUnseenAnswers: versionedValueSchema(z.boolean()),
    speechRateByLang: z.record(
      z.enum(SpeechLang),
      versionedValueSchema(z.number()),
    ),
  }),
})

export type SyncDocumentV2 = z.infer<typeof syncDocumentV2Schema>
