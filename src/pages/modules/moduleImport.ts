import { z } from "zod"
import { buildModuleExercisesSchema } from "@/types/schemas/moduleExercise"
import type { ModuleExercise } from "@/types/moduleExercise"

/**
 * Why a code and not a message: this parser is pure and locale-agnostic, so it
 * reports *what kind* of thing went wrong and leaves the wording to the
 * caller's `t()`. The values map onto keys under `importErrors` in the
 * translation catalogues.
 *
 * `invalidShape` covers every schema violation -- a missing/mistyped field, an
 * empty array, a non-object entry -- with one generic, translated message
 * plus a `debugInfo` dump of the raw zod issues, which the UI offers as a
 * copyable block for a human or an AI to diagnose.
 */
export type ModuleImportError =
  { code: "invalidJson" } | { code: "invalidShape"; debugInfo: string }

export type ModuleImportResult =
  | { ok: true; modules: ModuleExercise[] }
  | { ok: false; error: ModuleImportError }

/**
 * Validates and normalizes pasted module JSON.
 *
 * Replaces `loadJSON` / `loadSingleModule` / `loadMultipleModules`
 * (`Modules Practice.html:1454-1537`), which each independently re-read and
 * re-parsed the same textarea, plus their shared `_commitModules` validator.
 * All normalization (id generation, defaults) lives in
 * `buildModuleExercisesSchema`; this function just parses and reports.
 *
 * `now` is passed in rather than read from `Date.now()` so the function stays
 * pure and testable (the original generated ids inline).
 */
export const parseModulesJson = (
  text: string,
  now: number,
): ModuleImportResult => {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, error: { code: "invalidJson" } }
  }

  // The original accepted either a single module object or an array of them.
  const rawModules = Array.isArray(parsed) ? parsed : [parsed]

  const result = buildModuleExercisesSchema(now).safeParse(rawModules)
  if (!result.success) {
    return {
      ok: false,
      error: { code: "invalidShape", debugInfo: z.prettifyError(result.error) },
    }
  }

  return { ok: true, modules: result.data }
}
