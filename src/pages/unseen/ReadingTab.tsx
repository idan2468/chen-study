import { Group, Paper, Stack, Text } from "@mantine/core"
import { useTranslation } from "react-i18next"
import { SpeakButton } from "@/components/SpeakButton/SpeakButton"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import {
  answerQuestion,
  selectAnswers,
  selectCurrentExercise,
} from "@/store/slices/unseenSlice"
import { MAIN_READER_OWNER, ParagraphReader } from "./ParagraphReader"
import { QuestionCard } from "./QuestionCard"

export const ReadingTab = () => {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const exercise = useAppSelector(selectCurrentExercise)
  const answers = useAppSelector(selectAnswers)

  if (!exercise) {
    return (
      <Text ta="center" py="xl" fw={700}>
        {t("unseen.noExercise")}
      </Text>
    )
  }

  return (
    <Stack gap="md">
      <Paper withBorder radius="md" p="md">
        <Group gap="xs" wrap="nowrap">
          <SpeakButton
            ownerId={MAIN_READER_OWNER}
            text={exercise.paragraphs.map(text => ({
              text,
              lang: "en-US",
            }))}
            label={t("unseen.playAllLabel")}
            size="lg"
          />
          <Text fw={600}>{t("unseen.playAll")}</Text>
        </Group>
      </Paper>

      <Paper withBorder radius="md" p="sm" bg="var(--mantine-color-default)">
        <Text size="sm" c="dimmed">
          {t("unseen.readingHint")}
        </Text>
      </Paper>

      <ParagraphReader paragraphs={exercise.paragraphs} />

      <Stack gap="sm">
        {exercise.questions.map(question => (
          <QuestionCard
            key={question.id}
            question={question}
            answer={answers[question.id]}
            onAnswer={(selected, correct) => {
              dispatch(
                answerQuestion({ questionId: question.id, selected, correct }),
              )
            }}
          />
        ))}
      </Stack>
    </Stack>
  )
}
