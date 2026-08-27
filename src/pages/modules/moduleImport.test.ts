import { at, expectFailure, expectOk, omitKey } from "@test/helpers"
import { parseModulesJson } from "./moduleImport"

const NOW = 1_700_000_000_000

const valid = {
  id: "m1",
  tabName: "Tab",
  title: "Title",
  rule: "<b>Rule</b>",
  cards: [{ en: "HAT", he: "hat", meaning: "hat" }],
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

test("id is the only optional field -- everything else must be present", () => {
  const { modules } = expectOk(parse(omitKey(valid, "id")))

  expect(at(modules, 0).id).toBe(`custom_${String(NOW)}_0`)
})

describe("rejections", () => {
  test("malformed JSON", () => {
    expect(expectFailure(parseModulesJson("{ nope", NOW)).error.code).toBe(
      "invalidJson",
    )
  })

  // Every other failure -- an empty array, a non-object entry, a missing or
  // mistyped field -- collapses to one code. The `debugInfo` dump (raw zod
  // issues) is what points at the offending field, not the code itself.
  test.each([
    ["an empty array", []],
    ["a non-object entry", ["nope"]],
    ["missing cards", omitKey(valid, "cards")],
    ["empty cards", { ...valid, cards: [] }],
    ["a card with no English word", { ...valid, cards: [{ he: "hat" }] }],
    ["a missing tab name", omitKey(valid, "tabName")],
    ["a missing title", omitKey(valid, "title")],
    ["a missing rule", omitKey(valid, "rule")],
    [
      "a card with no Hebrew word",
      { ...valid, cards: [{ en: "HAT", meaning: "hat" }] },
    ],
    ["a card with no meaning", { ...valid, cards: [{ en: "HAT", he: "hat" }] }],
  ])("%s", (_, input) => {
    const error = expectFailure(parse(input)).error

    expect(error.code).toBe("invalidShape")
    expect(error).toHaveProperty("debugInfo")
  })
})
