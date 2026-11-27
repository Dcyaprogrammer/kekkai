import type { IncomingMessage, ServerResponse } from 'node:http'
import { feedMiddleware } from '../../server/feeds.ts'

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  await feedMiddleware(req, res, () => {
    res.writeHead(404).end('Not found')
  })
}
