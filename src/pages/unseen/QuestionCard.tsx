import { Alert, Button, Group, Paper, Stack, Text } from "@mantine/core"
import { useTranslation } from "react-i18next"
import { SpeakButton } from "@/components/SpeakButton/SpeakButton"
import type { AnswerRecord, Question } from "@/types/exercise"
import classes from "./QuestionCard.module.css"

export type QuestionCardProps = {
  question: Question
  answer: AnswerRecord | undefined
  onAnswer: (selected: number, correct: boolean) => void
}

/**
 * One multiple-choice question.
 *
 * Replaces the imperative question building inside `renderExerciseUI` and
 * `checkAnswer` (`Unseen New.html:1446-1572`), which coloured options by poking
 * `style.backgroundColor` on every sibling button.
 */
export const QuestionCard = ({
  question,
  answer,
  onAnswer,
}: QuestionCardProps) => {
  const { t } = useTranslation()

  return (
    <Paper withBorder radius="md" p="md" w="100%">
      <Stack gap="sm">
        <Group gap="xs" align="flex-start" wrap="nowrap">
          <SpeakButton
            ownerId={`q:${question.id}`}
            text={[
              { text: question.title },
              ...question.options.map(option => ({ text: option.text })),
            ]}
            label={t("unseen.speakQuestion")}
            size="sm"
          />
          {/* Question text is author-supplied; direction comes from the text. */}
          <Text dir="auto" fw={600} className={classes.questionText}>
            {question.title}
          </Text>
        </Group>

        <Stack gap="xs">
          {question.options.map((option, index) => {
            const isSelected = answer?.selected === index

            return (
              <Group key={option.text} gap="xs" wrap="nowrap">
                <SpeakButton
                  ownerId={`opt:${question.id}:${String(index)}`}
                  text={option.text}
                  label={t("unseen.speakOption", { number: index + 1 })}
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
                  onClick={() => {
                    onAnswer(index, option.isCorrect)
                  }}
                >
                  {option.text}
                </Button>
              </Group>
            )
          })}
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
