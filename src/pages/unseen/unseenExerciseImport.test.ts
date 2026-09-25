import { at, expectFailure, expectOk, omitKey } from "@test/helpers"
import { parseUnseenExerciseJson } from "./unseenExerciseImport"

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

const parse = (value: unknown) => parseUnseenExerciseJson(JSON.stringify(value))

test("accepts a single exercise object", () => {
  const { exercises } = expectOk(parse(valid))

  expect(exercises).toHaveLength(1)
  expect(at(exercises, 0).paragraphs).toStrictEqual(["A cat sat."])
  expect(at(exercises, 0).flashcards).toHaveLength(1)
})

test("accepts an array of exercises", () => {
  expect(expectOk(parse([valid, valid])).exercises).toHaveLength(2)
})

test("preserves supplied ids so re-importing can replace an exercise", () => {
  expect(
    expectOk(parse([valid, valid])).exercises.map(e => e.exerciseId),
  ).toStrictEqual(["mine", "mine"])
})

describe("rejections", () => {
  test("malformed JSON", () => {
    expect(expectFailure(parseUnseenExerciseJson("{ nope")).error.code).toBe(
      "invalidJson",
    )
  })

  test.each([
    ["an empty array", []],
    ["a non-object entry", ["nope"]],
    ["a missing exercise id", omitKey(valid, "exerciseId")],
    ["missing paragraphs", omitKey(valid, "paragraphs")],
    ["missing questions", omitKey(valid, "questions")],
    ["missing flashcards", omitKey(valid, "flashcards")],
    ["empty paragraphs", { ...valid, paragraphs: [] }],
    ["empty questions", { ...valid, questions: [] }],
    ["empty flashcards", { ...valid, flashcards: [] }],
    ["a missing exercise title", omitKey(valid, "title")],
    [
      "a question with no id",
      {
        ...valid,
        questions: [{ title: "?", options: [{ text: "a", isCorrect: true }] }],
      },
    ],
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
  ])("%s", (_, input) => {
    const error = expectFailure(parse(input)).error

    expect(error.code).toBe("invalidShape")
    expect(error).toHaveProperty("debugInfo")
  })
})
