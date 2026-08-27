import { useState } from "react"
import {
  Alert,
  Button,
  CopyButton,
  Group,
  Stack,
  Text,
  Textarea,
} from "@mantine/core"
import { useDisclosure } from "@mantine/hooks"
import { IconCheck, IconClipboardText, IconPlus } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { ImportDebugModal } from "@/components/ImportDebugModal/ImportDebugModal"
import { ICON_SIZE } from "@/constants/icons"

/** What a page's parser reports back to the loader, already translated. */
export type JsonParseResult = {
  ok: boolean
  message: string
  /**
   * Raw validation detail (e.g. zod issues) for a shape-mismatch failure.
   * Too long and too technical to show inline -- offered via
   * `ImportDebugModal` instead, for a human or an AI to diagnose.
   */
  debugInfo?: string
}

export type JsonLoaderProps = {
  instructions: string
  /** Prefilled into the textarea via "load a template". */
  sampleJson?: string
  /** Validates and commits the pasted text. Must not throw. */
  onParse: (text: string) => JsonParseResult
}

/**
 * Paste-JSON-to-add-content panel.
 *
 * Replaces `Unseen New.html`'s `#tab-json` card and
 * `Modules Practice.html`'s `<details>` drawer, along with the triplicated
 * `loadJSON` / `loadSingleModule` / `loadMultipleModules` functions
 * (`Modules Practice.html:1454-1537`) that each re-read and re-parsed the same
 * textarea. Parsing now happens once, in the page's `onParse`.
 */
export const JsonLoader = ({
  instructions,
  sampleJson,
  onParse,
}: JsonLoaderProps) => {
  const { t } = useTranslation()
  const [text, setText] = useState("")
  const [result, setResult] = useState<JsonParseResult | null>(null)
  const [debugInfoOpened, debugInfoHandlers] = useDisclosure(false)

  const handleLoad = () => {
    setResult(onParse(text))
  }

  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        {instructions}
      </Text>

      <Group gap="xs">
        {sampleJson ? (
          <Button
            size="xs"
            variant="default"
            leftSection={<IconClipboardText size={ICON_SIZE} />}
            onClick={() => {
              setText(sampleJson)
              setResult(null)
            }}
          >
            {t("json.loadTemplate")}
          </Button>
        ) : null}

        <CopyButton value={text} timeout={2000}>
          {({ copied, copy }) => (
            <Button
              size="xs"
              variant="default"
              disabled={text.trim() === ""}
              leftSection={copied ? <IconCheck size={ICON_SIZE} /> : undefined}
              onClick={copy}
            >
              {copied ? t("json.copied") : t("json.copyContent")}
            </Button>
          )}
        </CopyButton>
      </Group>

      <Textarea
        value={text}
        onChange={event => {
          setText(event.currentTarget.value)
        }}
        placeholder='{ "id": "...", "cards": [ ... ] }'
        autosize
        minRows={8}
        maxRows={20}
        styles={{ input: { direction: "ltr", textAlign: "left" } }}
        aria-label={t("json.contentLabel")}
      />

      {result ? (
        <Alert color={result.ok ? "success" : "danger"} variant="light">
          <Stack gap="xs">
            <Text size="sm">{result.message}</Text>
            {result.debugInfo !== undefined ? (
              <Button
                size="xs"
                variant="default"
                onClick={debugInfoHandlers.open}
              >
                {t("json.viewDebugInfo")}
              </Button>
            ) : null}
          </Stack>
        </Alert>
      ) : null}

      <Button
        leftSection={<IconPlus size={ICON_SIZE} />}
        onClick={handleLoad}
        disabled={text.trim() === ""}
      >
        {t("json.loadAndAdd")}
      </Button>

      <ImportDebugModal
        opened={debugInfoOpened}
        onClose={debugInfoHandlers.close}
        debugInfo={result?.debugInfo ?? ""}
      />
    </Stack>
  )
}
