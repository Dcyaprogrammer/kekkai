import { render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { FeedPanel } from './feed-panel'

afterEach(() => vi.unstubAllGlobals())

test('renders another provider without GitHub fields or period controls', async () => {
  const entry = {
    id: 'journal:one',
    source: 'journal',
    title: 'A thoughtful essay',
    description: 'A short preview.',
    url: 'https://example.com/essay',
  }
  const fetch = vi
    .fn()
    .mockResolvedValue(
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
