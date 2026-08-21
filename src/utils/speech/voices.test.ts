import { at } from "@test/helpers"
import { pickBestVoice, resolveVoice, voicesForLanguage } from "./voices"

/** `SpeechSynthesisVoice` is exactly these five fields, so no cast is needed. */
const voice = (
  name: string,
  lang = "en-US",
  extra: Partial<SpeechSynthesisVoice> = {},
): SpeechSynthesisVoice => ({
  name,
  lang,
  voiceURI: `uri:${name}`,
  localService: true,
  default: false,
  ...extra,
})

test("prefers premium over enhanced over plain", () => {
  const voices = [voice("Ava"), voice("Ava (Enhanced)"), voice("Ava (Premium)")]

  expect(pickBestVoice(voices, "en")?.name).toBe("Ava (Premium)")
})

test("prefers the modern neural families over legacy voices", () => {
  const voices = [voice("Samantha"), voice("Google US English")]

  expect(pickBestVoice(voices, "en")?.name).toBe("Google US English")
})

describe("Windows", () => {
  test("prefers a cloud Natural voice over the legacy Microsoft default", () => {
    const voices = [
      voice("Microsoft David - English (United States)"),
      voice(
        "Microsoft Ava Online (Natural) - English (United States)",
        "en-US",
        { localService: false },
      ),
    ]

    expect(pickBestVoice(voices, "en")?.name).toBe(
      "Microsoft Ava Online (Natural) - English (United States)",
    )
  })
})

describe("Android", () => {
  // Android/Chrome TTS voices have no readable name at all -- see the comment
  // in `utils/voices.ts` -- so quality has to be read off the `-network` /
  // `-local` suffix instead.
  test("prefers the -network variant over the -local variant of the same voice", () => {
    const voices = [voice("en-us-x-iol-local"), voice("en-us-x-iol-network")]

    expect(pickBestVoice(voices, "en")?.name).toBe("en-us-x-iol-network")
  })

  test("still falls back to the OS default when neither suffix is present", () => {
    const voices = [
      voice("en-us-x-iol"),
      voice("en-us-x-sfg", "en-US", { default: true }),
    ]

    expect(pickBestVoice(voices, "en")?.name).toBe("en-us-x-sfg")
  })
})

describe("novelty voices", () => {
  // macOS mixes joke voices into getVoices() with no flag to identify them.
  test("are never selected, even when they are the only alternative to nothing", () => {
    const voices = [voice("Bad News"), voice("Boing"), voice("Samantha")]

    expect(pickBestVoice(voices, "en")?.name).toBe("Samantha")
  })

  test("are excluded from the picker list entirely", () => {
    const voices = [voice("Bubbles"), voice("Cellos"), voice("Daniel", "en-GB")]

    expect(voicesForLanguage(voices, "en").map(v => v.name)).toStrictEqual([
      "Daniel",
    ])
  })
})

test("falls back to the OS default when no voice carries a quality signal", () => {
  // A stock macOS install: nothing scores, so the default must win rather than
  // whichever name happens to sort first.
  const voices = [
    voice("Alex"),
    voice("Fred"),
    voice("Samantha", "en-US", { default: true }),
  ]

  expect(pickBestVoice(voices, "en")?.name).toBe("Samantha")
})

describe("language matching", () => {
  test("matches on the base tag, so en-GB counts as English", () => {
    const voices = [voice("Daniel", "en-GB"), voice("Amelie", "fr-FR")]

    expect(voicesForLanguage(voices, "en-US").map(v => v.name)).toStrictEqual([
      "Daniel",
    ])
  })

  test("returns nothing when the language is unavailable", () => {
    expect(voicesForLanguage([voice("Samantha")], "he-IL")).toStrictEqual([])
    expect(pickBestVoice([voice("Samantha")], "he-IL")).toBeUndefined()
  })
})

describe("resolveVoice", () => {
  const voices = [
    voice("Samantha", "en-US", { default: true }),
    voice("Daniel", "en-GB"),
    voice("Carmit", "he-IL"),
  ]

  test("honours an explicit choice", () => {
    expect(resolveVoice(voices, "en-US", "uri:Daniel")?.name).toBe("Daniel")
  })

  test("ignores a choice that does not match the language being spoken", () => {
    // Hebrew text must not be read by the chosen English voice.
    expect(resolveVoice(voices, "he-IL", "uri:Daniel")?.name).toBe("Carmit")
  })

  test("falls back to the best voice when the choice is no longer installed", () => {
    expect(resolveVoice(voices, "en-US", "uri:Removed")?.name).toBe("Samantha")
  })

  test("uses the best voice when there is no choice", () => {
    expect(at(voicesForLanguage(voices, "en"), 0).name).toBe("Samantha")
    expect(resolveVoice(voices, "en-US", null)?.name).toBe("Samantha")
  })
})
