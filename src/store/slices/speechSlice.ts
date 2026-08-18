import type { PayloadAction } from "@reduxjs/toolkit"
import { createAppSlice } from "../createAppSlice"

/**
 * Which control currently owns `window.speechSynthesis`.
 *
 * The originals tracked this by stashing a **DOM element** in a module global
 * (`currentSpeechBtn`, `Unseen New.html:1776`), comparing by identity, then
 * restoring button labels by sniffing the element's id and class in a five-way
 * branch (`resetSpeechBtnState`, `:1778`). Here it is a plain string id, so any
 * `SpeakButton` anywhere in the tree can derive its own play/stop state.
 *
 * `window.speechSynthesis` is a browser singleton -- exactly one utterance
 * plays app-wide -- which is why this is app-level state and not local to a
 * page. The `SpeechSynthesisUtterance` and the pending queue deliberately stay
 * out of the store (non-serializable, and dispatching per speech event would
 * flood DevTools); they live in `src/utils/speech.ts`.
 */
export type SpeechState = {
  /** `null` when nothing is playing. `ownerId !== null` *is* "is speaking". */
  ownerId: string | null
  /** Index into the owner's queue, so sequential readers can highlight. */
  queueIndex: number
}

const initialState: SpeechState = { ownerId: null, queueIndex: 0 }

export const speechSlice = createAppSlice({
  name: "speech",
  initialState,
  reducers: create => ({
    speechStarted: create.reducer((state, action: PayloadAction<string>) => {
      state.ownerId = action.payload
      state.queueIndex = 0
    }),
    speechAdvanced: create.reducer((state, action: PayloadAction<number>) => {
      state.queueIndex = action.payload
    }),
    speechStopped: create.reducer(state => {
      state.ownerId = null
      state.queueIndex = 0
    }),
  }),
  selectors: {
    selectSpeechOwnerId: speech => speech.ownerId,
    selectSpeechQueueIndex: speech => speech.queueIndex,
  },
})

export const { speechStarted, speechAdvanced, speechStopped } =
  speechSlice.actions

export const { selectSpeechOwnerId, selectSpeechQueueIndex } =
  speechSlice.selectors
