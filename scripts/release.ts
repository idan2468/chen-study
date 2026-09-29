/**
 * Keeps releases in step with CHANGELOG.md, whose top `## [X.Y.Z]` heading is
 * the version being released:
 *
 * - `sync-version [--staged]` sets package.json and package-lock.json to that
 *   version. With `--staged` (the pre-commit hook) it only acts when
 *   CHANGELOG.md is staged, reads the staged copy, and stages the bumped
 *   files so they land in the same commit.
 * - `tag [--since <rev>]` creates the annotated tag `vX.Y.Z` on HEAD, with that
 *   version's changelog section as its message. With `--since` (the
 *   post-commit and post-merge hooks) it only acts on `main` when CHANGELOG.md
 *   or package.json changed since `<rev>`. It never moves an existing tag.
 *
 * Neither pushes: `push.followTags` (set by `npm run prepare`) sends the tag
 * with the next `git push`.
 */
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"

const CHANGELOG = "CHANGELOG.md"
const RELEASE_BRANCH = "main"
const VERSION_HEADING = /^## \[(\d+\.\d+\.\d+)\]/m

type Release = { version: string; section: string }

const git = (...args: string[]) =>
  execFileSync("git", args, { encoding: "utf8" }).trim()

const tryGit = (...args: string[]) => {
  try {
    return git(...args)
  } catch {
    return null
  }
}

/** The top version and its section body (up to the next version heading). */
const parseChangelog = (text: string): Release | null => {
  const match = VERSION_HEADING.exec(text)
  const version = match?.[1]
  if (!match || !version) {
    return null
  }
  const rest = text.slice(match.index + match[0].length)
  const next = rest.search(/^## \[/m)
  const section = (next === -1 ? rest : rest.slice(0, next))
    .replace(/^\s*-\s*\d{4}-\d{2}-\d{2}/, "")
    .trim()
  return { version, section }
}

const packageVersion = (): string =>
  (JSON.parse(readFileSync("package.json", "utf8")) as { version: string })
    .version

const isStaged = (file: string) =>
  git("diff", "--cached", "--name-only").split("\n").includes(file)

/** @param staged Act only when CHANGELOG.md is staged, read the staged copy, and stage the bumped files. */
const syncVersion = (staged: boolean) => {
  if (staged && !isStaged(CHANGELOG)) {
    return
  }
  const release = parseChangelog(
    staged ? git("show", `:${CHANGELOG}`) : readFileSync(CHANGELOG, "utf8"),
  )
  if (!release || release.version === packageVersion()) {
    return
  }
  console.log(
    `Setting the npm version to ${release.version}, from ${CHANGELOG}.`,
  )
  execFileSync("npm", ["version", release.version, "--no-git-tag-version"], {
    stdio: "ignore",
  })
  if (staged) {
    git("add", "package.json", "package-lock.json")
  }
}

/** Whether HEAD is a release candidate: on `main`, with the changelog or version changed since `since`. */
const releaseChangedSince = (since: string) =>
  tryGit("symbolic-ref", "--short", "HEAD") === RELEASE_BRANCH &&
  tryGit("rev-parse", "--verify", "--quiet", since) !== null &&
  git("diff", "--name-only", since, "HEAD", "--", CHANGELOG, "package.json") !==
    ""

/** @param since Only tag when the release changed between this revision and HEAD; `null` tags unconditionally. */
const tagRelease = (since: string | null) => {
  if (since !== null && !releaseChangedSince(since)) {
    return
  }
  const release = parseChangelog(readFileSync(CHANGELOG, "utf8"))
  if (!release) {
    console.warn(`No "## [X.Y.Z]" heading in ${CHANGELOG}; not tagging.`)
    return
  }
  const tag = `v${release.version}`
  if (release.version !== packageVersion()) {
    console.warn(
      `${CHANGELOG} is at ${release.version} but package.json is at ${packageVersion()}; not tagging ${tag}. Run npm run release:version and commit; the hook tags that commit.`,
    )
    return
  }
  const tagged = tryGit("rev-parse", "--verify", "--quiet", `${tag}^{commit}`)
  if (tagged !== null) {
    if (tagged !== git("rev-parse", "HEAD")) {
      console.warn(`${tag} already exists on another commit; leaving it there.`)
    }
    return
  }
  execFileSync("git", ["tag", "-a", tag, "--cleanup=whitespace", "-F", "-"], {
    input: `${tag}\n\n${release.section}\n`,
  })
  console.log(
    `Tagged ${tag}. Push it with git push (push.followTags) or git push origin ${tag}.`,
  )
}

const [command, ...args] = process.argv.slice(2)
const sinceIndex = args.indexOf("--since")
const since = sinceIndex === -1 ? null : args[sinceIndex + 1]

if (command === "sync-version") {
  syncVersion(args.includes("--staged"))
} else if (command === "tag" && since !== undefined) {
  tagRelease(since)
} else {
  console.error(
    "Usage: release.ts sync-version [--staged] | tag [--since <rev>]",
  )
  process.exit(1)
}
