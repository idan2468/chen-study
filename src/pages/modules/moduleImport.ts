import { z } from "zod"
import { moduleExercisesSchema } from "@/types/schemas/moduleExercise"
import type { ModuleExercise } from "@/types/moduleExercise"

export type ModuleImportError =
  { code: "invalidJson" } | { code: "invalidShape"; debugInfo: string }

export type ModuleImportResult =
  | { ok: true; modules: ModuleExercise[] }
  | { ok: false; error: ModuleImportError }

export const parseModulesJson = (text: string): ModuleImportResult => {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, error: { code: "invalidJson" } }
  }

  const rawModules = Array.isArray(parsed) ? parsed : [parsed]
  const result = moduleExercisesSchema.safeParse(rawModules)
  if (!result.success) {
    return {
      ok: false,
      error: { code: "invalidShape", debugInfo: z.prettifyError(result.error) },
    }
  }

  return { ok: true, modules: result.data }
}
