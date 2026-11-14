import { load } from 'cheerio'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { FeedEntry, FeedResult } from '../src/workspace.ts'

type Period = 'daily' | 'weekly'
type Provider = { id: string; load: (period: Period) => Promise<FeedEntry[]> }

export function parseTrending(html: string): FeedEntry[] {
  const $ = load(html)
  const entries: FeedEntry[] = []
  $('article.Box-row').each((_index, article) => {
    const row = $(article)
    const href = row.find('h2 a').attr('href') ?? ''
    if (!/^\/[\w.-]+\/[\w.-]+$/.test(href)) return
    const count = (text: string) => Number(text.replace(/[^\d]/g, '')) || 0
    entries.push({
      id: `github:${href.slice(1)}`,
      source: 'github-trending',
      title: href.slice(1),
      url: `https://github.com${href}`,
      description: row.find('p').first().text().trim().replace(/\s+/g, ' '),
      language:
        row.find('[itemprop="programmingLanguage"]').text().trim() || null,
      stars: count(row.find('a[href$="/stargazers"]').text()),
      gained: count(row.find('.float-sm-right').text()),
    })
  })
  if (!entries.length)
    throw new Error('GitHub returned no readable trending repositories.')
  return entries
}

// shortcut: GitHub exposes Trending as HTML; update this parser if its markup changes.
const github: Provider = {
  id: 'github-trending',
  async load(period) {
    const response = await fetch(
      `https://github.com/trending?since=${period}`,
      {
        headers: {
          'User-Agent': 'Kekkai-Personal-Workspace',
          Accept: 'text/html',
        },
        signal: AbortSignal.timeout(12000),
      },
    )
    if (!response.ok) throw new Error(`GitHub returned ${response.status}.`)
    return parseTrending(await response.text())
  },
}

export const providers: Provider[] = [github]
const cache = new Map<string, FeedResult>()
const pending = new Map<string, Promise<FeedResult>>()
const FRESH_MS = 15 * 60 * 1000
const STALE_MS = 24 * 60 * 60 * 1000

export async function getFeed(
  source: string,
  period: Period,
): Promise<FeedResult> {
  const provider = providers.find((provider) => provider.id === source)
  if (!provider) throw new Error('Unknown feed source.')
  const key = `${source}:${period}`
  const cached = cache.get(key)
  const age = cached ? Date.now() - Date.parse(cached.fetchedAt) : Infinity
  if (cached && age < FRESH_MS) return cached
  const existing = pending.get(key)
  if (existing) return existing
  const request = (async () => {
    try {
      const entries = await provider.load(period)
      const result: FeedResult = {
        source,
        period,
        entries,
        fetchedAt: new Date().toISOString(),
        stale: false,
      }
      cache.set(key, result)
      return result
    } catch (error) {
      if (cached && age < STALE_MS) return { ...cached, stale: true }
      throw error
    } finally {
      pending.delete(key)
    }
  })()
  pending.set(key, request)
  return request
}

export async function feedMiddleware(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
) {
  let url: URL
  try {
    url = new URL(req.url ?? '/', 'http://localhost')
  } catch {
    res.writeHead(400).end('Bad request')
    return
  }
  if (!url.pathname.startsWith('/api/feeds/')) return next()
  if (req.method !== 'GET') {
    res.writeHead(405, { Allow: 'GET' }).end()
    return
  }
  const source = url.pathname.slice('/api/feeds/'.length)
  const period = url.searchParams.get('period') ?? 'daily'
  if (
    !providers.some((provider) => provider.id === source) ||
    !['daily', 'weekly'].includes(period)
  ) {
    res
      .writeHead(400, { 'Content-Type': 'application/json' })
      .end(JSON.stringify({ error: 'Unknown feed or period.' }))
    return
  }
  try {
    const result = await getFeed(source, period as Period)
    res
      .writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      })
      .end(JSON.stringify(result))
  } catch (error) {
    console.warn('Feed refresh failed:', error)
    res.writeHead(502, { 'Content-Type': 'application/json' }).end(
      JSON.stringify({
        error:
          'GitHub Trending is unavailable. Try again shortly, or open it on GitHub.',
      }),
    )
  }
}
