import { useCallback, useEffect, useRef, useState } from "react"
import type { SpeechItem } from "@/utils/speech/speech"
import {
  cancelSpeech,
  isSpeechSupported,
  speakQueue,
} from "@/utils/speech/speech"
import { loadVoices, resolveVoice } from "@/utils/speech/voices"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import {
  selectSpeechRate,
  selectSystemVoiceUri,
  SpeechLang,
} from "@/store/slices/settingsSlice"
import {
  selectSpeechOwnerId,
  speechAdvanced,
  speechStarted,
  speechStopped,
} from "@/store/slices/speechSlice"

export type SpeakOptions = {
  lang?: string
}

/**
 * The system voice list, loaded once per page.
 *
 * Module-level rather than component state because `getVoices()` is a global,
 * populated asynchronously, and every `SpeakButton` would otherwise wait on its
 * own copy.
 */
let cachedVoices: SpeechSynthesisVoice[] = []
let voicesPromise: Promise<SpeechSynthesisVoice[]> | null = null

const ensureVoices = () => {
  voicesPromise ??= loadVoices().then(voices => {
    cachedVoices = voices
    return voices
  })
  return voicesPromise
}

/**
 * The freshest voice list available *right now*, synchronously.
 *
 * `loadVoices()` is async, so a user who presses play during the first second
 * of a cold page would otherwise hit an empty cache and silently fall back to
 * the browser's default voice -- precisely what `utils/speech/voices.ts` exists to
 * avoid. Re-reading `getVoices()` costs nothing and is usually populated by the
 * time the first utterance is actually queued.
 */
const currentVoices = () => {
  if (cachedVoices.length === 0 && typeof window !== "undefined") {
    cachedVoices = window.speechSynthesis.getVoices()
  }
  return cachedVoices
}

/** Exposes the ranked system voice list to the settings UI. */
export const useSystemVoices = () => {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(cachedVoices)

  useEffect(() => {
    let active = true
    void ensureVoices().then(loaded => {
      if (active) {
        setVoices(loaded)
      }
    })
    return () => {
      active = false
    }
  }, [])

  return voices
}

/**
 * The one way anything in the app speaks. Every play/stop button goes through
 * here so `speechSlice.ownerId` always reflects reality.
 */
export const useSpeech = () => {
  const dispatch = useAppDispatch()
  const ownerId = useAppSelector(selectSpeechOwnerId)
  const speechRateEn = useAppSelector(state =>
    selectSpeechRate(state, SpeechLang.English),
  )
  const speechRateHe = useAppSelector(state =>
    selectSpeechRate(state, SpeechLang.Hebrew),
  )
  const systemVoiceUriEn = useAppSelector(state =>
    selectSystemVoiceUri(state, SpeechLang.English),
  )
  const systemVoiceUriHe = useAppSelector(state =>
    selectSystemVoiceUri(state, SpeechLang.Hebrew),
  )

  // Read at call time, so changing a setting mid-session takes effect on the
  // next utterance without every caller re-creating its handlers. Written
  // from an effect (not during render) since mutating a ref is a side
  // effect; no dependency array, so it re-syncs after every commit.
  const settingsRef = useRef({
    speechRateEn,
    speechRateHe,
    systemVoiceUriEn,
    systemVoiceUriHe,
  })
  useEffect(() => {
    settingsRef.current = {
      speechRateEn,
      speechRateHe,
      systemVoiceUriEn,
      systemVoiceUriHe,
    }
  })

  // Warm the voice list so the first utterance already has a good voice rather
  // than falling back to the browser default.
  useEffect(() => {
    void ensureVoices()
  }, [])

  const stop = useCallback(() => {
    cancelSpeech()
    dispatch(speechStopped())
  }, [dispatch])

  const speakSequence = useCallback(
    (items: readonly SpeechItem[], id: string) => {
      if (!isSpeechSupported()) {
        return
      }

      const current = settingsRef.current
      dispatch(speechStarted(id))

      /** `detectLang()`/an explicit `SpeechItem.lang` reports a BCP-47 tag
       *  (`"he-IL"`, `"en-US"`), not a `SpeechLang` -- narrow to the base
       *  language before looking up the per-language preference. */
      const preferenceFor = (lang: string) =>
        lang.toLowerCase().startsWith(SpeechLang.Hebrew)
          ? { rate: current.speechRateHe, voiceUri: current.systemVoiceUriHe }
          : { rate: current.speechRateEn, voiceUri: current.systemVoiceUriEn }

      speakQueue(
        items,
        {
          resolveRate: lang => preferenceFor(lang).rate,
          resolveVoice: lang =>
            resolveVoice(currentVoices(), lang, preferenceFor(lang).voiceUri),
        },
        {
          onIndex: index => {
            // `speechStarted` already set 0; skip the redundant dispatch.
            if (index > 0) {
              dispatch(speechAdvanced(index))
            }
          },
          onDone: () => dispatch(speechStopped()),
        },
      )
    },
    [dispatch],
  )

  const speak = useCallback(
    (text: string, id: string, options?: SpeakOptions) => {
      speakSequence([{ text, lang: options?.lang }], id)
    },
    [speakSequence],
  )

  /** Play, or stop if this owner is already the one playing. */
  const toggle = useCallback(
    (text: string, id: string, options?: SpeakOptions) => {
      if (ownerId === id) {
        stop()
      } else {
        speak(text, id, options)
      }
    },
    [ownerId, speak, stop],
  )

  const toggleSequence = useCallback(
    (items: readonly SpeechItem[], id: string) => {
      if (ownerId === id) {
        stop()
      } else {
        speakSequence(items, id)
      }
    },
    [ownerId, speakSequence, stop],
  )

  return { ownerId, speak, speakSequence, toggle, toggleSequence, stop }
}
