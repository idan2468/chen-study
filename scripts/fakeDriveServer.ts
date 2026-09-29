/**
 * Serves `test/fakeDrive.ts` over HTTP for manual browser testing, so several
 * isolated browser contexts ("devices") share one in-memory Drive and the real
 * Google account is never touched. See "Manual web testing with the fake
 * Drive" in CLAUDE.md. State resets when the server stops.
 */
import { createServer } from "node:http"
import { createFakeDrive } from "../test/fakeDrive.ts"

const PORT = 5299

const drive = createFakeDrive()

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
}

/** Inspection endpoints: the file list with the request log, and the parsed `progress-v2.json`. */
const inspect = (path: string | undefined) => {
  if (path === "/__drive") {
    return {
      files: drive.files.map(({ id, name, modifiedTime }) => ({
        id,
        name,
        modifiedTime,
      })),
      calls: drive.calls(),
    }
  }
  if (path === "/__drive/v2") {
    return drive.readJson("progress-v2.json") ?? null
  }
  return undefined
}

createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, CORS_HEADERS).end()
    return
  }

  const inspection = inspect(request.url)
  if (inspection !== undefined) {
    response.writeHead(200, {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
    })
    response.end(JSON.stringify(inspection))
    return
  }

  const chunks: Buffer[] = []
  for await (const chunk of request) {
    chunks.push(chunk as Buffer)
  }
  const headers = new Headers()
  for (const [name, value] of Object.entries(request.headers)) {
    if (typeof value === "string") {
      headers.set(name, value)
    }
  }

  const answer = await drive.fetch(
    `https://www.googleapis.com${request.url ?? "/"}`,
    {
      method: request.method,
      headers,
      body: chunks.length > 0 ? Buffer.concat(chunks).toString() : undefined,
    },
  )
  response.writeHead(answer.status, {
    ...CORS_HEADERS,
    "Content-Type": answer.headers.get("Content-Type") ?? "application/json",
  })
  response.end(await answer.text())
}).listen(PORT, () => {
  console.log(`Fake Drive on http://localhost:${String(PORT)}`)
})
