/** Content model for the Unseen reading-practice page. */

import type { VersionedValue } from "@/types/versionedValue"

export type QuestionOption = {
  /** English, prefixed `a) `, `b) ` ... in the built-in data. */
  text: string
  isCorrect: boolean
}

export type Question = {
  id: string
  /** Hebrew question text. */
  title: string
  options: QuestionOption[]
}

export type Flashcard = {
  en: string
  /** Hebrew meaning. */
  he: string
  /** Hebrew transliteration. */
  trans: string
}

export type AnswerRecord = {
  questionId: string
  selected: number
  correct: boolean
}

export type HighlightRecord = {
  word: string
}

export type FlashcardProgressRecord = {
  word: string
  isKnown: boolean
}

export type UnseenExercise = {
  title: string
  subtitle: string
  exerciseId: string
  paragraphs: string[]
  questions: Question[]
  flashcards: Flashcard[]
  answers: VersionedValue<AnswerRecord>[]
  highlights: VersionedValue<HighlightRecord>[]
  flashcardProgress: VersionedValue<FlashcardProgressRecord>[]
}
