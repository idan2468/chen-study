/*
 * Teaches i18next the shape of our catalogue, so `t("modules.statKnown")` is
 * checked at compile time and a typo is an error rather than a string echoed
 * back at runtime.
 *
 * `interface` is required here: TypeScript declaration merging only works with
 * interfaces, so the project's `consistent-type-definitions: ["error", "type"]`
 * rule has to be waived for this one declaration.
 */
/* eslint-disable @typescript-eslint/consistent-type-definitions */
import type { he } from "./he"

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation"
    resources: {
      translation: typeof he
    }
  }
}
