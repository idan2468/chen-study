import { at, expectFailure, expectOk, omitKey } from "@test/helpers"
import { parseExerciseJson } from "./exerciseImport"

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

const parse = (value: unknown) => parseExerciseJson(JSON.stringify(value), NOW)

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

test("an exercise with no questions or flashcards is still valid", () => {
  expect(parse({ ...valid, questions: [], flashcards: [] }).ok).toBe(true)
})

describe("rejections", () => {
  test("malformed JSON", () => {
    expect(expectFailure(parseExerciseJson("{ nope", NOW)).error.code).toBe(
      "invalidJson",
    )
  })

  test("an array instead of a single exercise", () => {
    expect(expectFailure(parse([valid])).error.code).toBe("exerciseNotObject")
  })

  test("a missing paragraphs field", () => {
    expect(expectFailure(parse(omitKey(valid, "paragraphs"))).error.code).toBe(
      "exerciseMissingParagraphs",
    )
  })

  test("a missing questions field", () => {
    expect(expectFailure(parse(omitKey(valid, "questions"))).error.code).toBe(
      "exerciseMissingQuestions",
    )
  })

  test("a missing flashcards field", () => {
    expect(expectFailure(parse(omitKey(valid, "flashcards"))).error.code).toBe(
      "exerciseMissingFlashcards",
    )
  })

  test("empty paragraphs", () => {
    expect(expectFailure(parse({ ...valid, paragraphs: [] })).error.code).toBe(
      "exerciseMissingParagraphs",
    )
  })

  test("a question with no correct answer", () => {
    expect(
      expectFailure(
        parse({
          ...valid,
          questions: [
            {
              id: "q1",
              title: "?",
              options: [{ text: "a", isCorrect: false }],
            },
          ],
        }),
      ).error,
    ).toStrictEqual({ code: "questionNoCorrectAnswer", position: 1 })
  })

  test("a question with no options", () => {
    expect(
      expectFailure(parse({ ...valid, questions: [{ id: "q1", title: "?" }] }))
        .error,
    ).toStrictEqual({ code: "questionMissingOptions", position: 1 })
  })
})
