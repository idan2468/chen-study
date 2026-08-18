import { ActionIcon, Tooltip } from "@mantine/core"
import type { MouseEvent } from "react"
import { useTranslation } from "react-i18next"
import type { SpeechItem } from "@/utils/speech"
import { isSpeechSupported } from "@/utils/speech"
import { useSpeech } from "@/hooks/useSpeech"

export type SpeakButtonProps = {
  /** Unique per control, e.g. `"main"`, `"para:3"`, `"opt:q2:1"`. */
  ownerId: string
  /** A single string, or several to read in sequence. */
  text: string | readonly SpeechItem[]
  label: string
  size?: "xs" | "sm" | "md" | "lg"
  variant?: "filled" | "light" | "default" | "subtle"
}

/**
 * The one play/stop control in the app.
 *
 * Replaces the five near-identical TTS buttons in `Unseen New.html`
 * (`.q-speech-btn`, `.option-speech-btn`, `.word-audio-btn`, `.para-play`,
 * `#main-play-btn`) plus `.audio-btn` in `Modules Practice.html` -- each of
 * which reimplemented the same toggle and `.playing` state by hand.
 *
 * It holds no state of its own: whether it shows "play" or "stop" is derived
 * from `speechSlice.ownerId`, so starting playback anywhere in the app
 * automatically resets every other button.
 */
export const SpeakButton = ({
  ownerId,
  text,
  label,
  size = "md",
  variant = "light",
}: SpeakButtonProps) => {
  const { t } = useTranslation()
  const { ownerId: activeOwnerId, toggleSequence } = useSpeech()
  const isPlaying = activeOwnerId === ownerId

  if (!isSpeechSupported()) {
    return null
  }

  const items: readonly SpeechItem[] =
    typeof text === "string" ? [{ text }] : text

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    // Speak buttons often sit inside clickable cards (the flashcard flips on
    // click), so they must not bubble.
    event.stopPropagation()
    toggleSequence(items, ownerId)
  }

  return (
    <Tooltip label={isPlaying ? t("common.stop") : label}>
      <ActionIcon
        size={size}
        variant={isPlaying ? "filled" : variant}
        color={isPlaying ? "danger" : undefined}
        aria-label={isPlaying ? t("common.stopSpeaking", { label }) : label}
        aria-pressed={isPlaying}
        onClick={handleClick}
      >
        {isPlaying ? "⏹" : "🔊"}
      </ActionIcon>
    </Tooltip>
  )
}
