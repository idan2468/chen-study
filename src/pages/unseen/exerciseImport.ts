import { z } from "zod"
import { buildExerciseSchema } from "@/types/schemas/exercise"
import type { Exercise } from "@/types/exercise"

/**
 * Locale-agnostic failure codes; the caller maps these to `importErrors.*`.
 *
 * `invalidShape` covers every schema violation -- a missing/mistyped field, an
 * empty array, a non-object payload, a question with no correct option --
 * with one generic, translated message plus a `debugInfo` dump of the raw
 * zod issues, which the UI offers as a copyable block for a human or an AI
 * to diagnose.
 */
export type ExerciseImportError =
  { code: "invalidJson" } | { code: "invalidShape"; debugInfo: string }

export type ExerciseImportResult =
  { ok: true; exercise: Exercise } | { ok: false; error: ExerciseImportError }

/**
 * Validates and normalizes pasted exercise JSON.
 *
 * Ported from `loadContentFromJSONInput` (`Unseen New.html:2068`), which
 * required `paragraphs` + `questions` + `flashcards` and generated an
 * `exerciseId` when one was missing. All normalization (id generation,
 * defaults) lives in `buildExerciseSchema`; this function just parses and
 * reports. `now` is passed in to keep this pure.
 */
export const parseExerciseJson = (
  text: string,
  now: number,
): ExerciseImportResult => {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, error: { code: "invalidJson" } }
  }

  const result = buildExerciseSchema(now).safeParse(parsed)
  if (!result.success) {
    return {
      ok: false,
      error: { code: "invalidShape", debugInfo: z.prettifyError(result.error) },
    }
  }

  return { ok: true, exercise: result.data }
}
