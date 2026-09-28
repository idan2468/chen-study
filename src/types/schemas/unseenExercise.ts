import { z } from "zod"
import type {
  Flashcard,
  Question,
  QuestionOption,
  UnseenExercise,
} from "@/types/unseenExercise"

type ExerciseContent = Omit<
  UnseenExercise,
  "answers" | "highlights" | "flashcardProgress"
>

const hasCorrectOption = (question: { options: { isCorrect?: boolean }[] }) =>
  question.options.some(option => option.isCorrect === true)

const CORRECT_OPTION_ISSUE = {
  error: "At least one option must be marked correct",
  path: ["options"],
}

const questionOptionSchema = z.object({
  text: z.string().min(1),
  isCorrect: z.boolean(),
}) satisfies z.ZodType<QuestionOption>

const questionFields = {
  id: z.string().trim().min(1),
  title: z.string().min(1),
}

const questionSchema = z
  .object({ ...questionFields, options: z.array(questionOptionSchema).min(1) })
  .refine(hasCorrectOption, CORRECT_OPTION_ISSUE) satisfies z.ZodType<Question>

const flashcardSchema = z.object({
  en: z.string().min(1),
  he: z.string().min(1),
  trans: z.string().min(1),
}) satisfies z.ZodType<Flashcard>

const exerciseFields = {
  title: z.string().min(1),
  exerciseId: z.string().trim().min(1),
  paragraphs: z.array(z.string()).min(1),
  flashcards: z.array(flashcardSchema).min(1),
}

/** Exercise content as the app stores it, after import normalization. */
export const exerciseContentSchema = z.object({
  ...exerciseFields,
  subtitle: z.string(),
  questions: z.array(questionSchema).min(1),
}) satisfies z.ZodType<ExerciseContent>

/* ------------------- import format (normalized below) ------------------- */

const rawQuestionSchema = z
  .object({
    ...questionFields,
    options: z
      .array(questionOptionSchema.extend({ isCorrect: z.boolean().optional() }))
      .min(1),
  })
  .refine(hasCorrectOption, CORRECT_OPTION_ISSUE)

const rawExerciseSchema = z.object({
  ...exerciseFields,
  subtitle: z.string().optional(),
  questions: z.array(rawQuestionSchema).min(1),
})

const normalizeQuestion = (
  question: z.infer<typeof rawQuestionSchema>,
): Question => ({
  id: question.id,
  title: question.title,
  options: question.options.map(option => ({
    text: option.text,
    isCorrect: option.isCorrect === true,
  })),
})

export const unseenExercisesSchema = z
  .array(rawExerciseSchema)
  .min(1)
  .transform(exercises =>
    exercises.map((exercise): UnseenExercise => ({
      title: exercise.title,
      subtitle: exercise.subtitle ?? "",
      exerciseId: exercise.exerciseId,
      paragraphs: exercise.paragraphs,
      questions: exercise.questions.map(normalizeQuestion),
      flashcards: exercise.flashcards,
      answers: [],
      highlights: [],
      flashcardProgress: [],
    })),
  )
