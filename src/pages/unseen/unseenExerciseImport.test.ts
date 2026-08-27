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

test("accepts a valid exercise", () => {
  const { exercise } = expectOk(parse(valid))

  expect(exercise.paragraphs).toStrictEqual(["A cat sat."])
  expect(exercise.flashcards).toHaveLength(1)
})

test("appends a timestamp to the id so a re-import never overwrites", () => {
  expect(expectOk(parse(valid)).exercise.exerciseId).toBe(`mine_${String(NOW)}`)
})

test("generates an id when none is supplied", () => {
  expect(
    expectOk(parse(omitKey(valid, "exerciseId"))).exercise.exerciseId,
  ).toBe(`exercise_${String(NOW)}`)
})

test("numbers questions that arrive without an id", () => {
  const { exercise } = expectOk(
    parse({
      ...valid,
      questions: [{ title: "?", options: [{ text: "a", isCorrect: true }] }],
    }),
  )

  expect(at(exercise.questions, 0).id).toBe("q1")
})

describe("rejections", () => {
  test("malformed JSON", () => {
    expect(
      expectFailure(parseUnseenExerciseJson("{ nope", NOW)).error.code,
    ).toBe("invalidJson")
  })

  // Every other failure -- an array instead of an object, a missing or
  // mistyped field, an empty array, a question with no correct option --
  // collapses to one code. The `debugInfo` dump (raw zod issues) is what
  // points at the offending field, not the code itself.
  test.each([
    ["an array instead of a single exercise", [valid]],
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
  ])("%s", (_, input) => {
    const error = expectFailure(parse(input)).error

    expect(error.code).toBe("invalidShape")
    expect(error).toHaveProperty("debugInfo")
  })
})
