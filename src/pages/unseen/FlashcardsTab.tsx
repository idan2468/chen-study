import { Badge, Button, Group, Stack, Text } from "@mantine/core"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { AssessmentButtons } from "@/components/AssessmentButtons/AssessmentButtons"
import { CardNavigation } from "@/components/CardNavigation/CardNavigation"
import { CardWord } from "@/components/CardWord/CardWord"
import { confirmDanger } from "@/utils/confirmModal"
import { FlipCard } from "@/components/FlipCard/FlipCard"
import { SpeakButton } from "@/components/SpeakButton/SpeakButton"
import { StatCounts } from "@/components/StatCounts/StatCounts"
import { useFlashcardKeys } from "@/hooks/useFlashcardKeys"
import { useSpeech } from "@/hooks/useSpeech"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import {
  markFlashcard,
  nextFlashcard,
  prevFlashcard,
  resetFlashcardProgress,
  selectCurrentExercise,
  selectCurrentFlashcard,
  selectCurrentProgress,
  selectFlashcardIndex,
  selectFlashcardStats,
} from "@/store/slices/unseenSlice"
import classes from "./FlashcardsTab.module.css"

export const FlashcardsTab = () => {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const exercise = useAppSelector(selectCurrentExercise)
  const card = useAppSelector(selectCurrentFlashcard)
  const index = useAppSelector(selectFlashcardIndex)
  const progress = useAppSelector(selectCurrentProgress)
  const stats = useAppSelector(selectFlashcardStats)
  const { speak, stop } = useSpeech()

  const [flipped, setFlipped] = useState(false)
  const total = exercise?.flashcards.length ?? 0
  const status = card ? progress[card.en] : undefined
  const cardOwnerId = card ? `vocab:${card.en}` : "vocab:none"

  // Unlike ModuleFlashcard, this component isn't remounted per card (no
  // `key` upstream -- it owns its own navigation), so resetting `flipped`
  // on card change is adjusted during render rather than via an effect,
  // avoiding an extra render pass. `stop()` is a real side effect (touches
  // `speechSynthesis` and dispatches), so it stays in an effect.
  const [prevCardEn, setPrevCardEn] = useState(card?.en)
  if (card?.en !== prevCardEn) {
    setPrevCardEn(card?.en)
    setFlipped(false)
  }

  useEffect(() => {
    stop()
  }, [card?.en, stop])

  const handleReset = () => {
    confirmDanger(t, {
      title: t("unseen.resetTitle"),
      body: t("unseen.resetBody"),
      confirmLabel: t("common.reset"),
      onConfirm: () => dispatch(resetFlashcardProgress()),
    })
  }

  useFlashcardKeys({
    onFlip: () => {
      setFlipped(current => !current)
    },
    onNext: () => dispatch(nextFlashcard(total)),
    onPrev: () => dispatch(prevFlashcard()),
    onSpeak: () => {
      if (card) {
        speak(card.en, cardOwnerId, { lang: "en-US" })
      }
    },
    onKnown: () => {
      if (card) {
        dispatch(markFlashcard({ word: card.en, isKnown: true }))
      }
    },
    onUnknown: () => {
      if (card) {
        dispatch(markFlashcard({ word: card.en, isKnown: false }))
      }
    },
  })

  if (!card) {
    return (
      <Text ta="center" py="xl" fw={700}>
        {t("unseen.noFlashcards")}
      </Text>
    )
  }

  return (
    <Stack gap="md" align="center">
      <StatCounts
        items={[
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
        actions={
          <Button size="xs" variant="default" onClick={handleReset}>
            {t("unseen.resetMarks")}
          </Button>
        }
      />

      <FlipCard
        flipped={flipped}
        onToggle={() => {
          setFlipped(current => !current)
        }}
        status={status === undefined ? "none" : status ? "known" : "unknown"}
        label={t("common.cardAriaLabel")}
        front={
          <>
            {status !== undefined ? (
              <Badge color={status ? "success" : "danger"} variant="light">
                {status ? t("unseen.statKnown") : t("unseen.statUnknown")}
              </Badge>
            ) : null}
            <CardWord text={card.en} className={classes.word} />
          </>
        }
        back={
          /* Card content: direction derived from the text, not the UI language. */
          <div dir="auto">
            <Text fw={700} className={classes.translation}>
              {card.trans}
            </Text>
            <Text c="dimmed" size="lg" mb="sm">
              {card.he}
            </Text>
            <Group justify="center" gap="xs">
              <SpeakButton
                ownerId={cardOwnerId}
                text={card.en}
                label={t("common.speakWord", { word: card.en })}
              />
            </Group>
          </div>
        }
      />

      <AssessmentButtons
        isKnown={status}
        onMark={isKnown => {
          dispatch(markFlashcard({ word: card.en, isKnown }))
        }}
        knownLabel={t("unseen.markKnown")}
        unknownLabel={t("unseen.markUnknown")}
      />

      <CardNavigation
        index={index}
        total={total}
        onPrev={() => dispatch(prevFlashcard())}
        onNext={() => dispatch(nextFlashcard(total))}
      />
    </Stack>
  )
}
