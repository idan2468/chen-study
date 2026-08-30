import { Stack, Text } from "@mantine/core"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { AssessmentButtons } from "@/components/AssessmentButtons/AssessmentButtons"
import { CardNavigation } from "@/components/CardNavigation/CardNavigation"
import { CardWord } from "@/components/CardWord/CardWord"
import { FlipCard } from "@/components/FlipCard/FlipCard"
import { SpeakButton } from "@/components/SpeakButton/SpeakButton"
import { FLASHCARD_AUTO_ADVANCE_MS } from "@/constants/flashcards"
import { useFlashcardKeys } from "@/hooks/useFlashcardKeys"
import { useIsMobile } from "@/hooks/useIsMobile"
import { useSpeech } from "@/hooks/useSpeech"
import { CardStatus } from "@/types/moduleExercise"
import type { ModuleCard } from "@/types/moduleExercise"
import classes from "./ModuleFlashcard.module.css"

export type ModuleFlashcardProps = {
  card: ModuleCard
  index: number
  total: number
  status: CardStatus | undefined
  onMark: (isKnown: boolean) => void
  onNext: () => void
  onPrev: () => void
}

export const ModuleFlashcard = ({
  card,
  index,
  total,
  status,
  onMark,
  onNext,
  onPrev,
}: ModuleFlashcardProps) => {
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  const [flipped, setFlipped] = useState(false)
  const { speak, stop } = useSpeech()
  const advanceTimer = useRef<number | undefined>(undefined)

  const ownerId = `modcard:${card.en}`

  // Each card gets a fresh mount (keyed by word in ModulesPage), so
  // `flipped`'s `useState(false)` already starts face-down -- only the
  // speech side effect (silencing the previous card) belongs here.
  useEffect(() => {
    stop()
  }, [stop])

  useEffect(
    () => () => {
      window.clearTimeout(advanceTimer.current)
    },
    [],
  )

  const speakCard = () => {
    speak(card.en, ownerId, { lang: "en-US" })
  }

  const handleMark = (isKnown: boolean) => {
    onMark(isKnown)
    window.clearTimeout(advanceTimer.current)
    advanceTimer.current = window.setTimeout(onNext, FLASHCARD_AUTO_ADVANCE_MS)
  }

  useFlashcardKeys({
    onFlip: () => {
      setFlipped(current => !current)
    },
    onNext,
    onPrev,
    onSpeak: speakCard,
    onKnown: () => {
      handleMark(true)
    },
    onUnknown: () => {
      handleMark(false)
    },
  })

  return (
    <Stack gap="md" w="100%" align="center">
      <FlipCard
        flipped={flipped}
        onToggle={() => {
          setFlipped(current => !current)
        }}
        status={status}
        minHeight={isMobile ? 200 : 260}
        label={t(isMobile ? "common.cardAriaLabelTap" : "common.cardAriaLabel")}
        front={<CardWord text={card.en} className={classes.word} />}
        back={
          /* Card content: direction derived from the text, not the UI language. */
          <div dir="auto">
            <Text fw={700} className={classes.translation}>
              {card.he}
            </Text>
            <Text c="dimmed" size="lg">
              {card.meaning}
            </Text>
            <SpeakButton
              ownerId={ownerId}
              text={card.en}
              label={t("common.speakWord", { word: card.en })}
              size="lg"
            />
          </div>
        }
      />

      <AssessmentButtons
        isKnown={status === undefined ? undefined : status === CardStatus.Known}
        onMark={handleMark}
        knownLabel={t("modules.markKnown")}
        unknownLabel={t("modules.markUnknown")}
      />

      <CardNavigation
        index={index}
        total={total}
        onPrev={onPrev}
        onNext={onNext}
      />

      <Text size="sm" c="dimmed" ta="center" visibleFrom="sm">
        💡 <b>{t("modules.shortcutsLabel")}</b>
        {t("modules.shortcuts")}
      </Text>
    </Stack>
  )
}
