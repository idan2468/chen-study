import type { VersionedValue } from "@/types/versionedValue"
import {
  deleteValue,
  findLiveValue,
  INITIAL_UPDATED_AT,
  liveValues,
  markDeleted,
  putValue,
  setVersionedValue,
  toVersionedValue,
} from "./versionedValue"

type Word = { word: string; note?: string }

const EARLIER = "2026-09-26T11:00:00.000+03:00"
const LATER = "2026-09-26T12:00:00.000+03:00"

const matchesWord = (word: string) => (value: Word) => value.word === word

const entries = (): VersionedValue<Word>[] => [
  toVersionedValue({ word: "HAT" }, EARLIER),
  markDeleted(toVersionedValue({ word: "FOX" }, EARLIER), EARLIER),
  toVersionedValue({ word: "CAT" }, EARLIER),
]

test("defaults to the epoch in Israel time", () => {
  expect(INITIAL_UPDATED_AT).toBe("1970-01-01T02:00:00.000+02:00")
  expect(toVersionedValue("x")).toStrictEqual({
    value: "x",
    updatedAt: INITIAL_UPDATED_AT,
    deleted: false,
  })
})

test("marks an entry deleted at the given time and keeps its value", () => {
  const entry = toVersionedValue({ word: "HAT" }, EARLIER)

  expect(markDeleted(entry, LATER)).toStrictEqual({
    value: { word: "HAT" },
    updatedAt: LATER,
    deleted: true,
  })
  expect(entry.deleted).toBe(false)
})

test("reads only live values", () => {
  expect(liveValues(entries())).toStrictEqual([
    { word: "HAT" },
    { word: "CAT" },
  ])
  expect(findLiveValue(entries(), matchesWord("FOX"))).toBeUndefined()
  expect(findLiveValue(entries(), matchesWord("CAT"))).toStrictEqual({
    word: "CAT",
  })
})

test("replaces a live entry in place", () => {
  const values = entries()

  putValue(values, matchesWord("HAT"), { word: "HAT", note: "new" }, LATER)

  expect(values[0]).toStrictEqual(
    toVersionedValue({ word: "HAT", note: "new" }, LATER),
  )
})

test("appends new and revived entries at the end", () => {
  const values = entries()

  putValue(values, matchesWord("FOX"), { word: "FOX" }, LATER)
  putValue(values, matchesWord("DOG"), { word: "DOG" }, LATER)

  expect(values.map(entry => entry.value.word)).toStrictEqual([
    "HAT",
    "CAT",
    "FOX",
    "DOG",
  ])
  expect(values[2]).toStrictEqual(toVersionedValue({ word: "FOX" }, LATER))
})

test("tombstones a live entry and ignores missing or deleted ones", () => {
  const values = entries()

  deleteValue(values, matchesWord("HAT"), LATER)
  deleteValue(values, matchesWord("FOX"), LATER)
  deleteValue(values, matchesWord("DOG"), LATER)

  expect(values).toStrictEqual([
    markDeleted(toVersionedValue({ word: "HAT" }, EARLIER), LATER),
    markDeleted(toVersionedValue({ word: "FOX" }, EARLIER), EARLIER),
    toVersionedValue({ word: "CAT" }, EARLIER),
  ])
})

test("stamps a scalar only when its value changes", () => {
  const index = toVersionedValue(2, EARLIER)

  setVersionedValue(index, 2, LATER)
  expect(index).toStrictEqual(toVersionedValue(2, EARLIER))

  setVersionedValue(index, 3, LATER)
  expect(index).toStrictEqual(toVersionedValue(3, LATER))
})
