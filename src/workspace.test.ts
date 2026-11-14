import { describe, expect, test } from 'vitest'
import {
  emptyWorkspace,
  formatDate,
  localDate,
  mergeBackup,
  parseFeed,
  parseWorkspace,
  validDate,
  type Workspace,
} from './workspace'

const workspace: Workspace = {
  version: 1,
  saved: [],
  items: [
    {
      id: 'one',
      kind: 'deadline',
      title: 'Submit the proposal',
      date: '2026-11-18',
      done: false,
      notes: '',
    },
  ],
}

describe('planning backup boundary', () => {
  test('restores a valid backup and preserves local date meaning', () => {
    expect(parseWorkspace(JSON.stringify(workspace))).toEqual(workspace)
    expect(formatDate('2026-11-18')).toBe('Nov 18')
    expect(localDate(new Date(2026, 10, 18, 0, 1))).toBe('2026-11-18')
    expect(validDate('2026-02-30')).toBe(false)
    expect(validDate('2028-02-29')).toBe(true)
  })
  test('merges missing entries without replacing current edits', () => {
    const local = {
      ...workspace,
      items: [{ ...workspace.items[0], title: 'Revised proposal', done: true }],
    }
    const backup = {
      ...workspace,
      items: [
        ...workspace.items,
        { ...workspace.items[0], id: 'two', title: 'Book a review' },
      ],
    }
    expect(
      mergeBackup(local, backup).items.map((item) => [item.title, item.done]),
    ).toEqual([
      ['Revised proposal', true],
      ['Book a review', false],
    ])
  })
  test.each([
    '{',
    JSON.stringify({ ...workspace, version: 2 }),
    JSON.stringify({
      ...workspace,
      items: [{ ...workspace.items[0], date: '2026-02-30' }],
    }),
    JSON.stringify({
      ...workspace,
      items: [{ ...workspace.items[0], date: null }],
    }),
    JSON.stringify({
      ...workspace,
      items: [workspace.items[0], workspace.items[0]],
    }),
    JSON.stringify({
      ...workspace,
      items: [{ ...workspace.items[0], title: ' ' }],
    }),
    JSON.stringify({
      ...emptyWorkspace,
      saved: [
        {
          id: 'bad',
          source: 'other',
          title: 'Unsafe',
          url: 'javascript:alert(1)',
          description: '',
        },
      ],
    }),
  ])(
    'rejects malformed data without changing the original workspace',
    (text) => {
      expect(() => parseWorkspace(text)).toThrow()
      expect(workspace.items[0].title).toBe('Submit the proposal')
    },
  )
  test('accepts another feed source without repository-specific fields', () => {
    const saved = [
      {
        id: 'article:42',
        source: 'publication',
        title: 'A thoughtful essay',
        description: 'A short preview.',
        url: 'https://example.com/essay',
      },
    ]
    expect(
      parseWorkspace(JSON.stringify({ ...emptyWorkspace, saved })).saved,
    ).toEqual(saved)
  })
})

test('feed boundary rejects incorrect periods, duplicate IDs, and unsafe links', () => {
  const result = {
    source: 'github-trending',
    period: 'daily',
    stale: false,
    fetchedAt: '2026-11-14T10:00:00Z',
    entries: [
      {
        id: 'github:one/two',
        source: 'github-trending',
        title: 'one/two',
        url: 'https://github.com/one/two',
        description: 'A project',
        stars: 1200,
        gained: 10,
      },
    ],
  }
  expect(parseFeed(result, 'github-trending', 'daily')).toEqual(result)
  expect(() => parseFeed(result, 'github-trending', 'weekly')).toThrow()
  expect(() =>
    parseFeed(
      { ...result, entries: [...result.entries, ...result.entries] },
      'github-trending',
      'daily',
    ),
  ).toThrow()
  expect(() =>
    parseFeed(
      {
        ...result,
        entries: [{ ...result.entries[0], url: 'javascript:alert(1)' }],
      },
      'github-trending',
      'daily',
    ),
  ).toThrow()
})
