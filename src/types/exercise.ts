/** Content model for the Unseen reading-practice page. */

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

export type UnseenExercise = {
  title: string
  subtitle: string
  exerciseId: string
  paragraphs: string[]
  questions: Question[]
  flashcards: Flashcard[]
}

/** `true` = known, `false` = unknown, absent = not yet marked. */
export type FlashcardProgress = Record<string, boolean>

export type AnswerRecord = {
  selected: number
  correct: boolean
}
