#!/usr/bin/env node
/**
 * Blocks committing scratch/debug files -- the kind of one-off file created
 * while investigating something (e.g. `__csscheck.test.tsx`, a throwaway
 * `.test.tsx` that just logged CSS-Module class names to the console) that
 * looks like a real test/source file at a glance but isn't meant to ship.
 *
 * Runs against the staged file list (`git diff --cached --name-only`), not
 * the whole working tree, so it only ever blocks *this* commit.
 *
 * Deliberately name-pattern based, not content based (e.g. scanning for
 * `console.log`): a real test legitimately logging something for debugging
 * during development is normal, but a file *named* `debug.ts`/`scratch.tsx`/
 * `probe.test.tsx` has no legitimate reason to be committed regardless of
 * what's inside it.
 */
const { execFileSync } = require("node:child_process")
const path = require("node:path")

const DEBUG_NAME_PATTERNS = [
  /^__.*check$/, // e.g. __csscheck
  /^probe$/,
  /^scratch/,
  /^debug/,
  /^sandbox/,
  /^playground/,
  /^wip[._-]/,
  /^tmp[._-]/,
  /[._-]tmp$/,
  /[._-]scratch$/,
  /[._-]wip$/,
]

const getStagedFiles = () =>
  execFileSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACM"], {
    encoding: "utf8",
  })
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)

const isDebugFile = filePath => {
  const base = path.basename(filePath).toLowerCase()
  const nameWithoutExt = base.split(".")[0] ?? base
  return DEBUG_NAME_PATTERNS.some(pattern => pattern.test(nameWithoutExt))
}

const staged = getStagedFiles()
const offenders = staged.filter(isDebugFile)

if (offenders.length > 0) {
  console.error("\n✖ Refusing to commit what look like debug/scratch files:\n")
  for (const file of offenders) {
    console.error(`  ${file}`)
  }
  console.error(
    "\nIf this is a real file, rename it away from the debug-style pattern " +
      "that matched. If it really is a scratch file, unstage and delete it " +
      "instead: git restore --staged <file> && rm <file>\n",
  )
  process.exit(1)
}
