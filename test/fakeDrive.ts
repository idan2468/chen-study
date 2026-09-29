/**
 * An in-memory Drive `appDataFolder` that answers the exact REST calls the app
 * makes (see `src/utils/sync/google/driveFiles.ts` and `googleAuth.ts`), so sync
 * flows can run end to end without Google. Every request is logged, letting
 * tests check what was sent to Google.
 *
 * Dependency-free on purpose: the browser manual test serves it from a small
 * Node server too.
 */

export type FakeDriveFile = {
  id: string
  name: string
  content: string
  modifiedTime: string
}

export type FakeDriveRequest = {
  method: string
  /** Path plus query, e.g. `/drive/v3/files/abc?alt=media`. */
  url: string
  body: string
}

const GOOGLE_API_ORIGIN = "https://www.googleapis.com"

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })

/** Splits an RFC 2387 `multipart/related` body into its metadata and media parts. */
const parseMultipartRelated = (body: string, contentType: string) => {
  const boundary = contentType.replace(/^multipart\/related; boundary=/, "")
  const [metadataPart = "", mediaPart = ""] = body
    .split(`--${boundary}`)
    .slice(1, 3)
  const partBody = (part: string) =>
    part.slice(part.indexOf("\r\n\r\n") + 4).replace(/\r\n$/, "")
  return {
    metadata: JSON.parse(partBody(metadataPart)) as { name: string },
    content: partBody(mediaPart),
  }
}

/**
 * @param token The access token requests must carry; anything else gets a 401,
 *   like an expired token.
 * @param email The address `userinfo` reports for that token.
 */
export const createFakeDrive = ({
  token = "fake-token",
  email = "chen@example.com",
} = {}) => {
  const files: FakeDriveFile[] = []
  const requests: FakeDriveRequest[] = []
  let nextId = 1
  let clock = Date.parse("2026-01-01T00:00:00.000Z")

  const touch = (file: FakeDriveFile) => {
    clock += 1000
    file.modifiedTime = new Date(clock).toISOString()
  }

  const addFile = (name: string, content: string) => {
    const file = {
      id: `file-${String(nextId++)}`,
      name,
      content,
      modifiedTime: "",
    }
    touch(file)
    files.push(file)
    return file
  }

  const findFile = (id: string) => files.find(file => file.id === id)

  const route = (
    method: string,
    url: URL,
    body: string,
    contentType: string,
  ) => {
    if (url.pathname === "/oauth2/v3/userinfo") {
      return json({ email })
    }
    if (method === "GET" && url.pathname === "/drive/v3/files") {
      const name = /^name='(.*)'$/.exec(url.searchParams.get("q") ?? "")?.[1]
      return json({
        files: files
          .filter(file => file.name === name)
          .map(({ id, modifiedTime }) => ({ id, modifiedTime })),
      })
    }
    const fileId = /^\/(?:upload\/)?drive\/v3\/files\/([^/]+)$/.exec(
      url.pathname,
    )?.[1]
    const file = fileId ? findFile(fileId) : undefined
    if (fileId && !file) {
      return json({ error: "not found" }, 404)
    }
    if (method === "GET" && file && url.searchParams.get("alt") === "media") {
      return new Response(file.content, { status: 200 })
    }
    if (method === "POST" && url.pathname === "/upload/drive/v3/files") {
      const { metadata, content } = parseMultipartRelated(body, contentType)
      const created = addFile(metadata.name, content)
      return json({ id: created.id })
    }
    if (method === "PATCH" && file && url.pathname.startsWith("/upload/")) {
      file.content = body
      touch(file)
      return json({ id: file.id })
    }
    if (method === "PATCH" && file) {
      file.name = (JSON.parse(body) as { name: string }).name
      touch(file)
      return json({ id: file.id })
    }
    return json({ error: `unhandled ${method} ${url.pathname}` }, 400)
  }

  const handle = (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    if (url.origin !== GOOGLE_API_ORIGIN) {
      throw new Error(
        `fake Drive only answers ${GOOGLE_API_ORIGIN}, got ${url.origin}`,
      )
    }
    const headers = new Headers(init.headers)
    const method = init.method ?? "GET"
    const body = typeof init.body === "string" ? init.body : ""
    requests.push({ method, url: url.pathname + url.search, body })
    if (headers.get("Authorization") !== `Bearer ${token}`) {
      return json({ error: "unauthorized" }, 401)
    }
    return route(method, url, body, headers.get("Content-Type") ?? "")
  }

  /** A drop-in `fetch` for `googleapis.com`. */
  const fetch = (input: string | URL | Request, init?: RequestInit) =>
    Promise.resolve().then(() => handle(input, init))

  const fileNamed = (name: string) => files.find(file => file.name === name)

  return {
    fetch,
    files,
    requests,
    fileNamed,
    /** Parses a JSON file's content, e.g. `progress-v2.json`. */
    readJson: (name: string): unknown => {
      const file = fileNamed(name)
      return file ? JSON.parse(file.content) : undefined
    },
    /** Request log as `METHOD /path` lines, for readable assertions. */
    calls: () =>
      requests.map(({ method, url }) => `${method} ${url.split("?")[0] ?? ""}`),
    clearRequests: () => {
      requests.length = 0
    },
  }
}

export type FakeDrive = ReturnType<typeof createFakeDrive>
