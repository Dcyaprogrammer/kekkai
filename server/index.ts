import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { feedMiddleware } from './feeds.ts'

const root = fileURLToPath(new URL('../dist/', import.meta.url))
const types: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
}

const server = createServer((req, res) => {
  void feedMiddleware(req, res, () => {
    void (async () => {
      try {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          res.writeHead(405, { Allow: 'GET, HEAD' }).end()
          return
        }
        const pathname = decodeURIComponent(
          new URL(req.url ?? '/', 'http://localhost').pathname,
        )
        const path = resolve(
          root,
          `.${pathname === '/' ? '/index.html' : pathname}`,
        )
        if (
          !path.startsWith(resolve(root) + sep) ||
          !(await stat(path)).isFile()
        ) {
          res.writeHead(404).end('Not found')
          return
        }
        const body = await readFile(path)
        res.writeHead(200, {
          'Content-Type': types[extname(path)] ?? 'application/octet-stream',
          'X-Content-Type-Options': 'nosniff',
        })
        res.end(req.method === 'HEAD' ? undefined : body)
      } catch {
        res.writeHead(404).end('Not found')
      }
    })()
  })
})

server.listen(
  Number(process.env.PORT ?? 4173),
  process.env.HOST ?? '127.0.0.1',
  () => {
    console.log(
      `Kekkai is running at http://${process.env.HOST ?? '127.0.0.1'}:${process.env.PORT ?? 4173}`,
    )
  },
)
