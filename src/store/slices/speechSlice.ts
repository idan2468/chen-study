import type { PayloadAction } from "@reduxjs/toolkit"
import { createAppSlice } from "@/store/createAppSlice"

/**
 * Which control currently owns `window.speechSynthesis` -- a browser
 * singleton, so this is app-level state rather than local to one page. The
 * utterance object and queue stay out of the store (non-serializable) and
 * live in `src/utils/speech.ts` instead.
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
