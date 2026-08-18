/** Content model for the Modules Practice page. */

export type ModuleCard = {
  /** The English word, uppercase in the built-in data (`HAT`, `FOX`, ...). */
  en: string
  /** Hebrew transliteration with nikud. */
  he: string
  /** Hebrew gloss, sometimes with a parenthetical vowel hint. */
  meaning: string
}

export type PracticeModule = {
  id: string
  /** Short label shown on the tab. */
  tabName: string
  title: string
  /** Author-supplied HTML for the rule box. Rendered as markup, see `RuleBox`. */
  rule: string
  cards: ModuleCard[]
}

export type CardStatus = "known" | "unknown"

/**
 * Progress is keyed by `card.en` **globally, not per module** -- deliberately
 * inherited from the original app: `HAT` appears in `mod1`, `rev1_2` and
 * `rev1_3`, and marking it known in one marks it in all three.
 */
export type ModulesProgress = Record<string, CardStatus>
