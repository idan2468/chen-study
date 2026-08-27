import {
  Button,
  Group,
  Modal,
  Select,
  Slider,
  Stack,
  Text,
} from "@mantine/core"
import { IconMicrophone } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { SpeakButton } from "@/components/SpeakButton/SpeakButton"
import { ICON_SIZE } from "@/constants/icons"
import { useSystemVoices } from "@/hooks/useSpeech"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import {
  DEFAULT_SPEECH_RATE,
  MAX_SPEECH_RATE,
  MIN_SPEECH_RATE,
  selectSpeechRate,
  selectSystemVoiceUri,
  setSpeechRate,
  setSystemVoiceUri,
} from "@/store/slices/settingsSlice"
import { voicesForLanguage } from "@/utils/speech/voices"

export type SpeechSettingsModalProps = {
  opened: boolean
  onClose: () => void
}

/** Spoken when the user presses "test", so the sample is always in English. */
const SAMPLE_TEXT = "The quick brown fox jumps over the lazy dog."

/**
 * Choosing a *specific* system voice: the browser's default for a language is
 * often the lowest-quality one installed (see `utils/speech/voices.ts`), so this lets
 * the user override it.
 *
 * A local neural engine (kokoro-js) used to live alongside this picker but was
 * removed after real-world testing rejected its audio quality; see
 * `docs/remove-neural-tts.md` for the full account. This is what remained.
 */
export const SpeechSettingsModal = ({
  opened,
  onClose,
}: SpeechSettingsModalProps) => {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const systemVoiceUri = useAppSelector(selectSystemVoiceUri)
  const speechRate = useAppSelector(selectSpeechRate)
  const voices = useSystemVoices()

  // English only: the passage, tapped words and both flashcard decks are all
  // spoken in English -- Hebrew content auto-detects its own voice instead.
  const englishVoices = voicesForLanguage(voices, "en")

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t("speech.title")}
      centered
      size="lg"
      removeScrollProps={{ gapMode: "padding" }}
    >
      <Stack gap="md">
        <Select
          label={t("speech.systemVoiceLabel")}
          description={t("speech.systemVoiceHint")}
          data={[
            { value: "", label: t("speech.bestAvailable") },
            ...englishVoices.map(voice => ({
              value: voice.voiceURI,
              label: `${voice.name} (${voice.lang})`,
            })),
          ]}
          value={systemVoiceUri ?? ""}
          onChange={value => {
            dispatch(setSystemVoiceUri(value === "" ? null : value))
          }}
          allowDeselect={false}
          size="md"
          leftSection={<IconMicrophone size={ICON_SIZE} />}
        />

        <Stack gap={2}>
          <Text size="sm" c="dimmed">
            {t("speech.speechRate", { rate: speechRate.toFixed(2) })}
          </Text>
          <Slider
            value={speechRate}
            onChange={value => dispatch(setSpeechRate(value))}
            min={MIN_SPEECH_RATE}
            max={MAX_SPEECH_RATE}
            step={0.05}
            defaultValue={DEFAULT_SPEECH_RATE}
            label={value => `${value.toFixed(2)}x`}
            aria-label={t("speech.speechRateLabel")}
          />
        </Stack>

        <Group justify="space-between" mt="sm">
          <Group gap="xs">
            <SpeakButton
              ownerId="speech-sample"
              text={SAMPLE_TEXT}
              label={t("speech.test")}
            />
            <Text size="sm">{t("speech.test")}</Text>
          </Group>
          <Button variant="default" onClick={onClose}>
            {t("common.close")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
