import type { TFunction } from "i18next"
import type { ModuleImportError } from "@/pages/modules/moduleImport"
import type { ExerciseImportError } from "@/pages/unseen/exerciseImport"

/**
 * Turns a parser's locale-agnostic error code into a message for the user.
 *
 * Written as an exhaustive `switch` with literal keys rather than a computed
 * `t(\`importErrors.${code}\`, values)`: i18next's typed `t` cannot resolve its
 * overloads against a union of keys *and* a union of interpolation payloads, and
 * the switch buys something better in exchange for the verbosity -- adding a new
 * error code without translating it becomes a compile error.
 *
 * The imports are type-only, so this adds no runtime coupling to the pages.
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
