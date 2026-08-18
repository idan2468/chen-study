import { at, expectFailure, expectOk, omitKey } from "../../utils/test-helpers"
import { parseModulesJson } from "./moduleImport"

const NOW = 1_700_000_000_000

const valid = {
  id: "m1",
  tabName: "טאב",
  title: "כותרת",
  rule: "<b>כלל</b>",
  cards: [{ en: "HAT", he: "הַט", meaning: "כובע" }],
}

const parse = (value: unknown) => parseModulesJson(JSON.stringify(value), NOW)

test("accepts a single module object", () => {
  expect(expectOk(parse(valid)).modules).toStrictEqual([valid])
})

test("accepts an array of modules", () => {
  expect(expectOk(parse([valid, valid])).modules).toHaveLength(2)
})

test("generates ids from the timestamp and position when absent", () => {
  const withoutId = omitKey(valid, "id")

  expect(
    expectOk(parse([withoutId, withoutId])).modules.map(m => m.id),
  ).toStrictEqual([`custom_${String(NOW)}_0`, `custom_${String(NOW)}_1`])
})

test("falls back to the title for a missing tab name", () => {
  const { modules } = expectOk(parse(omitKey(valid, "tabName")))

  expect(at(modules, 0).tabName).toBe("כותרת")
})

test("falls back to the id when neither tab name nor title is given", () => {
  // Deliberately not a translated default -- a stored name must not be frozen
  // in whichever language the UI happened to be in.
  const bare = omitKey(omitKey(valid, "tabName"), "title")
  const { modules } = expectOk(parse(bare))

  expect(at(modules, 0).tabName).toBe("m1")
  expect(at(modules, 0).title).toBe("")
})

test("fills in optional card fields rather than rejecting", () => {
  const { modules } = expectOk(parse({ ...valid, cards: [{ en: "HAT" }] }))

  expect(at(at(modules, 0).cards, 0)).toStrictEqual({
    en: "HAT",
    he: "",
    meaning: "",
  })
})

describe("rejections", () => {
  test("malformed JSON", () => {
    expect(expectFailure(parseModulesJson("{ nope", NOW)).error.code).toBe(
      "invalidJson",
    )
  })

  test("missing cards", () => {
    expect(expectFailure(parse(omitKey(valid, "cards"))).error).toStrictEqual({
      code: "moduleMissingCards",
      position: 1,
    })
  })

  test("empty cards", () => {
    expect(expectFailure(parse({ ...valid, cards: [] })).error.code).toBe(
      "moduleMissingCards",
    )
  })

  test("a card with no English word", () => {
    // The error points at the offending card, as the original's message did.
    expect(
      expectFailure(parse({ ...valid, cards: [{ he: "הַט" }] })).error,
    ).toStrictEqual({
      code: "moduleMissingCardWord",
      position: 1,
      cardPosition: 1,
    })
  })

  test("an empty array", () => {
    expect(expectFailure(parse([])).error.code).toBe("noModules")
  })

  test("a non-object entry", () => {
    expect(expectFailure(parse(["nope"])).error.code).toBe("moduleBadShape")
  })
})
