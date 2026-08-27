import { z } from "zod"
import type { ModuleCard, PracticeModule } from "@/types/module"

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
const rawPracticeModuleSchema = z.object({
  id: z.string().trim().min(1).optional(),
  tabName: z.string().trim().min(1),
  title: z.string().min(1),
  rule: z.string().min(1),
  cards: z.array(moduleCardSchema).min(1),
})

/**
 * Validates and normalizes an array of pasted modules into `PracticeModule`s,
 * ready to add to the store. `now` is passed in (rather than read from
 * `Date.now()`) so parsing stays pure and testable -- the original generated
 * ids inline.
 */
export const buildPracticeModulesSchema = (now: number) =>
  z
    .array(rawPracticeModuleSchema)
    .min(1)
    .transform(modules =>
      modules.map((module, index): PracticeModule => ({
        ...module,
        id: module.id ?? `custom_${String(now)}_${String(index)}`,
      })),
    )
