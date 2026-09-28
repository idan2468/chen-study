import { z } from "zod"
import { MAX_SPEECH_RATE, MIN_SPEECH_RATE, SpeechLang } from "@/types/speech"
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
import type { VersionedValue } from "@/types/versionedValue"
import { liveIds } from "@/utils/sync/versionedValue"

const idSchema = z.string().min(1)

/** One entry per identity: the merge and lookups pair entries by ID. */
const versionedArraySchema = <T>(
  valueSchema: z.ZodType<T>,
  getId: (value: T) => string,
) =>
  z
    .array(versionedValueSchema(valueSchema))
    .refine(
      entries =>
        new Set(entries.map(entry => getId(entry.value))).size ===
        entries.length,
      { error: "Duplicate ID" },
    )

const answerRecordSchema = z.object({
  questionId: idSchema,
  selected: z.number().int().nonnegative(),
  correct: z.boolean(),
}) satisfies z.ZodType<AnswerRecord>

const highlightRecordSchema = z.object({
  word: idSchema,
}) satisfies z.ZodType<HighlightRecord>

const flashcardProgressRecordSchema = z.object({
  word: idSchema,
  isKnown: z.boolean(),
}) satisfies z.ZodType<FlashcardProgressRecord>

const unseenExerciseSchema = exerciseContentSchema.extend({
  answers: versionedArraySchema(
    answerRecordSchema,
    answer => answer.questionId,
  ),
  highlights: versionedArraySchema(highlightRecordSchema, ({ word }) => word),
  flashcardProgress: versionedArraySchema(
    flashcardProgressRecordSchema,
    ({ word }) => word,
  ),
}) satisfies z.ZodType<UnseenExercise>

const moduleProgressRecordSchema = z.object({
  word: idSchema,
  status: z.enum(CardStatus),
}) satisfies z.ZodType<ModuleProgressRecord>

type Navigation = {
  currentId: VersionedValue<string>
  cardIndex: VersionedValue<number>
}

/**
 * Points a current ID that isn't live (e.g. deleted on another device) at the
 * first live entity, at its first card; empty when nothing is live.
 */
const withLiveCurrentId = <T>(
  navigation: Navigation,
  entries: readonly VersionedValue<T>[],
  getId: (value: T) => string,
): Navigation => {
  const ids = liveIds(entries, getId)
  const currentId = navigation.currentId.value
  const isLive = ids.length === 0 ? currentId === "" : ids.includes(currentId)
  if (isLive) {
    return navigation
  }
  return {
    currentId: { ...navigation.currentId, value: ids[0] ?? "" },
    cardIndex: { ...navigation.cardIndex, value: 0 },
  }
}

export const speechRateSchema = z
  .number()
  .min(MIN_SPEECH_RATE)
  .max(MAX_SPEECH_RATE)

const cardIndexSchema = versionedValueSchema(z.number().int().nonnegative())

const unseenSchema = z
  .object({
    exercises: versionedArraySchema(
      unseenExerciseSchema,
      exercise => exercise.exerciseId,
    ),
    currentId: versionedValueSchema(z.string()),
    cardIndex: cardIndexSchema,
  })
  .transform(unseen => ({
    ...unseen,
    ...withLiveCurrentId(
      { currentId: unseen.currentId, cardIndex: unseen.cardIndex },
      unseen.exercises,
      exercise => exercise.exerciseId,
    ),
  }))

const modulesSchema = z
  .object({
    modules: versionedArraySchema(moduleExerciseSchema, module => module.id),
    progress: versionedArraySchema(
      moduleProgressRecordSchema,
      ({ word }) => word,
    ),
    currentModuleId: versionedValueSchema(z.string()),
    cardIndex: cardIndexSchema,
  })
  .transform(modules => {
    const { currentId, cardIndex } = withLiveCurrentId(
      { currentId: modules.currentModuleId, cardIndex: modules.cardIndex },
      modules.modules,
      module => module.id,
    )
    return { ...modules, currentModuleId: currentId, cardIndex }
  })

const preferencesSchema = z.object({
  dyslexiaFont: versionedValueSchema(z.boolean()),
  shuffleUnseenAnswers: versionedValueSchema(z.boolean()),
  speechRateByLang: z.record(
    z.enum(SpeechLang),
    versionedValueSchema(speechRateSchema),
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
