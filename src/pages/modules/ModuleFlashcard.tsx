import { Stack, Text } from "@mantine/core"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { AssessmentButtons } from "@/components/AssessmentButtons/AssessmentButtons"
import { CardNavigation } from "@/components/CardNavigation/CardNavigation"
import { FlipCard } from "@/components/FlipCard/FlipCard"
import { SpeakButton } from "@/components/SpeakButton/SpeakButton"
import { useFlashcardKeys } from "@/hooks/useFlashcardKeys"
import { useSpeech } from "@/hooks/useSpeech"
import type { CardStatus, ModuleCard } from "@/types/module"

/** The Modules page read words at a fixed rate rather than off a slider. */
const MODULE_SPEECH_RATE = 0.75

/** The original auto-advanced 250ms after marking a card. */
const AUTO_ADVANCE_MS = 250

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
  const [flipped, setFlipped] = useState(false)
  const { speak, stop } = useSpeech()
  const advanceTimer = useRef<number | undefined>(undefined)

  const ownerId = `modcard:${card.en}`

  // A new card always starts face-down and silent.
  useEffect(() => {
    setFlipped(false)
    stop()
  }, [card.en, stop])

  useEffect(
    () => () => {
      window.clearTimeout(advanceTimer.current)
    },
    [],
  )

  const speakCard = () => {
    speak(card.en, ownerId, { lang: "en-US", rate: MODULE_SPEECH_RATE })
  }

  const handleMark = (isKnown: boolean) => {
    onMark(isKnown)
    window.clearTimeout(advanceTimer.current)
    advanceTimer.current = window.setTimeout(onNext, AUTO_ADVANCE_MS)
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
        status={status ?? "none"}
        label={t("common.cardAriaLabel")}
        front={
          <>
            <Text
              dir="ltr"
              ff="Arial, sans-serif"
              fw={700}
              style={{ fontSize: "3.6rem", letterSpacing: "4px" }}
            >
              {card.en}
            </Text>
            <SpeakButton
              ownerId={ownerId}
              text={card.en}
              label={t("common.speakWord", { word: card.en })}
              rate={MODULE_SPEECH_RATE}
              size="lg"
            />
            <Text size="xs" c="dimmed">
              {t("common.flipHint")}
            </Text>
          </>
        }
        back={
          /* Card content: direction derived from the text, not the UI language. */
          <div dir="auto">
            <Text fw={700} style={{ fontSize: "2.4rem" }}>
              {card.he}
            </Text>
            <Text c="dimmed" size="lg">
              {card.meaning}
            </Text>
          </div>
        }
      />

      <AssessmentButtons
        isKnown={status === undefined ? undefined : status === "known"}
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

      <Text size="sm" c="dimmed" ta="center">
        💡 <b>{t("modules.shortcutsLabel")}</b>
        {t("modules.shortcuts")}
      </Text>
    </Stack>
  )
}
