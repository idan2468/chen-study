import type { TFunction } from "i18next"
import type { ModuleImportError } from "@/pages/modules/moduleImport"
import type { ExerciseImportError } from "@/pages/unseen/exerciseImport"

/**
 * Turns a parser's locale-agnostic error code into a message for the user.
 *
 * An exhaustive `switch` rather than a computed `t(\`importErrors.${code}\`)`:
 * i18next's typed `t` can't resolve a union of keys plus a union of
 * interpolation payloads, and the switch makes an untranslated new error
 * code a compile error instead of a silent gap.
 */
export const importErrorMessage = (
  t: TFunction,
  error: ModuleImportError | ExerciseImportError,
): string => {
  switch (error.code) {
    case "invalidJson":
      return t("importErrors.invalidJson")
    case "noModules":
      return t("importErrors.noModules")
    case "moduleBadShape":
      return t("importErrors.moduleBadShape", { position: error.position })
    case "moduleMissingCards":
      return t("importErrors.moduleMissingCards", { position: error.position })
    case "moduleMissingCardWord":
      return t("importErrors.moduleMissingCardWord", {
        position: error.position,
        cardPosition: error.cardPosition,
      })
    case "exerciseNotObject":
      return t("importErrors.exerciseNotObject")
    case "exerciseMissingParagraphs":
      return t("importErrors.exerciseMissingParagraphs")
    case "exerciseMissingQuestions":
      return t("importErrors.exerciseMissingQuestions")
    case "exerciseMissingFlashcards":
      return t("importErrors.exerciseMissingFlashcards")
    case "questionMissingOptions":
      return t("importErrors.questionMissingOptions", {
        position: error.position,
      })
    case "questionNoCorrectAnswer":
      return t("importErrors.questionNoCorrectAnswer", {
        position: error.position,
      })
  }
}
