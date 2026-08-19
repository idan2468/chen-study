import type { ModuleCard, PracticeModule } from "@/types/module"

/**
 * Why a code and not a message: these parsers are pure and locale-agnostic, so
 * they report *what* went wrong and leave the wording to the caller's `t()`.
 * The values map onto keys under `importErrors` in the translation catalogues.
 */
export type ModuleImportError =
  | { code: "invalidJson" }
  | { code: "noModules" }
  | { code: "moduleBadShape"; position: number }
  | { code: "moduleMissingCards"; position: number }
  | { code: "moduleMissingCardWord"; position: number; cardPosition: number }

export type ModuleImportResult =
  | { ok: true; modules: PracticeModule[] }
  | { ok: false; error: ModuleImportError }

type CardResult =
  { ok: true; card: ModuleCard } | { ok: false; error: ModuleImportError }

const normalizeCard = (
  raw: unknown,
  position: number,
  cardPosition: number,
): CardResult => {
  const card = raw as Partial<ModuleCard>

  if (typeof card.en !== "string" || card.en.trim() === "") {
    return {
      ok: false,
      error: { code: "moduleMissingCardWord", position, cardPosition },
    }
  }

  return {
    ok: true,
    card: {
      en: card.en.trim(),
      he: typeof card.he === "string" ? card.he : "",
      meaning: typeof card.meaning === "string" ? card.meaning : "",
    },
  }
}

/** Auto-generated when absent, as in the original. */
const resolveModuleId = (
  candidate: Partial<PracticeModule>,
  index: number,
  now: number,
) =>
  typeof candidate.id === "string" && candidate.id.trim() !== ""
    ? candidate.id
    : `custom_${String(now)}_${String(index)}`

/**
 * Falls back to the title, then the id. Deliberately not a translated
 * default: a module name is content, and baking one language's wording into
 * stored data would strand it when the UI language changes. The page
 * supplies a localized heading when `title` is empty.
 */
const resolveTabName = (
  candidate: Partial<PracticeModule>,
  title: string,
  id: string,
) =>
  typeof candidate.tabName === "string" && candidate.tabName.trim() !== ""
    ? candidate.tabName
    : title || id

/**
 * Validates and normalizes pasted module JSON.
 *
 * Replaces `loadJSON` / `loadSingleModule` / `loadMultipleModules`
 * (`Modules Practice.html:1454-1537`), which each independently re-read and
 * re-parsed the same textarea, plus their shared `_commitModules` validator.
 *
 * `now` is passed in rather than read from `Date.now()` so the function stays
 * pure and testable (the original generated ids inline).
 */
export const parseModulesJson = (
  text: string,
  now: number,
): ModuleImportResult => {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, error: { code: "invalidJson" } }
  }

  // The original accepted either a single module object or an array of them.
  const rawModules = Array.isArray(parsed) ? parsed : [parsed]

  if (rawModules.length === 0) {
    return { ok: false, error: { code: "noModules" } }
  }

  const modules: PracticeModule[] = []

  for (const [index, raw] of rawModules.entries()) {
    const position = index + 1

    if (typeof raw !== "object" || raw === null) {
      return { ok: false, error: { code: "moduleBadShape", position } }
    }

    const candidate = raw as Partial<PracticeModule>

    if (!Array.isArray(candidate.cards) || candidate.cards.length === 0) {
      return { ok: false, error: { code: "moduleMissingCards", position } }
    }

    const cards: ModuleCard[] = []
    for (const [cardIndex, rawCard] of candidate.cards.entries()) {
      const result = normalizeCard(rawCard, position, cardIndex + 1)
      if (!result.ok) {
        return result
      }
      cards.push(result.card)
    }

    const title =
      typeof candidate.title === "string" && candidate.title.trim() !== ""
        ? candidate.title
        : ""
    const id = resolveModuleId(candidate, index, now)

    modules.push({
      id,
      tabName: resolveTabName(candidate, title, id),
      title,
      rule: typeof candidate.rule === "string" ? candidate.rule : "",
      cards,
    })
  }

  return { ok: true, modules }
}
