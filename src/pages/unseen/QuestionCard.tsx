import { Alert, Button, Group, Paper, Stack, Text } from "@mantine/core"
import { useTranslation } from "react-i18next"
import { SpeakButton } from "@/components/SpeakButton/SpeakButton"
import type { AnswerRecord, Question } from "@/types/unseenExercise"
import classes from "./QuestionCard.module.css"

export type QuestionCardProps = {
  question: Question
  optionOrder?: readonly number[]
  answer: Omit<AnswerRecord, "questionId"> | undefined
  onAnswer: (selected: number, correct: boolean) => void
}

/**
 * One multiple-choice question.
 *
 * Replaces the imperative question building inside `renderExerciseUI` and
 * `checkAnswer` (`Unseen New.html:1446-1572`), which coloured options by poking
 * `style.backgroundColor` on every sibling button.
 */
const optionText = (text: string, displayIndex: number) => {
  const content = text.replace(/^\s*(?:[a-z]\)|\d+[.)])\s*/i, "")
  const label =
    displayIndex < 26
      ? String.fromCharCode("a".charCodeAt(0) + displayIndex)
      : String(displayIndex + 1)
  return `${label}) ${content}`
}

export const QuestionCard = ({
  question,
  optionOrder,
  answer,
  onAnswer,
}: QuestionCardProps) => {
  const { t } = useTranslation()
  const displayedOptions = (
    optionOrder ?? question.options.map((_, index) => index)
  ).flatMap((originalIndex, displayIndex) => {
    const option = question.options[originalIndex]
    return option
      ? [{ option, originalIndex, text: optionText(option.text, displayIndex) }]
      : []
  })

  return (
    <Paper withBorder radius="md" p="md" w="100%">
      <Stack gap="sm">
        <Group gap="xs" align="flex-start" wrap="nowrap">
          <SpeakButton
            ownerId={`q:${question.id}`}
            text={[
              { text: question.title },
              ...displayedOptions.map(option => ({ text: option.text })),
            ]}
            label={t("unseen.speakQuestion")}
            size="md"
          />
          {/* Question text is author-supplied; direction comes from the text. */}
          <Text dir="auto" fw={600} className={classes.questionText}>
            {question.title}
          </Text>
        </Group>

        <Stack gap="xs">
          {displayedOptions.map(
            ({ option, originalIndex, text }, displayIndex) => {
              const isSelected = answer?.selected === originalIndex

              return (
                <Group key={originalIndex} gap="xs" wrap="nowrap">
                  <SpeakButton
                    ownerId={`opt:${question.id}:${String(originalIndex)}`}
                    text={text}
                    label={t("unseen.speakOption", {
                      number: displayIndex + 1,
                    })}
                    size="sm"
                    variant="subtle"
                  />
                  <Button
                    variant={isSelected ? "filled" : "default"}
                    color={
                      isSelected
                        ? option.isCorrect
                          ? "success"
                          : "danger"
                        : undefined
                    }
                    justify="flex-start"
                    fullWidth
                    dir="ltr"
                    classNames={{ label: classes.optionLabel }}
                    aria-pressed={isSelected}
                    onClick={() => {
                      onAnswer(originalIndex, option.isCorrect)
                    }}
                  >
                    {text}
                  </Button>
                </Group>
              )
            },
          )}
        </Stack>

        {answer ? (
          <Alert color={answer.correct ? "success" : "danger"} variant="light">
            {answer.correct
              ? t("unseen.answerCorrect")
              : t("unseen.answerIncorrect")}
          </Alert>
        ) : null}
      </Stack>
    </Paper>
  )
}
