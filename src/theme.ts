import type {
  CSSVariablesResolver,
  MantineColorScheme,
  MantineColorSchemeManager,
  MantineColorsTuple,
} from "@mantine/core"
import { createTheme } from "@mantine/core"
import { readString, writeString } from "./store/storage"
import { StorageKeys } from "./utils/storageKeys"

/**
 * The single source of truth for every colour, radius and font in the app.
 *
 * The three original HTML files each hardcoded their own palette:
 * `Modules Practice.html` had `:root` custom properties, `index.html` had the
 * same values under different names, and `Unseen New.html` had no variables at
 * all plus ~35 duplicated `body.dark-mode .x` override rules. All of it is
 * reconciled here, and CSS Modules reference the generated
 * `var(--mantine-*)` variables instead of raw hex values.
 */

/** Slate, lightest to darkest. Indices are chosen so Mantine's semantic
 *  variables land exactly on the originals' dark-mode values:
 *  body = dark[7] (#0f172a), surface = dark[6] (#1e293b),
 *  border = dark[4] (#334155), dimmed text = dark[2] (#94a3b8). */
const dark: MantineColorsTuple = [
  "#f8fafc",
  "#e2e8f0",
  "#94a3b8",
  "#64748b",
  "#334155",
  "#2b3a52",
  "#1e293b",
  "#0f172a",
  "#0b1220",
  "#060a14",
]

/** Sky. `brand[6]` (#0284c7) is the originals' light-mode button fill,
 *  `brand[4]` (#38bdf8) is their dark-mode accent. */
const brand: MantineColorsTuple = [
  "#f0f9ff",
  "#e0f2fe",
  "#bae6fd",
  "#7dd3fc",
  "#38bdf8",
  "#0ea5e9",
  "#0284c7",
  "#0369a1",
  "#075985",
  "#0c4a6e",
]

/** Known / correct. `success[5]` is the originals' `--success-color`. */
const success: MantineColorsTuple = [
  "#f0fdf4",
  "#dcfce7",
  "#bbf7d0",
  "#86efac",
  "#4ade80",
  "#22c55e",
  "#16a34a",
  "#15803d",
  "#166534",
  "#14532d",
]

/** Unknown / incorrect. `danger[5]` is the originals' `--fail-color`. */
const danger: MantineColorsTuple = [
  "#fef2f2",
  "#fee2e2",
  "#fecaca",
  "#fca5a5",
  "#f87171",
  "#ef4444",
  "#dc2626",
  "#b91c1c",
  "#991b1b",
  "#7f1d1d",
]

export const theme = createTheme({
  colors: { dark, brand, success, danger },
  primaryColor: "brand",
  // Light picks the deeper #0284c7 fill; dark picks the bright #38bdf8 accent.
  primaryShade: { light: 6, dark: 4 },
  // Flips text to dark on the bright dark-mode accent, matching the originals'
  // `.card:hover .btn { background: var(--accent-blue); color: #0f172a }`.
  autoContrast: true,
  fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif",
  headings: { fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif" },
  defaultRadius: "md",
  radius: { md: "12px", lg: "16px" },
})

/**
 * A MantineProvider prop rather than part of the theme.
 * `Unseen New.html` used a tinted light background rather than pure white.
 */
export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: { "--mantine-color-body": "#f4f7f6" },
  dark: {},
})

/**
 * Persists the colour scheme under the originals' `dark_mode_enabled` key
 * (`'1'` / `'0'`) instead of Mantine's own `mantine-color-scheme-value`, so a
 * returning user keeps their preference and old sync payloads still apply.
 *
 * Mirrors Mantine's built-in `localStorageColorSchemeManager`, with the value
 * mapping and the legacy key swapped in.
 */
export const colorSchemeManager = (): MantineColorSchemeManager => {
  let handleStorageEvent: ((event: StorageEvent) => void) | undefined

  const toScheme = (raw: string): MantineColorScheme =>
    raw === "0" ? "light" : "dark"

  return {
    get: defaultValue => {
      const raw = readString(StorageKeys.darkMode, "")
      return raw === "" ? defaultValue : toScheme(raw)
    },

    set: value => {
      // `auto` has no representation in the legacy '1'/'0' format; resolve it
      // against the OS preference so the stored value stays round-trippable.
      const isDark =
        value === "auto"
          ? window.matchMedia("(prefers-color-scheme: dark)").matches
          : value === "dark"
      writeString(StorageKeys.darkMode, isDark ? "1" : "0")
    },

    subscribe: onUpdate => {
      handleStorageEvent = event => {
        if (
          event.storageArea === window.localStorage &&
          event.key === StorageKeys.darkMode &&
          event.newValue !== null
        ) {
          onUpdate(toScheme(event.newValue))
        }
      }
      window.addEventListener("storage", handleStorageEvent)
    },

    unsubscribe: () => {
      if (handleStorageEvent) {
        window.removeEventListener("storage", handleStorageEvent)
      }
    },

    clear: () => {
      window.localStorage.removeItem(StorageKeys.darkMode)
    },
  }
}
