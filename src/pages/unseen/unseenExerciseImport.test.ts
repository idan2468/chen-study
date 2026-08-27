import { at, expectFailure, expectOk, omitKey } from "@test/helpers"
import { parseUnseenExerciseJson } from "./unseenExerciseImport"

const NOW = 1_700_000_000_000

const valid = {
  title: "Title",
  subtitle: "Subtitle",
  exerciseId: "mine",
  paragraphs: ["A cat sat."],
  questions: [
    {
      id: "q1",
      title: "Question?",
      options: [
        { text: "a) no", isCorrect: false },
        { text: "b) yes", isCorrect: true },
      ],
    },
  ],
  flashcards: [{ en: "Cat", he: "cat", trans: "kat" }],
}

const parse = (value: unknown) =>
  parseUnseenExerciseJson(JSON.stringify(value), NOW)

test("accepts a single exercise object", () => {
  const { exercises } = expectOk(parse(valid))

  expect(exercises).toHaveLength(1)
  expect(at(exercises, 0).paragraphs).toStrictEqual(["A cat sat."])
  expect(at(exercises, 0).flashcards).toHaveLength(1)
})

test("accepts an array of exercises", () => {
  expect(expectOk(parse([valid, valid])).exercises).toHaveLength(2)
})

test("appends a timestamp and position to the id so a re-import never overwrites", () => {
  expect(
    expectOk(parse([valid, valid])).exercises.map(e => e.exerciseId),
  ).toStrictEqual([`mine_${String(NOW)}_0`, `mine_${String(NOW)}_1`])
})

test("generates an id when none is supplied", () => {
  expect(
    at(expectOk(parse(omitKey(valid, "exerciseId"))).exercises, 0).exerciseId,
  ).toBe(`exercise_${String(NOW)}_0`)
})

test("numbers questions that arrive without an id", () => {
  const { exercises } = expectOk(
    parse({
      ...valid,
      questions: [{ title: "?", options: [{ text: "a", isCorrect: true }] }],
    }),
  )

  expect(at(at(exercises, 0).questions, 0).id).toBe("q1")
})

describe("rejections", () => {
  test("malformed JSON", () => {
    expect(
      expectFailure(parseUnseenExerciseJson("{ nope", NOW)).error.code,
    ).toBe("invalidJson")
  })

  // Every other failure -- a non-object entry, a missing or mistyped field,
  // an empty array, a question with no correct option -- collapses to one
  // code. The `debugInfo` dump (raw zod issues) is what points at the
  // offending field, not the code itself.
  test.each([
    ["a non-object entry", ["nope"]],
    ["a missing paragraphs field", omitKey(valid, "paragraphs")],
    ["a missing questions field", omitKey(valid, "questions")],
    ["a missing flashcards field", omitKey(valid, "flashcards")],
    ["empty paragraphs", { ...valid, paragraphs: [] }],
    ["empty questions", { ...valid, questions: [] }],
    ["empty flashcards", { ...valid, flashcards: [] }],
    ["a missing exercise title", omitKey(valid, "title")],
    [
      "a question with no title",
      {
        ...valid,
        questions: [{ id: "q1", options: [{ text: "a", isCorrect: true }] }],
      },
    ],
    [
      "a question with no options",
      { ...valid, questions: [{ id: "q1", title: "?" }] },
    ],
    [
      "an option with no text",
      {
        ...valid,
        questions: [{ id: "q1", title: "?", options: [{ isCorrect: true }] }],
      },
    ],
    [
      "a flashcard missing a field",
      { ...valid, flashcards: [{ en: "Cat", he: "cat" }] },
    ],
    [
      "a question with no correct answer",
      {
        ...valid,
        questions: [
          { id: "q1", title: "?", options: [{ text: "a", isCorrect: false }] },
        ],
      },
    ],
    ["an empty array", []],
  ])("%s", (_, input) => {
    const error = expectFailure(parse(input)).error

    expect(error.code).toBe("invalidShape")
    expect(error).toHaveProperty("debugInfo")
  })
})
