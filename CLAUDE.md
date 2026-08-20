# Comment style rules

Apply these rules whenever adding, editing, or reviewing comments in this repo:

1. If a comment exists to explain something that could instead be made self-explanatory through refactoring (renaming a variable/function, extracting a well-named helper), do the refactor and remove the comment rather than keeping both.
2. If a comment explains a crucial, non-obvious edge case (a real bug fix, a platform quirk, a business rule that isn't visible in the code), keep it — but keep it concise, not verbose. One or two sentences, not a paragraph.
3. Config files are lower priority for comment cleanup than business logic files. Don't spend effort stripping comments from config; focus on `src/` application code.
4. Doc comments on functions are worth keeping only if they add real clarity beyond the function signature. Prefer a clearer name or a small refactor over adding/keeping a comment when either would make the comment unnecessary.

Target audience for comments: a mid-level full-stack developer (~4 years experience) working in this repo. Don't over-explain basics; only keep what a competent dev would actually need to safely change the code.

# Component reuse rule

Apply this before creating any new component, icon, or piece of UI markup in this repo:

1. Search `src/components/` first for an existing component that already covers this responsibility (by name and by purpose) — reuse or extend it instead of adding a near-duplicate.
2. Check Mantine (`@mantine/core`, `@mantine/hooks`, `@mantine/notifications`, `@mantine/modals` — our UI library) for a built-in component or prop that already covers it (e.g. `Button`'s `leftSection` instead of hand-wrapping an icon layout) before writing custom markup.
3. For things Mantine doesn't ship as a component (e.g. brand icons/logos), check Mantine's own published recipes at [ui.mantine.dev](https://ui.mantine.dev) before reaching for a separate npm package or hand-rolling one from scratch.
4. Only add a new dependency or write something fully from scratch once 1–3 are confirmed to not cover it, and the need is generic enough to justify it.

