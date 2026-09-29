import type { VersionedValue } from "@/types/versionedValue"
import {
  tombstoneValue,
  findLiveValue,
  INITIAL_UPDATED_AT,
  liveValues,
  markDeleted,
  mergeVersionedArrays,
  pickNewer,
  upsertValue,
  setValueIfChanged,
  toVersionedValue,
} from "@/utils/sync/versionedValue"

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

  upsertValue(values, matchesWord("HAT"), { word: "HAT", note: "new" }, LATER)

  expect(values[0]).toStrictEqual(
    toVersionedValue({ word: "HAT", note: "new" }, LATER),
  )
})

test("appends new and revived entries at the end", () => {
  const values = entries()

  upsertValue(values, matchesWord("FOX"), { word: "FOX" }, LATER)
  upsertValue(values, matchesWord("DOG"), { word: "DOG" }, LATER)

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

  tombstoneValue(values, matchesWord("HAT"), LATER)
  tombstoneValue(values, matchesWord("FOX"), LATER)
  tombstoneValue(values, matchesWord("DOG"), LATER)

  expect(values).toStrictEqual([
    markDeleted(toVersionedValue({ word: "HAT" }, EARLIER), LATER),
    markDeleted(toVersionedValue({ word: "FOX" }, EARLIER), EARLIER),
    toVersionedValue({ word: "CAT" }, EARLIER),
  ])
})

test("stamps a scalar only when its value changes", () => {
  const index = toVersionedValue(2, EARLIER)

  setValueIfChanged(index, 2, LATER)
  expect(index).toStrictEqual(toVersionedValue(2, EARLIER))

  setValueIfChanged(index, 3, LATER)
  expect(index).toStrictEqual(toVersionedValue(3, LATER))
})

describe("pickNewer", () => {
  test("keeps whichever side was updated later", () => {
    const earlier = toVersionedValue("a", EARLIER)
    const later = toVersionedValue("b", LATER)

    expect(pickNewer(later, earlier)).toBe(later)
    expect(pickNewer(earlier, later)).toBe(later)
  })

  test("compares instants, not strings, across offsets", () => {
    const winterLater = toVersionedValue(
      "winter",
      "2026-03-27T02:30:00.000+02:00",
    )
    const summerEarlier = toVersionedValue(
      "summer",
      "2026-03-27T03:10:00.000+03:00",
    )

    expect(pickNewer(winterLater, summerEarlier)).toBe(winterLater)
  })

  test("lets Drive win a tie, including a same-time deletion", () => {
    const local = toVersionedValue("local", LATER)
    const remote = toVersionedValue("remote", LATER)
    const localTombstone = markDeleted(local, LATER)

    expect(pickNewer(local, remote)).toBe(remote)
    expect(pickNewer(localTombstone, remote)).toBe(remote)
  })

  test("lets a later value revive an older tombstone", () => {
    const tombstone = markDeleted(toVersionedValue("x", EARLIER), EARLIER)
    const revived = toVersionedValue("x", LATER)

    expect(pickNewer(tombstone, revived)).toBe(revived)
    expect(pickNewer(revived, tombstone)).toBe(revived)
  })

  test("lets a later tombstone beat an older live value", () => {
    const live = toVersionedValue("x", EARLIER)
    const tombstone = markDeleted(live, LATER)

    expect(pickNewer(live, tombstone)).toBe(tombstone)
    expect(pickNewer(tombstone, live)).toBe(tombstone)
  })
})

describe("mergeVersionedArrays", () => {
  const getWord = (value: Word) => value.word
  const words = (merged: VersionedValue<Word>[]) =>
    merged.map(entry => entry.value.word)

  test("keeps Drive's order, then local-only entries in local order", () => {
    const local = [
      toVersionedValue({ word: "DOG" }, EARLIER),
      toVersionedValue({ word: "CAT" }, EARLIER),
      toVersionedValue({ word: "EMU" }, EARLIER),
    ]
    const remote = [
      toVersionedValue({ word: "CAT" }, EARLIER),
      toVersionedValue({ word: "HAT" }, EARLIER),
    ]

    expect(words(mergeVersionedArrays(local, remote, getWord))).toStrictEqual([
      "CAT",
      "HAT",
      "DOG",
      "EMU",
    ])
  })

  test("resolves shared IDs by newest-wins and keeps tombstones", () => {
    const local = [
      toVersionedValue({ word: "HAT", note: "local" }, LATER),
      markDeleted(toVersionedValue({ word: "FOX" }, EARLIER), LATER),
      markDeleted(toVersionedValue({ word: "CAT" }, EARLIER), EARLIER),
    ]
    const remote = [
      toVersionedValue({ word: "HAT", note: "remote" }, EARLIER),
      toVersionedValue({ word: "FOX" }, EARLIER),
    ]

    expect(mergeVersionedArrays(local, remote, getWord)).toStrictEqual([
      toVersionedValue({ word: "HAT", note: "local" }, LATER),
      markDeleted(toVersionedValue({ word: "FOX" }, EARLIER), LATER),
      markDeleted(toVersionedValue({ word: "CAT" }, EARLIER), EARLIER),
    ])
  })

  test("uses the given resolver for IDs present on both sides", () => {
    const local = [toVersionedValue({ word: "HAT", note: "local" }, EARLIER)]
    const remote = [toVersionedValue({ word: "HAT", note: "remote" }, EARLIER)]

    const merged = mergeVersionedArrays(
      local,
      remote,
      getWord,
      localEntry => localEntry,
    )

    expect(merged).toStrictEqual(local)
  })

  test("returns the other side when one is empty", () => {
    const values = entries()

    expect(mergeVersionedArrays(values, [], getWord)).toStrictEqual(values)
    expect(mergeVersionedArrays([], values, getWord)).toStrictEqual(values)
  })
})
