import { Button, Group, Select, Slider, Stack, Tabs, Text } from "@mantine/core"
import { IconLanguage, IconMicrophone } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { AppModal } from "@/components/AppModal/AppModal"
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
  SpeechLang,
} from "@/store/slices/settingsSlice"
import { voicesForLanguage } from "@/utils/speech/voices"

export type SpeechSettingsModalProps = {
  opened: boolean
  onClose: () => void
}

/** Spoken when the user presses "test" on the English tab. */
const SAMPLE_TEXT_EN = "The quick brown fox jumps over the lazy dog."
/** Spoken when the user presses "test" on the Hebrew tab. */
const SAMPLE_TEXT_HE = "השועל החום הזריז קופץ מעל הכלב העצלן."

/**
 * One language's voice + speed controls, tabbed by language since English
 * and Hebrew content are read independently -- different voice pools, and
 * often different speeds (e.g. a Hebrew explanation is more comfortable
 * slower than an already-memorized English passage).
 *
 * Choosing a *specific* system voice matters because the browser's default
 * for a language is often the lowest-quality one installed (see
 * `utils/speech/voices.ts`).
 */
const LanguageSpeechTab = ({
  lang,
  voices,
  sampleText,
}: {
  lang: SpeechLang
  voices: SpeechSynthesisVoice[]
  sampleText: string
}) => {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const systemVoiceUri = useAppSelector(state =>
    selectSystemVoiceUri(state, lang),
  )
  const speechRate = useAppSelector(state => selectSpeechRate(state, lang))

  return (
    <Stack gap="md" pt="md">
      <Select
        label={t("speech.systemVoiceLabel")}
        description={t("speech.systemVoiceHint")}
        data={[
          { value: "", label: t("speech.bestAvailable") },
          ...voices.map(voice => ({
            value: voice.voiceURI,
            label: `${voice.name} (${voice.lang})`,
          })),
        ]}
        value={systemVoiceUri ?? ""}
        onChange={value => {
          dispatch(
            setSystemVoiceUri({ lang, uri: value === "" ? null : value }),
          )
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
          onChange={rate => dispatch(setSpeechRate({ lang, rate }))}
          min={MIN_SPEECH_RATE}
          max={MAX_SPEECH_RATE}
          step={0.05}
          defaultValue={DEFAULT_SPEECH_RATE}
          label={value => `${value.toFixed(2)}x`}
          aria-label={t("speech.speechRateLabel")}
        />
      </Stack>

      <Group gap="xs">
        <SpeakButton
          ownerId={`speech-sample-${lang}`}
          text={sampleText}
          label={t("speech.test")}
        />
        <Text size="sm">{t("speech.test")}</Text>
      </Group>
    </Stack>
  )
}

/**
 * A local neural engine (kokoro-js) used to live alongside this picker but was
 * removed after real-world testing rejected its audio quality; see
 * `docs/remove-neural-tts.md` for the full account. This is what remained.
 */
export const SpeechSettingsModal = ({
  opened,
  onClose,
}: SpeechSettingsModalProps) => {
  const { t } = useTranslation()
  const voices = useSystemVoices()

  const englishVoices = voicesForLanguage(voices, SpeechLang.English)
  const hebrewVoices = voicesForLanguage(voices, SpeechLang.Hebrew)

  return (
    <AppModal
      opened={opened}
      onClose={onClose}
      title={t("speech.title")}
      centered
      size="lg"
    >
      <Tabs
        defaultValue={SpeechLang.English}
        variant="pills"
        keepMounted={false}
      >
        <Tabs.List grow>
          <Tabs.Tab
            value={SpeechLang.English}
            leftSection={<IconLanguage size={ICON_SIZE} />}
          >
            {t("speech.tabEnglish")}
          </Tabs.Tab>
          <Tabs.Tab
            value={SpeechLang.Hebrew}
            leftSection={<IconLanguage size={ICON_SIZE} />}
          >
            {t("speech.tabHebrew")}
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value={SpeechLang.English}>
          <LanguageSpeechTab
            lang={SpeechLang.English}
            voices={englishVoices}
            sampleText={SAMPLE_TEXT_EN}
          />
        </Tabs.Panel>
        <Tabs.Panel value={SpeechLang.Hebrew}>
          <LanguageSpeechTab
            lang={SpeechLang.Hebrew}
            voices={hebrewVoices}
            sampleText={SAMPLE_TEXT_HE}
          />
        </Tabs.Panel>
      </Tabs>

      <Group justify="flex-end" mt="md">
        <Button variant="default" onClick={onClose}>
          {t("common.close")}
        </Button>
      </Group>
    </AppModal>
  )
}
