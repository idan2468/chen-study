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
import { useTranslation } from "react-i18next"

/** What a page's parser reports back to the loader, already translated. */
export type JsonParseResult = {
  ok: boolean
  message: string
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
          {result.message}
        </Alert>
      ) : null}

      <Button onClick={handleLoad} disabled={text.trim() === ""}>
        {t("json.loadAndAdd")}
      </Button>
    </Stack>
  )
}
