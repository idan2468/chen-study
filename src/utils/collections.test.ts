import { keepFinalOccurrencesBy } from "./collections"

test("keeps each final occurrence in the order those occurrences appeared", () => {
  const values = [
    { id: "x", value: "first x" },
    { id: "y", value: "only y" },
    { id: "x", value: "final x" },
  ]

  expect(keepFinalOccurrencesBy(values, value => value.id)).toStrictEqual([
    { id: "y", value: "only y" },
    { id: "x", value: "final x" },
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
