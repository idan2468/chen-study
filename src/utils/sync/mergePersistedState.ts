import type { PersistedState } from "@/types/schemas/persistedState"
import { PERSISTED_STATE_VERSION } from "@/types/schemas/persistedState"
import { SpeechLang } from "@/types/speech"
import type { UnseenExercise } from "@/types/unseenExercise"
import type { VersionedValue } from "@/types/versionedValue"
import { compareTimestamps } from "@/utils/sync/timestamp"
import {
  isNewer,
  liveValues,
  mergeVersionedArrays,
  pickNewer,
} from "@/utils/sync/versionedValue"

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
  compareTimestamps(local.updatedAt, remote.updatedAt) === 0

/**
 * A replaced exercise wins with its whole subtree; the same version merges its progress record by record.
 * @param local This device's version of one exercise.
 * @param remote The Drive copy's version of the same exercise ID.
 */
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

/**
 * The side that switched more recently keeps its card index, so a position never lands in the other side's exercise.
 * @param local This device's current ID and card index (Unseen or Modules).
 * @param remote The Drive copy's pair for the same section.
 */
const mergeNavigation = (local: Navigation, remote: Navigation): Navigation => {
  if (local.currentId.value !== remote.currentId.value) {
    return isNewer(local.currentId, remote.currentId) ? local : remote
  }
  return {
    currentId: pickNewer(local.currentId, remote.currentId),
    cardIndex: pickNewer(local.cardIndex, remote.cardIndex),
  }
}

/**
 * Keeps the merged current ID on a live entity, since the other device may have deleted it:
 * falls back to either side's pair whose ID is still live, then to the first live entity at card 0.
 * @param liveIds IDs of the merged section's live entities, in list order.
 */
const keepNavigationLive = (
  merged: Navigation,
  sides: readonly Navigation[],
  liveIds: readonly string[],
): Navigation => {
  const isLive = (navigation: Navigation) =>
    liveIds.includes(navigation.currentId.value)
  const live = [merged, ...sides].find(isLive)
  if (live) {
    return live
  }
  return {
    currentId: { ...merged.currentId, value: liveIds[0] ?? "" },
    cardIndex: { ...merged.cardIndex, value: 0 },
  }
}

const liveIdsOf = <T>(
  entries: readonly VersionedValue<T>[],
  getId: (value: T) => string,
) => liveValues(entries).map(getId)

const mergeUnseenSection = (
  local: PersistedState["unseen"],
  remote: PersistedState["unseen"],
): PersistedState["unseen"] => {
  const exercises = mergeVersionedArrays(
    local.exercises,
    remote.exercises,
    exercise => exercise.exerciseId,
    mergeExercise,
  )
  const localSide = { currentId: local.currentId, cardIndex: local.cardIndex }
  const remoteSide = {
    currentId: remote.currentId,
    cardIndex: remote.cardIndex,
  }
  return {
    exercises,
    ...keepNavigationLive(
      mergeNavigation(localSide, remoteSide),
      [localSide, remoteSide],
      liveIdsOf(exercises, exercise => exercise.exerciseId),
    ),
  }
}

const mergeModulesSection = (
  local: PersistedState["modules"],
  remote: PersistedState["modules"],
): PersistedState["modules"] => {
  const modules = mergeVersionedArrays(
    local.modules,
    remote.modules,
    module => module.id,
  )
  const localSide = {
    currentId: local.currentModuleId,
    cardIndex: local.cardIndex,
  }
  const remoteSide = {
    currentId: remote.currentModuleId,
    cardIndex: remote.cardIndex,
  }
  const navigation = keepNavigationLive(
    mergeNavigation(localSide, remoteSide),
    [localSide, remoteSide],
    liveIdsOf(modules, module => module.id),
  )
  return {
    modules,
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

/**
 * Merges two full persisted states into one; pure, so neither argument is changed.
 * @param local This device's state.
 * @param remote The Drive copy; it wins every tie.
 */
export const mergePersistedState = (
  local: PersistedState,
  remote: PersistedState,
): PersistedState => ({
  schemaVersion: PERSISTED_STATE_VERSION,
  unseen: mergeUnseenSection(local.unseen, remote.unseen),
  modules: mergeModulesSection(local.modules, remote.modules),
  preferences: mergePreferencesSection(local.preferences, remote.preferences),
})
