import { z } from "zod"
import type { ModuleCard, ModuleExercise } from "@/types/moduleExercise"

/** Every field is mandatory -- a malformed card is a shape violation. */
export const moduleCardSchema = z.object({
  en: z.string().trim().min(1),
  he: z.string().min(1),
  meaning: z.string().min(1),
}) satisfies z.ZodType<ModuleCard>

/**
 * `id` is the only optional field on the raw JSON -- auto-generated from
 * `now` and the module's position when absent, via `.transform()` below.
 */
const rawModuleExerciseSchema = z.object({
  id: z.string().trim().min(1).optional(),
  tabName: z.string().trim().min(1),
  title: z.string().min(1),
  rule: z.string().min(1),
  cards: z.array(moduleCardSchema).min(1),
})

/**
 * Validates and normalizes an array of pasted modules into `ModuleExercise`s,
 * ready to add to the store. `now` is passed in (rather than read from
 * `Date.now()`) so parsing stays pure and testable -- the original generated
 * ids inline.
 */
export const buildModuleExercisesSchema = (now: number) =>
  z
    .array(rawModuleExerciseSchema)
    .min(1)
    .transform(modules =>
      modules.map((module, index): ModuleExercise => ({
        ...module,
        id: module.id ?? `custom_${String(now)}_${String(index)}`,
      })),
    )
