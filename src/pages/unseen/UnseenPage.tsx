import { useState } from "react"
import { Container, Group, Stack, Tabs, Text, Title } from "@mantine/core"
import {
  IconBook2,
  IconBooks,
  IconCards,
  IconSettings,
} from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { ICON_SIZE } from "@/constants/icons"
import { importErrorMessage } from "@/i18n/importErrorMessage"
import { confirmDanger, notifyCannotDelete } from "@/utils/confirmModal"
import { DeletableSelect } from "@/components/DeletableSelect/DeletableSelect"
import type { JsonParseResult } from "@/components/JsonLoader/JsonLoader"
import { JsonLoader } from "@/components/JsonLoader/JsonLoader"
import { StatCounts } from "@/components/StatCounts/StatCounts"
import { TopBar } from "@/components/TopBar/TopBar"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import {
  addExercise,
  deleteExercise,
  selectCurrentExercise,
  selectCurrentExerciseId,
  selectExerciseOptions,
  selectFlashcardStats,
  switchExercise,
} from "@/store/slices/unseenSlice"
import { defaultExercise } from "@/data/defaultExercise"
import { FlashcardsTab } from "./FlashcardsTab"
import { ReadingTab } from "./ReadingTab"
import { parseExerciseJson } from "./exerciseImport"

type TabValue = "reading" | "flashcards" | "json"

export const UnseenPage = () => {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const exercise = useAppSelector(selectCurrentExercise)
  const currentId = useAppSelector(selectCurrentExerciseId)
  const options = useAppSelector(selectExerciseOptions)
  const stats = useAppSelector(selectFlashcardStats)

  const [tab, setTab] = useState<TabValue>("reading")

  // The subtitle is the more descriptive label, but it may be an empty string
  // (which is why this is not a `??`).
  const exerciseLabel = exercise
    ? exercise.subtitle.trim() === ""
      ? exercise.title
      : exercise.subtitle
    : ""

  const handleDelete = () => {
    if (options.length <= 1) {
      notifyCannotDelete(
        t("unseen.cannotDeleteTitle"),
        t("unseen.cannotDeleteBody"),
      )
      return
    }

    confirmDanger(t, {
      title: t("unseen.deleteTitle"),
      body: t("unseen.deleteBody", { name: exerciseLabel }),
      confirmLabel: t("common.delete"),
      onConfirm: () => dispatch(deleteExercise(currentId)),
    })
  }

  const handleParseJson = (text: string): JsonParseResult => {
    const result = parseExerciseJson(text, Date.now())
    if (!result.ok) {
      // The parser is locale-agnostic and reports a code; the wording lives in
      // `importErrorMessage`.
      return { ok: false, message: importErrorMessage(t, result.error) }
    }

    dispatch(addExercise(result.exercise))
    // The original jumped back to the reading tab after a successful import.
    setTab("reading")
    return { ok: true, message: t("unseen.jsonLoaded") }
  }

  return (
    <Container size="lg" py="xl">
      <Stack gap="lg">
        <TopBar />

        <Stack gap={4} ta="center">
          {/* Exercise title and subtitle are author-supplied content. */}
          <Title order={1} c="brand" dir="auto">
            {exercise?.title ?? t("unseen.fallbackTitle")}
          </Title>
          <Text c="dimmed" dir="auto">
            {exercise?.subtitle}
          </Text>
        </Stack>

        <DeletableSelect
          data={options}
          value={currentId}
          onChange={id => dispatch(switchExercise(id))}
          onDelete={handleDelete}
          selectLabel={t("unseen.selectExercise")}
          deleteLabel={t("unseen.deleteExercise")}
          leftSection={<IconBooks size={ICON_SIZE} />}
        />

        <Text size="sm" c="dimmed" ta="center">
          {t("unseen.usageHint")}
        </Text>

        <Tabs
          value={tab}
          onChange={value => {
            if (value !== null) {
              setTab(value as TabValue)
            }
          }}
          variant="pills"
          keepMounted={false}
        >
          <Tabs.List grow>
            <Tabs.Tab
              value="reading"
              leftSection={<IconBook2 size={ICON_SIZE} />}
            >
              {t("unseen.tabReading")}
            </Tabs.Tab>
            <Tabs.Tab
              value="flashcards"
              leftSection={<IconCards size={ICON_SIZE} />}
            >
              {t("unseen.tabFlashcards")}
              {stats.total > 0 ? ` (${String(stats.total)})` : ""}
            </Tabs.Tab>
            <Tabs.Tab
              value="json"
              leftSection={<IconSettings size={ICON_SIZE} />}
            >
              {t("unseen.tabJson")}
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="reading" pt="md">
            <ReadingTab />
          </Tabs.Panel>

          <Tabs.Panel value="flashcards" pt="md">
            <FlashcardsTab />
          </Tabs.Panel>

          <Tabs.Panel value="json" pt="md">
            <Group justify="center">
              <Stack gap="md" maw={720} w="100%">
                <JsonLoader
                  instructions={t("unseen.jsonInstructions")}
                  sampleJson={JSON.stringify(defaultExercise, null, 2)}
                  onParse={handleParseJson}
                />
              </Stack>
            </Group>
          </Tabs.Panel>
        </Tabs>

        {tab === "reading" ? (
          <StatCounts
            items={[
              {
                label: t("unseen.statVocab"),
                value: stats.total,
                color: "brand",
              },
              {
                label: t("unseen.statKnown"),
                value: stats.known,
                color: "success",
              },
              {
                label: t("unseen.statUnknown"),
                value: stats.unknown,
                color: "danger",
              },
            ]}
          />
        ) : null}
      </Stack>
    </Container>
  )
}
