# Component reuse rule

Apply this before creating any new component, icon, or piece of UI markup in this repo:

1. Search `src/components/` first for an existing component that already covers this responsibility (by name and by purpose) — reuse or extend it instead of adding a near-duplicate.
2. Check Mantine (`@mantine/core`, `@mantine/hooks`, `@mantine/notifications`, `@mantine/modals` — our UI library) for a built-in component or prop that already covers it (e.g. `Button`'s `leftSection` instead of hand-wrapping an icon layout) before writing custom markup.
3. For things Mantine doesn't ship as a component (e.g. brand icons/logos), check Mantine's own published recipes at [ui.mantine.dev](https://ui.mantine.dev) before reaching for a separate npm package or hand-rolling one from scratch.
4. Only add a new dependency or write something fully from scratch once 1–3 are confirmed to not cover it, and the need is generic enough to justify it.
