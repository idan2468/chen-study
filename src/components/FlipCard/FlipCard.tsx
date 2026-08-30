import type { CSSProperties, KeyboardEvent, ReactNode } from "react"
import { CardStatus } from "@/types/moduleExercise"
import { cx } from "@/utils/cx"
import classes from "./FlipCard.module.css"

export type FlipCardProps = {
  front: ReactNode
  back: ReactNode
  flipped: boolean
  onToggle: () => void
  /** Draws a coloured ring around the card. */
  status?: CardStatus
  minHeight?: number
  label: string
}

const statusClass: Record<CardStatus, string | undefined> = {
  [CardStatus.Known]: classes.statusKnown,
  [CardStatus.Unknown]: classes.statusUnknown,
  [CardStatus.None]: undefined,
}

/**
 * Click-to-flip card shell. Content is passed in, so both the Modules cards
 * (word / nikud + meaning) and the Unseen vocabulary cards use the same flip.
 *
 * Rendered as a `div` with `role="button"` rather than a real `<button>`
 * because the faces contain their own buttons (`SpeakButton`, the assessment
 * controls), and nesting buttons is invalid.
 */
export const FlipCard = ({
  front,
  back,
  flipped,
  onToggle,
  status = CardStatus.None,
  minHeight = 260,
  label,
}: FlipCardProps) => {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      onToggle()
    }
  }

  const faceClass = cx(classes.face, statusClass[status])

  return (
    <div
      className={classes.wrapper}
      style={
        {
          "--flip-card-min-height": `${String(minHeight)}px`,
        } as CSSProperties
      }
      role="button"
      tabIndex={0}
      aria-pressed={flipped}
      aria-label={label}
      onClick={onToggle}
      onKeyDown={handleKeyDown}
    >
      {/* `.inner`'s min-height comes from `.wrapper` via `min-height: inherit`. */}
      <div className={cx(classes.inner, flipped && classes.flipped)}>
        <div className={faceClass}>{front}</div>
        <div className={cx(faceClass, classes.back)}>{back}</div>
      </div>
    </div>
  )
}
