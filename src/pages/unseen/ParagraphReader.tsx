import { Paper, Stack } from "@mantine/core"
import { useCallback, useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { SpeakButton } from "@/components/SpeakButton/SpeakButton"
import { useSpeech } from "@/hooks/useSpeech"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { selectSpeechQueueIndex } from "@/store/slices/speechSlice"
import {
  selectCurrentMarkedWords,
  selectVocabSet,
  toggleMarkedWord,
} from "@/store/slices/unseenSlice"
import { cleanWord } from "@/utils/speech"
import { cx } from "@/utils/cx"
import classes from "./ParagraphReader.module.css"

/** Long enough to tell a single click from a double click, as in the original. */
const CLICK_DELAY_MS = 240

export const MAIN_READER_OWNER = "main"

/** `"para:3"` means "read from paragraph 3 to the end". */
const paragraphOwner = (index: number) => `para:${String(index)}`

/**
 * Which paragraph is being read. The whole-passage button starts at 0, while
 * a per-paragraph button starts at its own index, so the queue position has
 * to be offset by wherever the queue began.
 *
 * A plain function rather than a hook: it holds no state of its own, just
 * derives a value from the two inputs it is given.
 */
const resolveReadingIndex = (ownerId: string | null, queueIndex: number) => {
  if (ownerId === MAIN_READER_OWNER) {
    return queueIndex
  }
  if (ownerId?.startsWith("para:")) {
    const start = Number.parseInt(ownerId.slice("para:".length), 10)
    return Number.isNaN(start) ? null : start + queueIndex
  }
  return null
}

type WordTapHandlers = {
  onWordClick: (raw: string, wordOwnerId: string) => void
  onWordDoubleClick: (raw: string) => void
}

/**
 * Distinguishes a single click (speak the word) from a double click (toggle
 * its highlight) without any Redux involvement -- a click is deferred just
 * long enough for a following double click to cancel it.
 *
 * A hook rather than a plain function: unlike `resolveReadingIndex`, this
 * genuinely owns local state (the click timer ref) alongside the behaviour
 * that manipulates it.
 */
const useWordTapHandlers = (): WordTapHandlers => {
  const dispatch = useAppDispatch()
  const { speak, stop } = useSpeech()
  const clickTimer = useRef<number | undefined>(undefined)

  useEffect(
    () => () => {
      window.clearTimeout(clickTimer.current)
    },
    [],
  )

  const onWordClick = useCallback(
    (raw: string, wordOwnerId: string) => {
      // Deferred so a double click can cancel it before it speaks.
      window.clearTimeout(clickTimer.current)
      clickTimer.current = window.setTimeout(() => {
        const word = cleanWord(raw)
        if (word !== "") {
          speak(word, wordOwnerId, { lang: "en-US" })
        }
      }, CLICK_DELAY_MS)
    },
    [speak],
  )

  const onWordDoubleClick = useCallback(
    (raw: string) => {
      window.clearTimeout(clickTimer.current)
      stop()
      const word = cleanWord(raw)
      if (word !== "") {
        dispatch(toggleMarkedWord(word))
      }
    },
    [dispatch, stop],
  )

  return { onWordClick, onWordDoubleClick }
}

type PassageWordProps = {
  token: string
  isVocab: boolean
  isMarked: boolean
  isSpeaking: boolean
  onClick: () => void
  onDoubleClick: () => void
}

/** One tappable/highlightable word inside a paragraph. */
const PassageWord = ({
  token,
  isVocab,
  isMarked,
  isSpeaking,
  onClick,
  onDoubleClick,
}: PassageWordProps) => (
  <span
    className={cx(
      classes.word,
      isVocab && classes.vocab,
      isMarked && classes.marked,
      isSpeaking && classes.speaking,
    )}
    onClick={onClick}
    onDoubleClick={onDoubleClick}
  >
    {token}
  </span>
)

export type ParagraphReaderProps = {
  paragraphs: readonly string[]
}

/**
 * The reading passage: every word is tappable (speak) and double-tappable
 * (highlight), and each paragraph has its own play button that reads from there
 * to the end.
 *
 * Replaces `renderParagraphs`, `onWordClick`, `onWordDoubleClick`,
 * `speakSingleWord`, `speakFromParagraph` + its recursive `speakRowAtIndex`,
 * and `clearSpeechHighlights` (`Unseen New.html:1608-1770`).
 */
export const ParagraphReader = ({ paragraphs }: ParagraphReaderProps) => {
  const { t } = useTranslation()
  const vocab = useAppSelector(selectVocabSet)
  const markedWords = useAppSelector(selectCurrentMarkedWords)
  const queueIndex = useAppSelector(selectSpeechQueueIndex)
  const { ownerId } = useSpeech()
  const { onWordClick, onWordDoubleClick } = useWordTapHandlers()

  const rowRefs = useRef(new Map<number, HTMLDivElement>())
  const readingIndex = resolveReadingIndex(ownerId, queueIndex)

  // Follow along, as the original's `scrollIntoView({ block: 'center' })` did.
  useEffect(() => {
    if (readingIndex === null) {
      return
    }
    rowRefs.current
      .get(readingIndex)
      ?.scrollIntoView({ block: "center", behavior: "smooth" })
  }, [readingIndex])

  const markedSet = new Set(markedWords)

  return (
    <Paper withBorder radius="md" p="md" w="100%">
      <Stack gap="xs">
        {paragraphs.map((paragraph, paragraphIndex) => (
          <div
            /* Paragraph text is stable content, and duplicates are possible, so
               index is the appropriate key here. */
            key={`para-${String(paragraphIndex)}`}
            ref={node => {
              if (node) {
                rowRefs.current.set(paragraphIndex, node)
              } else {
                rowRefs.current.delete(paragraphIndex)
              }
            }}
            className={cx(
              classes.paraRow,
              readingIndex === paragraphIndex && classes.paraReading,
            )}
          >
            <SpeakButton
              ownerId={paragraphOwner(paragraphIndex)}
              text={paragraphs
                .slice(paragraphIndex)
                .map(text => ({ text, lang: "en-US" }))}
              label={t("unseen.paragraphPlay", { number: paragraphIndex + 1 })}
              size="sm"
            />

            <p className={classes.paragraph}>
              {paragraph.split(/(\s+)/).map((token, tokenIndex) => {
                // Whitespace tokens are preserved verbatim.
                if (/^\s+$/.test(token) || token === "") {
                  return token
                }

                const word = cleanWord(token)
                const lower = word.toLowerCase()
                const wordOwnerId = `word:${String(paragraphIndex)}:${String(tokenIndex)}`

                return (
                  <PassageWord
                    key={`w-${String(paragraphIndex)}-${String(tokenIndex)}`}
                    token={token}
                    isVocab={vocab.has(lower)}
                    isMarked={markedSet.has(word)}
                    isSpeaking={ownerId === wordOwnerId}
                    onClick={() => {
                      onWordClick(token, wordOwnerId)
                    }}
                    onDoubleClick={() => {
                      onWordDoubleClick(token)
                    }}
                  />
                )
              })}
            </p>
          </div>
        ))}
      </Stack>
    </Paper>
  )
}
