import type { TFunction } from "i18next"
import type { ModuleImportError } from "@/pages/modules/moduleImport"
import type { ExerciseImportError } from "@/pages/unseen/exerciseImport"

/**
 * Turns a parser's locale-agnostic error code into a message for the user,
 * plus a `debugInfo` dump for `invalidShape` -- the raw zod issues, meant to
 * be offered as a copyable block rather than shown inline. (It's long, and
 * meant for a human or an AI to fix the schema, not for the end user to
 * read.)
 *
 * An exhaustive `switch` rather than a computed `t(\`importErrors.${code}\`)`:
 * i18next's typed `t` can't resolve a union of keys plus a union of
 * interpolation payloads, and the switch makes an untranslated new error
 * code a compile error instead of a silent gap.
 */
export const importErrorMessage = (
  t: TFunction,
  error: ModuleImportError | ExerciseImportError,
  kind: "module" | "exercise",
): { message: string; debugInfo?: string } => {
  switch (error.code) {
    case "invalidJson":
      return { message: t("importErrors.invalidJson") }
    case "invalidShape":
      return {
        message: t(
          kind === "module"
            ? "importErrors.moduleInvalidShape"
            : "importErrors.exerciseInvalidShape",
        ),
        debugInfo: error.debugInfo,
      }
  }
}
