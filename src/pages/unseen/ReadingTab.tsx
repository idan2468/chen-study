import { useMemo } from "react"
import { Group, Paper, Stack, Switch, Text } from "@mantine/core"
import { IconArrowsShuffle } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { SpeakButton } from "@/components/SpeakButton/SpeakButton"
import { ICON_SIZE } from "@/constants/icons"
import { useIsMobile } from "@/hooks/useIsMobile"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import {
  selectShuffleUnseenAnswers,
  toggleShuffleUnseenAnswers,
} from "@/store/slices/settingsSlice"
import {
  answerQuestion,
  selectAnswers,
  selectCurrentExercise,
} from "@/store/slices/unseenSlice"
import { MAIN_READER_OWNER, ParagraphReader } from "./ParagraphReader"
import { QuestionCard } from "./QuestionCard"

const optionIndexes = (length: number, shuffle: boolean) => {
  const indexes = Array.from({ length }, (_, index) => index)
  if (!shuffle) {
    return indexes
  }
  for (let index = indexes.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const current = indexes[index]
    indexes[index] = indexes[swapIndex] ?? index
    indexes[swapIndex] = current ?? swapIndex
  }
  return indexes
}

export const ReadingTab = () => {
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  const dispatch = useAppDispatch()
  const exercise = useAppSelector(selectCurrentExercise)
  const answers = useAppSelector(selectAnswers)
  const shuffleAnswers = useAppSelector(selectShuffleUnseenAnswers)
  const questionOptionOrders = useMemo(
    () =>
      Object.fromEntries(
        (exercise?.questions ?? []).map(question => [
          question.id,
          optionIndexes(question.options.length, shuffleAnswers),
        ]),
      ),
    [exercise, shuffleAnswers],
  )

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
          {t(isMobile ? "unseen.readingHintTap" : "unseen.readingHint")}
        </Text>
      </Paper>

      <ParagraphReader paragraphs={exercise.paragraphs} />

      <Paper withBorder radius="md" p="sm">
        <Group justify="space-between" gap="sm" wrap="nowrap">
          <Group gap="xs" wrap="nowrap">
            <IconArrowsShuffle size={ICON_SIZE} />
            <Stack gap={0}>
              <Text size="sm" fw={600}>
                {t("unseen.shuffleAnswers")}
              </Text>
              <Text size="xs" c="dimmed">
                {t("unseen.shuffleAnswersHint")}
              </Text>
            </Stack>
          </Group>
          <Switch
            checked={shuffleAnswers}
            onChange={() => dispatch(toggleShuffleUnseenAnswers())}
            aria-label={t("unseen.shuffleAnswers")}
          />
        </Group>
      </Paper>

      <Stack gap="sm">
        {exercise.questions.map(question => (
          <QuestionCard
            key={question.id}
            question={question}
            optionOrder={questionOptionOrders[question.id]}
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
