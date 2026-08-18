/**
 * The speech controller. Replaces `stopSpeech`, `speakTextSnippet`, `speakText`,
 * `speakFromParagraph` + its recursive `speakRowAtIndex`,
 * `speakQuestionAndOptions`, `playAudio`, `stopCardAudio` and
 * `resetSpeechBtnState` -- spread across both original HTML files.
 *
 * Speaks through `window.speechSynthesis`, always available and covering every
 * language. A local neural engine (kokoro-js) was tried and removed -- see
 * `docs/remove-neural-tts.md` -- because its audio quality was rejected in real
 * use even after fixing its precision bug and meeting the latency budget.
 *
 * The pending queue lives here rather than in Redux: it changes far too often,
 * and per-utterance state, to be actions.
 */

export type SpeechItem = {
  text: string
  /** Defaults to `detectLang(text)`. */
  lang?: string
}

export type SpeechHandlers = {
  /** Fired before each item starts, with its index in the queue. */
  onIndex: (index: number) => void
  /** Fired once when the queue finishes, errors, or is cancelled. */
  onDone: () => void
}

export type SpeakQueueOptions = {
  rate: number
  /** Resolves the system voice for a language. See `utils/voices.ts`. */
  resolveVoice?: (lang: string) => SpeechSynthesisVoice | undefined
}

const HEBREW_CHARS = /[֐-׿]/
// Alternation rather than a character class: ⏹️ is ⏹ plus a variation selector,
// which a character class would treat as two separate members.
const BUTTON_GLYPHS = /\u{1F50A}|▶\u{FE0F}?|⏹\u{FE0F}?/gu
const NON_WORD_CHARS = /[^A-Za-z0-9'’-]/g

export const isSpeechSupported = () =>
  typeof window !== "undefined" && "speechSynthesis" in window

/** The originals auto-detected Hebrew rather than tagging content with a lang. */
export const detectLang = (text: string) =>
  HEBREW_CHARS.test(text) ? "he-IL" : "en-US"

/** Strips the 🔊 / ▶ / ⏹️ glyphs that were baked into the buttons' labels. */
export const cleanSpeechText = (raw: string) =>
  raw.replace(BUTTON_GLYPHS, "").trim()

/** `cleanWord` from `Unseen New.html:1588` -- for speaking a single tapped word. */
export const cleanWord = (raw: string) => raw.replace(NON_WORD_CHARS, "")

/**
 * Bumped on every cancel. Each queue captures the value it started with and
 * bails out if it no longer matches, which is what stops a queued utterance
 * from resuming after the user switched to a different control. (Replaces the
 * originals' `currentSpeechBtn !== btn` identity checks.)
 */
let runToken = 0

export const cancelSpeech = () => {
  runToken += 1
  if (isSpeechSupported()) {
    window.speechSynthesis.cancel()
  }
}

const speakWithSystem = (
  items: readonly SpeechItem[],
  options: SpeakQueueOptions,
  handlers: SpeechHandlers,
  token: number,
) => {
  const speakAt = (index: number) => {
    // A newer queue (or a cancel) took over while this one was mid-flight.
    if (token !== runToken) {
      return
    }

    const item = items[index]
    if (!item) {
      handlers.onDone()
      return
    }

    handlers.onIndex(index)

    const lang = item.lang ?? detectLang(item.text)
    const utterance = new SpeechSynthesisUtterance(cleanSpeechText(item.text))
    utterance.rate = options.rate

    // The whole point of `utils/voices.ts`: without this the browser silently
    // uses its default voice for the language, often the worst one installed.
    const voice = options.resolveVoice?.(lang)
    if (voice) {
      utterance.voice = voice
      // Take the locale from the voice itself, so picking a British voice does
      // not leave `lang` claiming en-US and inviting the browser to disagree
      // with the explicit `voice`.
      utterance.lang = voice.lang
    } else {
      utterance.lang = lang
    }

    utterance.onend = () => {
      speakAt(index + 1)
    }
    utterance.onerror = () => {
      if (token === runToken) {
        handlers.onDone()
      }
    }

    window.speechSynthesis.speak(utterance)
  }

  speakAt(0)
}

/**
 * Speaks `items` in order. Cancels anything already playing first, so the
 * caller never has to.
 */
export const speakQueue = (
  items: readonly SpeechItem[],
  options: SpeakQueueOptions,
  handlers: SpeechHandlers,
) => {
  cancelSpeech()

  if (!isSpeechSupported() || items.length === 0) {
    handlers.onDone()
    return
  }

  const token = runToken
  speakWithSystem(items, options, handlers, token)
}
