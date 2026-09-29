import { z } from "zod"
import type { ModuleCard, ModuleExercise } from "@/types/moduleExercise"

const moduleCardSchema = z.object({
  en: z.string().trim().min(1),
  he: z.string().min(1),
  meaning: z.string().min(1),
}) satisfies z.ZodType<ModuleCard>

export const moduleExerciseSchema = z.object({
  id: z.string().trim().min(1),
  tabName: z.string().trim().min(1),
  title: z.string().min(1),
  rule: z.string().min(1),
  cards: z.array(moduleCardSchema).min(1),
}) satisfies z.ZodType<ModuleExercise>

export const moduleExercisesSchema = z.array(moduleExerciseSchema).min(1)
