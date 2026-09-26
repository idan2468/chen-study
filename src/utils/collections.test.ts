import { hasWord, keepFinalOccurrencesBy } from "./collections"

test("keeps the final value for each key", () => {
  const values = [
    { id: "x", value: "first x" },
    { id: "y", value: "only y" },
    { id: "x", value: "final x" },
  ]

  expect(keepFinalOccurrencesBy(values, value => value.id)).toStrictEqual([
    { id: "x", value: "final x" },
    { id: "y", value: "only y" },
  ])
})

test("does not mutate the input", () => {
  const values = [
    { id: "x", value: "first" },
    { id: "x", value: "final" },
  ]

  keepFinalOccurrencesBy(values, value => value.id)

  expect(values).toStrictEqual([
    { id: "x", value: "first" },
    { id: "x", value: "final" },
  ])
})

test("matches records by word", () => {
  expect(hasWord("HAT")({ word: "HAT" })).toBe(true)
  expect(hasWord("HAT")({ word: "hat" })).toBe(false)
})
