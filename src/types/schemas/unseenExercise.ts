import { z } from "zod"
import type {
  Flashcard,
  Question,
  QuestionOption,
  UnseenExercise,
} from "@/types/unseenExercise"

/**
 * `isCorrect` is the only optional option field -- defaulted to `false` via
 * `.transform()` on `rawQuestionSchema` below.
 */
const rawQuestionOptionSchema = z.object({
  text: z.string().min(1),
  isCorrect: z.boolean().optional(),
})

/**
 * `id` is optional on the raw JSON -- numbered `q<position>` via
 * `.transform()` on `buildUnseenExercisesSchema` below, since numbering needs
 * the question's position within the exercise, not just within itself.
 */
const rawQuestionSchema = z
  .object({
    id: z.string().trim().min(1).optional(),
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
  exerciseId: z.string().trim().min(1).optional(),
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
  position: number,
): Question => ({
  id: question.id ?? `q${String(position)}`,
  title: question.title,
  options: question.options.map(normalizeOption),
})

/**
 * Validates and normalizes an array of pasted exercises into
 * `UnseenExercise`s, ready to add to the store. `now` is passed in (rather
 * than read from `Date.now()`) so parsing stays pure and testable -- the
 * original appended a timestamp to the id so a re-import never silently
 * overwrote an existing exercise.
 */
export const buildUnseenExercisesSchema = (now: number) =>
  z
    .array(rawExerciseSchema)
    .min(1)
    .transform(exercises =>
      exercises.map((exercise, exerciseIndex): UnseenExercise => ({
        title: exercise.title,
        subtitle: exercise.subtitle ?? "",
        exerciseId: `${exercise.exerciseId ?? "exercise"}_${String(now)}_${String(exerciseIndex)}`,
        paragraphs: exercise.paragraphs,
        questions: exercise.questions.map((question, index) =>
          normalizeQuestion(question, index + 1),
        ),
        flashcards: exercise.flashcards,
      })),
    )
