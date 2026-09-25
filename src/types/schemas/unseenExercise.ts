import { z } from "zod"
import type {
  Flashcard,
  Question,
  QuestionOption,
  UnseenExercise,
} from "@/types/unseenExercise"

const rawQuestionOptionSchema = z.object({
  text: z.string().min(1),
  isCorrect: z.boolean().optional(),
})

const rawQuestionSchema = z
  .object({
    id: z.string().trim().min(1),
    title: z.string().min(1),
    options: z.array(rawQuestionOptionSchema).min(1),
  })
  .refine(
    question => question.options.some(option => option.isCorrect === true),
    { error: "At least one option must be marked correct", path: ["options"] },
  )

export const flashcardSchema = z.object({
  en: z.string().min(1),
  he: z.string().min(1),
  trans: z.string().min(1),
}) satisfies z.ZodType<Flashcard>

const rawExerciseSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().optional(),
  exerciseId: z.string().trim().min(1),
  paragraphs: z.array(z.string()).min(1),
  questions: z.array(rawQuestionSchema).min(1),
  flashcards: z.array(flashcardSchema).min(1),
})

const normalizeOption = (
  option: z.infer<typeof rawQuestionOptionSchema>,
): QuestionOption => ({
  text: option.text,
  isCorrect: option.isCorrect === true,
})

const normalizeQuestion = (
  question: z.infer<typeof rawQuestionSchema>,
): Question => ({
  id: question.id,
  title: question.title,
  options: question.options.map(normalizeOption),
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
    })),
  )
