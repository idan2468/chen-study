import { z } from "zod"
import { buildUnseenExercisesSchema } from "@/types/schemas/unseenExercise"
import type { UnseenExercise } from "@/types/unseenExercise"

/**
 * Locale-agnostic failure codes; the caller maps these to `importErrors.*`.
 *
 * `invalidShape` covers every schema violation -- a missing/mistyped field, an
 * empty array, a non-object entry, a question with no correct option -- with
 * one generic, translated message plus a `debugInfo` dump of the raw zod
 * issues, which the UI offers as a copyable block for a human or an AI to
 * diagnose.
 */
export type UnseenExerciseImportError =
  { code: "invalidJson" } | { code: "invalidShape"; debugInfo: string }

export type UnseenExerciseImportResult =
  | { ok: true; exercises: UnseenExercise[] }
  | { ok: false; error: UnseenExerciseImportError }

/**
 * Validates and normalizes pasted exercise JSON. Accepts either a single
 * exercise object or an array of them, same as `parseModulesJson`.
 *
 * Ported from `loadContentFromJSONInput` (`Unseen New.html:2068`), which
 * required `paragraphs` + `questions` + `flashcards` and generated an
 * `exerciseId` when one was missing. All normalization (id generation,
 * defaults) lives in `buildUnseenExercisesSchema`; this function just parses
 * and reports. `now` is passed in to keep this pure.
 */
export const parseUnseenExerciseJson = (
  text: string,
  now: number,
): UnseenExerciseImportResult => {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, error: { code: "invalidJson" } }
  }

  // Accepts either a single exercise object or an array of them.
  const rawExercises = Array.isArray(parsed) ? parsed : [parsed]

  const result = buildUnseenExercisesSchema(now).safeParse(rawExercises)
  if (!result.success) {
    return {
      ok: false,
      error: { code: "invalidShape", debugInfo: z.prettifyError(result.error) },
    }
  }

  return { ok: true, exercises: result.data }
}
