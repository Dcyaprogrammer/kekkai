import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { parseTrending } from './feeds.ts'

const html = `<main>
<article class="Box-row"><h2><a href="/owner/project"> owner / project </a></h2><p>A useful &amp; thoughtful\n project.</p><span itemprop="programmingLanguage">TypeScript</span><a href="/owner/project/stargazers">12,345</a><span class="float-sm-right">1,234 stars today</span></article>
<article class="Box-row"><h2><a href="/another/tool">another/tool</a></h2><a href="/another/tool/stargazers">42</a><span class="float-sm-right">9 stars this week</span></article>
<article class="Box-row"><h2><a href="//evil.example/trap">Bad URL</a></h2></article>
</main>`

beforeEach(() => vi.resetModules())
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

test('extracts actual Trending fields and refuses malformed upstream pages', () => {
  expect(parseTrending(html)).toEqual([
    {
      id: 'github:owner/project',
      source: 'github-trending',
      title: 'owner/project',
      url: 'https://github.com/owner/project',
      description: 'A useful & thoughtful project.',
      language: 'TypeScript',
      stars: 12345,
      gained: 1234,
    },
    {
      id: 'github:another/tool',
      source: 'github-trending',
      title: 'another/tool',
      url: 'https://github.com/another/tool',
      description: '',
      language: null,
      stars: 42,
      gained: 9,
    },
  ])
  expect(() => parseTrending('<main>Upstream unavailable</main>')).toThrow(
    'no readable trending',
  )
})

test('shares in-flight requests and caches each period independently', async () => {
  const fetch = vi.fn().mockImplementation(async () => new Response(html))
  vi.stubGlobal('fetch', fetch)
  const { getFeed } = await import('./feeds.ts')
  const [first, second] = await Promise.all([
    getFeed('github-trending', 'daily'),
    getFeed('github-trending', 'daily'),
  ])
  expect(first).toEqual(second)
  expect(first.stale).toBe(false)
  expect(fetch).toHaveBeenCalledTimes(1)
  await getFeed('github-trending', 'daily')
  expect(fetch).toHaveBeenCalledTimes(1)
  await getFeed('github-trending', 'weekly')
  expect(fetch).toHaveBeenCalledTimes(2)
  expect(fetch.mock.calls[1][0]).toBe(
    'https://github.com/trending?since=weekly',
  )
})

test('serves a dated stale result on failure, but never an unbounded old result', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-14T10:00:00Z'))
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response(html))
    .mockRejectedValue(new Error('offline'))
  vi.stubGlobal('fetch', fetch)
  const { getFeed } = await import('./feeds.ts')
  await getFeed('github-trending', 'daily')
  vi.setSystemTime(new Date('2026-11-14T10:20:00Z'))
  expect(await getFeed('github-trending', 'daily')).toMatchObject({
    stale: true,
    fetchedAt: '2026-11-14T10:00:00.000Z',
  })
  vi.setSystemTime(new Date('2026-11-15T11:00:00Z'))
  await expect(getFeed('github-trending', 'daily')).rejects.toThrow('offline')
})

test('reports an upstream error and rejects unknown sources before fetching', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(new Response('Rate limited', { status: 429 }))
  vi.stubGlobal('fetch', fetch)
  const { getFeed } = await import('./feeds.ts')
  await expect(getFeed('unknown', 'daily')).rejects.toThrow('Unknown feed')
  expect(fetch).not.toHaveBeenCalled()
  await expect(getFeed('github-trending', 'daily')).rejects.toThrow('429')
})

test.each(['node', 'vercel'])(
  '%s HTTP boundary rejects unknown sources, periods, methods, and malformed URLs',
  async (runtime) => {
    const { createServer } = await import('node:http')
    const { feedMiddleware } = await import('./feeds.ts')
    const { default: vercelHandler } = await import('../api/feeds/[source].ts')
    const server = createServer((request, response) => {
      if (runtime === 'vercel') void vercelHandler(request, response)
      else
        void feedMiddleware(request, response, () =>
          response.writeHead(404).end(),
        )
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string')
      throw new Error('No server address')
    const origin = `http://127.0.0.1:${address.port}`
    const request = globalThis.fetch
    try {
      expect((await fetch(`${origin}/api/feeds/unknown`)).status).toBe(400)
      expect(
        (await fetch(`${origin}/api/feeds/github-trending?period=forever`))
          .status,
      ).toBe(400)
      const post = await fetch(`${origin}/api/feeds/github-trending`, {
        method: 'POST',
      })
      expect(post.status).toBe(405)
      expect(post.headers.get('allow')).toBe('GET')
      expect((await fetch(`${origin}//`)).status).toBe(400)
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(html)))
      const feed = await request(
        `${origin}/api/feeds/github-trending?period=weekly`,
      )
      expect(feed.status).toBe(200)
      expect(await feed.json()).toMatchObject({
        source: 'github-trending',
        period: 'weekly',
        stale: false,
        entries: [
          expect.objectContaining({ title: 'owner/project' }),
          expect.objectContaining({ title: 'another/tool' }),
        ],
      })
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      )
    }
  },
)
