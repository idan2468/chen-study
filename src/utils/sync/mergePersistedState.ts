import type { PersistedState } from "@/types/schemas/persistedState"
import { PERSISTED_STATE_VERSION } from "@/types/schemas/persistedState"
import { SpeechLang } from "@/types/speech"
import type { UnseenExercise } from "@/types/unseenExercise"
import type { VersionedValue } from "@/types/versionedValue"
import { compareIsraelTimestamps } from "@/utils/sync/israelTimestamp"
import { mergeVersionedArrays, pickNewer } from "@/utils/sync/versionedValue"

type Navigation = {
  currentId: VersionedValue<string>
  cardIndex: VersionedValue<number>
}

const isSameLiveVersion = <T>(
  local: VersionedValue<T>,
  remote: VersionedValue<T>,
) =>
  !local.deleted &&
  !remote.deleted &&
  compareIsraelTimestamps(local.updatedAt, remote.updatedAt) === 0

/** A replaced exercise wins with its whole subtree; the same version merges its progress record by record. */
const mergeExercise = (
  local: VersionedValue<UnseenExercise>,
  remote: VersionedValue<UnseenExercise>,
): VersionedValue<UnseenExercise> => {
  if (!isSameLiveVersion(local, remote)) {
    return pickNewer(local, remote)
  }
  return {
    ...remote,
    value: {
      ...remote.value,
      answers: mergeVersionedArrays(
        local.value.answers,
        remote.value.answers,
        answer => answer.questionId,
      ),
      highlights: mergeVersionedArrays(
        local.value.highlights,
        remote.value.highlights,
        highlight => highlight.word,
      ),
      flashcardProgress: mergeVersionedArrays(
        local.value.flashcardProgress,
        remote.value.flashcardProgress,
        record => record.word,
      ),
    },
  }
}

/** The side that switched more recently keeps its card index, so a position never lands in the other side's exercise. */
const mergeNavigation = (local: Navigation, remote: Navigation): Navigation => {
  if (local.currentId.value !== remote.currentId.value) {
    return pickNewer(local.currentId, remote.currentId) === local.currentId
      ? local
      : remote
  }
  return {
    currentId: pickNewer(local.currentId, remote.currentId),
    cardIndex: pickNewer(local.cardIndex, remote.cardIndex),
  }
}

const mergeUnseenSection = (
  local: PersistedState["unseen"],
  remote: PersistedState["unseen"],
): PersistedState["unseen"] => ({
  exercises: mergeVersionedArrays(
    local.exercises,
    remote.exercises,
    exercise => exercise.exerciseId,
    mergeExercise,
  ),
  ...mergeNavigation(
    { currentId: local.currentId, cardIndex: local.cardIndex },
    { currentId: remote.currentId, cardIndex: remote.cardIndex },
  ),
})

const mergeModulesSection = (
  local: PersistedState["modules"],
  remote: PersistedState["modules"],
): PersistedState["modules"] => {
  const navigation = mergeNavigation(
    { currentId: local.currentModuleId, cardIndex: local.cardIndex },
    { currentId: remote.currentModuleId, cardIndex: remote.cardIndex },
  )
  return {
    modules: mergeVersionedArrays(
      local.modules,
      remote.modules,
      module => module.id,
    ),
    progress: mergeVersionedArrays(
      local.progress,
      remote.progress,
      record => record.word,
    ),
    currentModuleId: navigation.currentId,
    cardIndex: navigation.cardIndex,
  }
}

const mergePreferencesSection = (
  local: PersistedState["preferences"],
  remote: PersistedState["preferences"],
): PersistedState["preferences"] => ({
  dyslexiaFont: pickNewer(local.dyslexiaFont, remote.dyslexiaFont),
  shuffleUnseenAnswers: pickNewer(
    local.shuffleUnseenAnswers,
    remote.shuffleUnseenAnswers,
  ),
  speechRateByLang: {
    [SpeechLang.English]: pickNewer(
      local.speechRateByLang[SpeechLang.English],
      remote.speechRateByLang[SpeechLang.English],
    ),
    [SpeechLang.Hebrew]: pickNewer(
      local.speechRateByLang[SpeechLang.Hebrew],
      remote.speechRateByLang[SpeechLang.Hebrew],
    ),
  },
})

/** `remote` is the Drive copy; it wins every tie. */
export const mergePersistedState = (
  local: PersistedState,
  remote: PersistedState,
): PersistedState => ({
  schemaVersion: PERSISTED_STATE_VERSION,
  unseen: mergeUnseenSection(local.unseen, remote.unseen),
  modules: mergeModulesSection(local.modules, remote.modules),
  preferences: mergePreferencesSection(local.preferences, remote.preferences),
})
