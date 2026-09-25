import { expectFailure, expectOk, omitKey } from "@test/helpers"
import { parseModulesJson } from "./moduleImport"

const valid = {
  id: "m1",
  tabName: "Tab",
  title: "Title",
  rule: "<b>Rule</b>",
  cards: [{ en: "HAT", he: "hat", meaning: "hat" }],
}

const parse = (value: unknown) => parseModulesJson(JSON.stringify(value))

test("accepts a single module object", () => {
  expect(expectOk(parse(valid)).modules).toStrictEqual([valid])
})

test("accepts an array of modules", () => {
  expect(expectOk(parse([valid, valid])).modules).toHaveLength(2)
})

describe("rejections", () => {
  test("malformed JSON", () => {
    expect(expectFailure(parseModulesJson("{ nope")).error.code).toBe(
      "invalidJson",
    )
  })

  test.each([
    ["an empty array", []],
    ["a non-object entry", ["nope"]],
    ["a missing id", omitKey(valid, "id")],
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
