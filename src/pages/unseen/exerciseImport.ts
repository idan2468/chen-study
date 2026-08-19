import type { Exercise, Question, QuestionOption } from "@/types/exercise"

/** Locale-agnostic failure codes; the caller maps these to `importErrors.*`. */
export type ExerciseImportError =
  | { code: "invalidJson" }
  | { code: "exerciseNotObject" }
  | { code: "exerciseMissingParagraphs" }
  | { code: "exerciseMissingQuestions" }
  | { code: "exerciseMissingFlashcards" }
  | { code: "questionMissingOptions"; position: number }
  | { code: "questionNoCorrectAnswer"; position: number }

export type ExerciseImportResult =
  { ok: true; exercise: Exercise } | { ok: false; error: ExerciseImportError }

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => typeof item === "string")

type QuestionResult =
  { ok: true; question: Question } | { ok: false; error: ExerciseImportError }

const normalizeQuestion = (raw: unknown, position: number): QuestionResult => {
  const question = raw as Partial<Question>

  if (!Array.isArray(question.options) || question.options.length === 0) {
    return { ok: false, error: { code: "questionMissingOptions", position } }
  }

  const options: QuestionOption[] = question.options.map(rawOption => {
    const option = rawOption as Partial<QuestionOption>
    return {
      text: typeof option.text === "string" ? option.text : "",
      isCorrect: option.isCorrect === true,
    }
  })

  if (!options.some(option => option.isCorrect)) {
    return { ok: false, error: { code: "questionNoCorrectAnswer", position } }
  }

  return {
    ok: true,
    question: {
      id:
        typeof question.id === "string" && question.id.trim() !== ""
          ? question.id
          : `q${String(position)}`,
      title: typeof question.title === "string" ? question.title : "",
      options,
    },
  }
}

const normalizeFlashcard = (raw: unknown) => {
  const card = raw as Partial<Exercise["flashcards"][number]>
  return {
    en: typeof card.en === "string" ? card.en : "",
    he: typeof card.he === "string" ? card.he : "",
    trans: typeof card.trans === "string" ? card.trans : "",
  }
}

/**
 * The original appended a timestamp so re-importing never silently
 * overwrote an existing exercise.
 */
const resolveExerciseId = (candidate: Partial<Exercise>, now: number) => {
  const baseId =
    typeof candidate.exerciseId === "string" &&
    candidate.exerciseId.trim() !== ""
      ? candidate.exerciseId
      : "exercise"
  return `${baseId}_${String(now)}`
}

/**
 * Validates and normalizes pasted exercise JSON.
 *
 * Ported from `loadContentFromJSONInput` (`Unseen New.html:2068`), which
 * required `paragraphs` + `questions` + `flashcards` and generated an
 * `exerciseId` when one was missing. `now` is passed in to keep this pure.
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

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: { code: "exerciseNotObject" } }
  }

  const candidate = parsed as Partial<Exercise>

  if (
    !isStringArray(candidate.paragraphs) ||
    candidate.paragraphs.length === 0
  ) {
    return { ok: false, error: { code: "exerciseMissingParagraphs" } }
  }

  if (!Array.isArray(candidate.questions)) {
    return { ok: false, error: { code: "exerciseMissingQuestions" } }
  }

  if (!Array.isArray(candidate.flashcards)) {
    return { ok: false, error: { code: "exerciseMissingFlashcards" } }
  }

  const questions: Question[] = []
  for (const [index, rawQuestion] of candidate.questions.entries()) {
    const result = normalizeQuestion(rawQuestion, index + 1)
    if (!result.ok) {
      return result
    }
    questions.push(result.question)
  }

  const flashcards = candidate.flashcards.map(normalizeFlashcard)

  return {
    ok: true,
    exercise: {
      // Left empty rather than given a translated default: the page renders a
      // localized heading when this is blank.
      title: typeof candidate.title === "string" ? candidate.title : "",
      subtitle:
        typeof candidate.subtitle === "string" ? candidate.subtitle : "",
      exerciseId: resolveExerciseId(candidate, now),
      paragraphs: candidate.paragraphs,
      questions,
      flashcards,
    },
  }
}
