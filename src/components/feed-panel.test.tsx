import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createAgent } from '@ui-sdk/react/agent'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { FeedPanel } from './feed-panel'

beforeEach(() => localStorage.clear())
afterEach(() => vi.unstubAllGlobals())
const agent = createAgent()
const entry = {
  id: 'github:acme/tool',
  source: 'github-trending',
  title: 'acme/tool',
  description: 'A useful tool.',
  url: 'https://github.com/acme/tool',
}
const feed = {
  source: 'github-trending',
  period: 'daily',
  fetchedAt: '2026-11-27T10:00:00Z',
  stale: false,
  entries: [entry],
}
function mockFeed() {
  const fetch = vi
    .fn()
    .mockImplementation(async () => new Response(JSON.stringify(feed)))
  vi.stubGlobal('fetch', fetch)
  return fetch
}

test('visibility works with keyboard and agent actions, keeps focus, and remembers a closed section', async () => {
  const fetch = mockFeed()
  const save = vi.fn()
  const view = render(<FeedPanel saved={[entry]} onSave={save} />)
  await screen.findByRole('link', { name: 'acme / tool' })
  const user = userEvent.setup()
  const visibility = screen.getByRole('button', {
    name: 'GitHub Trending visibility',
  })
  expect(visibility.getAttribute('aria-expanded')).toBe('true')
  expect(visibility.textContent).toBe('Visible')
  expect(visibility.hasAttribute('aria-disabled')).toBe(false)
  expect(
    agent
      .snapshot()
      .some(
        (component) =>
          !component.offPage &&
          component.label === 'GitHub Trending visibility',
      ),
  ).toBe(true)
  visibility.focus()
  await user.keyboard(' ')
  await waitFor(() =>
    expect(screen.queryByRole('link', { name: 'acme / tool' })).toBeNull(),
  )
  expect(visibility.getAttribute('aria-expanded')).toBe('false')
  expect(visibility.textContent).toBe('Hidden')
  expect(document.activeElement).toBe(visibility)
  expect(screen.queryByRole('radiogroup')).toBeNull()
  expect(
    screen.queryByRole('button', { name: 'Refresh GitHub Trending' }),
  ).toBeNull()
  await user.keyboard('{Enter}')
  await screen.findByRole('link', { name: 'acme / tool' })
  const bookmark = screen.getByRole('button', { name: 'Save acme/tool' })
  expect(bookmark.getAttribute('aria-pressed')).toBe('true')
  bookmark.focus()
  await act(async () => {
    const result = await agent.act({
      steps: [
        { ref: 'GitHub Trending visibility', action: 'setOpen', args: [false] },
      ],
    })
    expect(result.ok, result.error?.message).toBe(true)
  })
  expect(document.activeElement).toBe(visibility)
  expect(save).not.toHaveBeenCalled()
  view.unmount()
  const before = fetch.mock.calls.length
  render(<FeedPanel saved={[entry]} onSave={save} />)
  expect(
    screen
      .getByRole('button', { name: 'GitHub Trending visibility' })
      .getAttribute('aria-expanded'),
  ).toBe('false')
  expect(screen.getByRole('heading', { name: 'GitHub Trending' })).toBeTruthy()
  expect(fetch).toHaveBeenCalledTimes(before)
  await act(async () => {
    const result = await agent.act({
      steps: [
        { ref: 'GitHub Trending visibility', action: 'setOpen', args: [true] },
      ],
    })
    expect(result.ok, result.error?.message).toBe(true)
  })
  await screen.findByRole('link', { name: 'acme / tool' })
})

test('hiding aborts an in-flight feed request and reopening loads again', async () => {
  let resolve!: (response: Response) => void
  let signal!: AbortSignal
  const fetch = vi
    .fn()
    .mockImplementationOnce((_url, options) => {
      signal = options.signal
      return new Promise<Response>((done) => {
        resolve = done
      })
    })
    .mockImplementation(async () => new Response(JSON.stringify(feed)))
  vi.stubGlobal('fetch', fetch)
  render(<FeedPanel saved={[]} onSave={() => {}} />)
  const user = userEvent.setup()
  await user.click(
    screen.getByRole('button', { name: 'GitHub Trending visibility' }),
  )
  expect(signal.aborted).toBe(true)
  await act(async () => resolve(new Response(JSON.stringify(feed))))
  expect(screen.queryByRole('link', { name: 'acme / tool' })).toBeNull()
  await user.click(
    screen.getByRole('button', { name: 'GitHub Trending visibility' }),
  )
  await screen.findByRole('link', { name: 'acme / tool' })
  expect(fetch).toHaveBeenCalledTimes(2)
})

test('visibility still works when browser preference storage is blocked', async () => {
  mockFeed()
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('Blocked')
  })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('Blocked')
  })
  render(<FeedPanel saved={[]} onSave={() => {}} />)
  const user = userEvent.setup()
  const visibility = screen.getByRole('button', {
    name: 'GitHub Trending visibility',
  })
  await screen.findByRole('link', { name: 'acme / tool' })
  await user.click(visibility)
  expect(visibility.getAttribute('aria-expanded')).toBe('false')
  await user.click(visibility)
  await screen.findByRole('link', { name: 'acme / tool' })
  expect(visibility.getAttribute('aria-expanded')).toBe('true')
})

test('renders another provider without GitHub fields or period controls', async () => {
  const entry = {
    id: 'journal:one',
    source: 'journal',
    title: 'A thoughtful essay',
    description: 'A short preview.',
    url: 'https://example.com/essay',
  }
  const fetch = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        source: 'journal',
        period: 'daily',
        fetchedAt: '2026-11-14T10:00:00Z',
        stale: false,
        entries: [entry],
      }),
    ),
  )
  vi.stubGlobal('fetch', fetch)
  render(
    <FeedPanel
      saved={[]}
      onSave={() => {}}
      source={{
        id: 'journal',
        name: 'Journal',
        description: 'Something worth reading.',
        url: 'https://example.com',
        linkLabel: 'Open Journal',
        periods: [],
      }}
    />,
  )
  expect(
    (
      await screen.findByRole('link', { name: 'A thoughtful essay' })
    ).getAttribute('href'),
  ).toBe('https://example.com/essay')
  expect(fetch.mock.calls[0][0]).toBe('/api/feeds/journal?period=daily')
  expect(screen.getByRole('heading', { name: 'Journal' })).toBeTruthy()
  expect(screen.queryByRole('radiogroup')).toBeNull()
})
