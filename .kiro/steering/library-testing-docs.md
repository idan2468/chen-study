# Check library testing docs first

When a test fails, hangs, or times out because of how a third-party library (Mantine, Floating UI, etc.) behaves in jsdom — not because of a bug in our own code — look for that library's own testing guidance before reverse-engineering a fix:

1. Check the library's official docs/changelog for a "Testing" section, a documented test-environment flag or prop, or a recommended jsdom setup (e.g. Mantine's `MantineProvider` has an `env="test"` prop, documented as disabling transitions and portals for exactly this kind of jsdom flakiness).
2. Search the library's own repo/issues for the specific error or symptom before assuming it needs a manual polyfill or workaround.
3. Only fall back to a manual polyfill (e.g. stubbing `ResizeObserver`) once a real browser API is confirmed missing in jsdom and the library has no built-in test-mode support for it.
4. Prefer the documented mechanism over ad-hoc timeouts, retries, or extra `waitFor` calls, even if the ad-hoc fix happens to work — the documented path holds up better across library versions and other tests using the same component.
