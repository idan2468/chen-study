/** Content model for the Modules Practice page. */

import type { VersionedValue } from "@/types/versionedValue"

export type ModuleCard = {
  /** The English word, uppercase in the built-in data (`HAT`, `FOX`, ...). */
  en: string
  /** Hebrew transliteration with nikud. */
  he: string
  /** Hebrew gloss, sometimes with a parenthetical vowel hint. */
  meaning: string
}

export type ModuleExercise = {
  id: string
  /** Short label shown in the module picker. */
  tabName: string
  title: string
  /** Author-supplied HTML for the rule box. Rendered as markup, see `RuleBox`. */
  rule: string
  cards: ModuleCard[]
}

export enum CardStatus {
  Known = "known",
  Unknown = "unknown",
  None = "none",
}

export type ModuleProgressRecord = {
  word: string
  status: CardStatus
}

export type ModulesProgress = VersionedValue<ModuleProgressRecord>[]
