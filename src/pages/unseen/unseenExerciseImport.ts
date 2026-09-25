import { z } from "zod"
import { unseenExercisesSchema } from "@/types/schemas/unseenExercise"
import type { UnseenExercise } from "@/types/unseenExercise"

export type UnseenExerciseImportError =
  { code: "invalidJson" } | { code: "invalidShape"; debugInfo: string }

export type UnseenExerciseImportResult =
  | { ok: true; exercises: UnseenExercise[] }
  | { ok: false; error: UnseenExerciseImportError }

export const parseUnseenExerciseJson = (
  text: string,
): UnseenExerciseImportResult => {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, error: { code: "invalidJson" } }
  }

  const rawExercises = Array.isArray(parsed) ? parsed : [parsed]
  const result = unseenExercisesSchema.safeParse(rawExercises)
  if (!result.success) {
    return {
      ok: false,
      error: { code: "invalidShape", debugInfo: z.prettifyError(result.error) },
    }
  }

  return { ok: true, exercises: result.data }
}
