import { Accordion, Button, Container, Stack, Text, Title } from "@mantine/core"
import { useTranslation } from "react-i18next"
import { importErrorMessage } from "@/i18n/importErrorMessage"
import { confirmDanger, notifyCannotDelete } from "@/utils/confirmModal"
import type { JsonParseResult } from "@/components/JsonLoader/JsonLoader"
import { JsonLoader } from "@/components/JsonLoader/JsonLoader"
import { DeletableTabs } from "@/components/DeletableTabs/DeletableTabs"
import { StatCounts } from "@/components/StatCounts/StatCounts"
import { TopBar } from "@/components/TopBar/TopBar"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import {
  addModules,
  deleteModule,
  markCard,
  nextCard,
  prevCard,
  resetCurrentModuleProgress,
  selectActiveCards,
  selectCurrentCard,
  selectCurrentModule,
  selectCurrentModuleId,
  selectFilterMissed,
  selectMissedWordsAcrossModules,
  selectModuleCardIndex,
  selectModules,
  selectModuleStats,
  selectModulesProgress,
  selectModule as selectModuleAction,
  selectReviewingMissed,
  toggleFilterMissed,
  toggleMissedReview,
} from "@/store/slices/modulesSlice"
import { sampleModule } from "@/data/defaultModules"
import { ModuleFlashcard } from "./ModuleFlashcard"
import { RuleBox } from "./RuleBox"
import { parseModulesJson } from "./moduleImport"

export const ModulesPage = () => {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()

  const modules = useAppSelector(selectModules)
  const currentModuleId = useAppSelector(selectCurrentModuleId)
  const currentModule = useAppSelector(selectCurrentModule)
  const activeCards = useAppSelector(selectActiveCards)
  const currentCard = useAppSelector(selectCurrentCard)
  const cardIndex = useAppSelector(selectModuleCardIndex)
  const filterMissed = useAppSelector(selectFilterMissed)
  const reviewingMissed = useAppSelector(selectReviewingMissed)
  const missedWords = useAppSelector(selectMissedWordsAcrossModules)
  const progress = useAppSelector(selectModulesProgress)
  const stats = useAppSelector(selectModuleStats)

  const handleDeleteModule = (id: string) => {
    const target = modules.find(module => module.id === id)
    if (!target) {
      return
    }

    if (modules.length <= 1) {
      notifyCannotDelete(
        t("modules.cannotDeleteTitle"),
        t("modules.cannotDeleteBody"),
      )
      return
    }

    // Replaces the original's native `confirm()`.
    confirmDanger(t, {
      title: t("modules.deleteTitle"),
      body: t("modules.deleteBody", { name: target.tabName }),
      confirmLabel: t("common.delete"),
      onConfirm: () => dispatch(deleteModule(id)),
    })
  }

  const handleResetProgress = () => {
    confirmDanger(t, {
      title: t("modules.resetTitle"),
      body: t("modules.resetBody", { name: currentModule?.tabName ?? "" }),
      confirmLabel: t("common.reset"),
      onConfirm: () => dispatch(resetCurrentModuleProgress()),
    })
  }

  const handleParseJson = (text: string): JsonParseResult => {
    const result = parseModulesJson(text, Date.now())
    if (!result.ok) {
      // The parser is locale-agnostic and reports a code; the wording lives in
      // `importErrorMessage`.
      return { ok: false, message: importErrorMessage(t, result.error) }
    }

    dispatch(addModules(result.modules))
    const firstId = result.modules[0]?.id
    if (firstId !== undefined) {
      dispatch(selectModuleAction(firstId))
    }

    return {
      ok: true,
      message: t("modules.jsonAdded", { count: result.modules.length }),
    }
  }

  return (
    <Container size="lg" py="xl">
      <Stack gap="lg" align="center">
        <TopBar />

        {reviewingMissed ? (
          <Stack gap={4} align="center" ta="center">
            <Title order={1} c="brand">
              {t("modules.missedReviewTitle")}
            </Title>
            <Text c="dimmed">
              {t("modules.missedReviewSubtitle", {
                count: missedWords.length,
              })}
            </Text>
            <Button
              size="xs"
              variant="default"
              onClick={() => dispatch(toggleMissedReview())}
            >
              {t("modules.backToModules")}
            </Button>
          </Stack>
        ) : (
          <>
            <Stack gap={4} align="center" ta="center">
              {/* Module titles are author-supplied content of unknown
                  language, so direction is derived from the text rather than
                  assumed. */}
              <Title order={1} c="brand" dir="auto">
                {currentModule?.title ?? t("modules.fallbackTitle")}
              </Title>
              {/* The original never updated this line, despite the title
                  being data-driven (`#module-desc` in
                  Modules Practice.html:714). */}
              <Text c="dimmed" dir="auto">
                {currentModule
                  ? t("modules.moduleMeta", {
                      tabName: currentModule.tabName,
                      count: currentModule.cards.length,
                    })
                  : t("modules.noModules")}
              </Text>
            </Stack>

            {missedWords.length > 0 ? (
              <Button size="xs" onClick={() => dispatch(toggleMissedReview())}>
                {t("modules.missedReviewButton", {
                  count: missedWords.length,
                })}
              </Button>
            ) : null}

            <DeletableTabs
              items={modules.map(module => ({
                value: module.id,
                label: module.tabName,
              }))}
              value={currentModuleId}
              onChange={id => dispatch(selectModuleAction(id))}
              onDelete={handleDeleteModule}
            />

            {currentModule && currentModule.rule !== "" ? (
              <RuleBox
                title={t("modules.ruleTitle")}
                html={currentModule.rule}
              />
            ) : null}

            <StatCounts
              items={[
                {
                  label: t("modules.statKnown"),
                  value: stats.known,
                  color: "success",
                },
                {
                  label: t("modules.statUnknown"),
                  value: stats.unknown,
                  color: "danger",
                },
                {
                  label: t("modules.statPending"),
                  value: stats.pending,
                  color: "gray",
                },
              ]}
              actions={
                <>
                  <Button
                    size="xs"
                    variant={filterMissed ? "filled" : "default"}
                    onClick={() => dispatch(toggleFilterMissed())}
                  >
                    {filterMissed
                      ? t("modules.filterOn")
                      : t("modules.filterOff")}
                  </Button>
                  <Button
                    size="xs"
                    variant="default"
                    onClick={handleResetProgress}
                  >
                    {t("modules.resetModule")}
                  </Button>
                </>
              }
            />
          </>
        )}

        {currentCard ? (
          <ModuleFlashcard
            key={currentCard.en}
            card={currentCard}
            index={cardIndex}
            total={activeCards.length}
            status={progress[currentCard.en]}
            onMark={isKnown => {
              dispatch(markCard({ word: currentCard.en, isKnown }))
            }}
            onNext={() => dispatch(nextCard(activeCards.length))}
            onPrev={() => dispatch(prevCard())}
          />
        ) : (
          <Text ta="center" size="xl" fw={700} py="xl">
            {t("modules.allDone")}
          </Text>
        )}

        <Accordion variant="contained" w="100%">
          <Accordion.Item value="json">
            <Accordion.Control>
              {t("modules.jsonSectionTitle")}
            </Accordion.Control>
            <Accordion.Panel>
              <JsonLoader
                instructions={t("modules.jsonInstructions")}
                sampleJson={JSON.stringify(sampleModule, null, 2)}
                onParse={handleParseJson}
              />
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      </Stack>
    </Container>
  )
}
