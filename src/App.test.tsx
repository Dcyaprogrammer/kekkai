import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createAgent } from '@ui-sdk/react/agent'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from './App'
import { emptyWorkspace, localDate, STORAGE_KEY } from './workspace'

const agent = createAgent()
const entry = {
  id: 'github:acme/atlas',
  source: 'github-trending',
  title: 'acme/atlas',
  description: 'A calmer way to build software.',
  url: 'https://github.com/acme/atlas',
  language: 'TypeScript',
  stars: 1200,
  gained: 42,
}
const feed = {
  source: 'github-trending',
  period: 'daily',
  fetchedAt: '2026-11-14T10:00:00Z',
  stale: false,
  entries: [entry],
}

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(
      async (url: string) =>
        new Response(
          JSON.stringify({
            ...feed,
            period: url.includes('weekly') ? 'weekly' : 'daily',
          }),
          { headers: { 'Content-Type': 'application/json' } },
        ),
    ),
  )
})
afterEach(() => vi.unstubAllGlobals())

async function quickTask(title: string) {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Quick task title'), `${title}{Enter}`)
  return user
}

test('captures tasks, completes them with Space, and restores them after reload', async () => {
  const view = render(<App />)
  const user = await quickTask('Sketch a calmer homepage')
  const checkbox = screen.getByRole('checkbox', {
    name: 'Complete Sketch a calmer homepage',
  })
  checkbox.focus()
  await user.keyboard(' ')
  await user.click(screen.getByRole('radio', { name: 'Completed' }))
  expect(
    screen
      .getByRole('checkbox', { name: 'Complete Sketch a calmer homepage' })
      .getAttribute('aria-checked'),
  ).toBe('true')
  view.unmount()
  render(<App />)
  await user.click(screen.getByRole('radio', { name: 'Completed' }))
  expect(
    screen.getByRole('button', { name: 'Edit Sketch a calmer homepage' }),
  ).toBeTruthy()
  expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).items[0]).toMatchObject(
    { title: 'Sketch a calmer homepage', done: true },
  )
})

test('adds a deadline for the selected day, edits it, and deletes with undo', async () => {
  render(<App />)
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Add deadline' }))
  const dialog = screen.getByRole('dialog', { name: 'New deadline' })
  await user.type(within(dialog).getByLabelText('Title'), 'Ship the proposal')
  expect(
    (within(dialog).getByLabelText('Deadline date') as HTMLInputElement).value,
  ).toBe(localDate())
  await user.click(within(dialog).getByRole('button', { name: 'Add deadline' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(screen.getByRole('gridcell', { name: /1 deadline/ })).toBeTruthy()
  await user.click(
    screen.getByRole('button', { name: 'Edit deadline Ship the proposal' }),
  )
  const edit = screen.getByRole('dialog', { name: 'Edit deadline' })
  await user.clear(within(edit).getByLabelText('Title'))
  await user.type(
    within(edit).getByLabelText('Title'),
    'Ship the revised proposal',
  )
  await user.click(within(edit).getByRole('button', { name: 'Save changes' }))
  await user.click(
    screen.getByRole('button', {
      name: 'Edit deadline Ship the revised proposal',
    }),
  )
  await user.click(screen.getByRole('button', { name: 'Delete deadline' }))
  expect(
    screen.queryByRole('checkbox', {
      name: 'Complete deadline Ship the revised proposal',
    }),
  ).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Undo' }))
  expect(
    screen.getByRole('checkbox', {
      name: 'Complete deadline Ship the revised proposal',
    }),
  ).toBeTruthy()
})

test('validates an empty title, cancels, and closes with Escape without creating data', async () => {
  render(<App />)
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'New task' }))
  await user.click(screen.getByRole('button', { name: 'Add task' }))
  expect(
    (screen.getByLabelText('Title') as HTMLInputElement).validity.valueMissing,
  ).toBe(true)
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  await user.click(screen.getByRole('button', { name: 'New task' }))
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'New task' }),
    ),
  )
})

test('saves a real feed entry independently from the current Trending list', async () => {
  render(<App />)
  const user = userEvent.setup()
  const save = await screen.findByRole('button', { name: 'Save acme/atlas' })
  await user.click(save)
  expect(save.getAttribute('aria-pressed')).toBe('true')
  await user.click(screen.getByRole('button', { name: /^Saved/ }))
  expect(
    screen.getByRole('link', { name: /acme \/ atlas/ }).getAttribute('href'),
  ).toBe('https://github.com/acme/atlas')
  await user.click(screen.getByRole('button', { name: 'Save acme/atlas' }))
  expect(screen.getByText('Keep something worth coming back to.')).toBeTruthy()
})

test('changes Trending period and recovers from a visible fetch error', async () => {
  const fetch = vi.mocked(globalThis.fetch)
  fetch.mockRejectedValueOnce(new Error('Offline'))
  render(<App />)
  const user = userEvent.setup()
  await screen.findByText('Your feed will be back.')
  await user.click(screen.getByRole('button', { name: 'Try again' }))
  await screen.findByRole('button', { name: 'Save acme/atlas' })
  await user.click(screen.getByRole('radio', { name: 'This week' }))
  await waitFor(() =>
    expect(fetch.mock.calls.at(-1)?.[0]).toContain('period=weekly'),
  )
  await screen.findByRole('button', { name: 'Save acme/atlas' })
})

test('keeps damaged storage in a recovery copy and reports storage failures', async () => {
  localStorage.setItem(STORAGE_KEY, '{broken backup')
  render(<App />)
  expect(screen.getByRole('alert').textContent).toContain('could not be read')
  await quickTask('A recoverable task')
  expect(localStorage.getItem(`${STORAGE_KEY}.recovery`)).toBe('{broken backup')
  const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('full')
  })
  await quickTask('Keep me in memory')
  expect(screen.getByRole('alert').textContent).toContain('only in memory')
  expect(
    screen.getByRole('button', { name: 'Edit Keep me in memory' }),
  ).toBeTruthy()
  set.mockRestore()
})

test('rejects an invalid backup and merges a valid one through the file picker', async () => {
  render(<App />)
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Backups & storage' }))
  const input = screen.getByLabelText('Restore backup file')
  await user.upload(
    input,
    new File(['{"version":2}'], 'invalid.json', { type: 'application/json' }),
  )
  await screen.findByText('This is not a Kekkai backup.')
  const backup = {
    ...emptyWorkspace,
    items: [
      {
        id: 'restore-one',
        kind: 'task',
        title: 'Restored task',
        date: null,
        done: false,
        notes: '',
      },
    ],
  }
  await user.upload(
    input,
    new File([JSON.stringify(backup)], 'backup.json', {
      type: 'application/json',
    }),
  )
  await screen.findByText('Backup merged into your workspace.')
  await user.click(screen.getByRole('button', { name: 'Done' }))
  expect(
    screen.getByRole('button', { name: 'Edit Restored task' }),
  ).toBeTruthy()
})

test('ui-sdk agent can name controls, create a task, and change calendar selection', async () => {
  render(<App />)
  await screen.findByRole('button', { name: 'Save acme/atlas' })
  await act(async () => {
    const result = await agent.act({
      steps: [
        {
          ref: 'Quick task title',
          action: 'setValue',
          args: ['Plan the week'],
        },
      ],
    })
    expect(result.ok, result.error?.message).toBe(true)
  })
  await act(async () => {
    const result = await agent.act({
      steps: [{ ref: 'Add quick task', action: 'press' }],
    })
    expect(result.ok, result.error?.message).toBe(true)
  })
  expect(
    screen.getByRole('button', { name: 'Edit Plan the week' }),
  ).toBeTruthy()
  const components = agent
    .snapshot()
    .filter((entry) => !entry.offPage && entry.component !== 'more')
  for (const component of components)
    expect(
      component.label,
      `${component.component} has no accessible name`,
    ).toBeTruthy()
  const labels = components.map((entry) => entry.label)
  for (const label of [
    'Deadline calendar',
    'Quick task title',
    'Task filter',
    'Trending period',
    'Save acme/atlas',
    'Complete Plan the week',
  ])
    expect(labels).toContain(label)
  await act(async () => {
    const result = await agent.act({
      steps: [
        { ref: 'Deadline calendar', action: 'setValue', args: ['2026-12-03'] },
      ],
    })
    expect(result.ok, result.error?.message).toBe(true)
  })
  expect(screen.getByRole('heading', { name: 'Thursday Dec 3' })).toBeTruthy()
  const day = screen.getByRole('gridcell', { selected: true })
  day.focus()
  await userEvent.setup().keyboard('{ArrowRight}{Enter}')
  expect(screen.getByRole('heading', { name: 'Friday Dec 4' })).toBeTruthy()
})

test('Undo after restore preserves the restored record and remains reloadable', async () => {
  const item = {
    id: 'undo-restored',
    kind: 'task',
    title: 'A task worth keeping',
    date: null,
    done: false,
    notes: '',
  }
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...emptyWorkspace, items: [item] }),
  )
  const view = render(<App />)
  const user = userEvent.setup()
  await user.click(
    screen.getByRole('button', { name: 'Edit A task worth keeping' }),
  )
  await user.click(screen.getByRole('button', { name: 'Delete task' }))
  await user.click(screen.getByRole('button', { name: 'Backups & storage' }))
  await user.upload(
    screen.getByLabelText('Restore backup file'),
    new File(
      [
        JSON.stringify({
          ...emptyWorkspace,
          items: [{ ...item, title: 'The newer restored title' }],
        }),
      ],
      'backup.json',
      { type: 'application/json' },
    ),
  )
  await screen.findByText('Backup merged into your workspace.')
  await user.click(screen.getByRole('button', { name: 'Done' }))
  await user.click(screen.getByRole('button', { name: 'Undo' }))
  expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).items).toHaveLength(1)
  view.unmount()
  render(<App />)
  expect(
    screen.getByRole('button', { name: 'Edit The newer restored title' }),
  ).toBeTruthy()
  expect(screen.queryByRole('alert')).toBeNull()
})

test.each(['Backups & storage', 'Open workspace backups'])(
  'backup dismissal restores focus to %s',
  async (name) => {
    render(<App />)
    const user = userEvent.setup()
    const trigger = screen.getByRole('button', { name })
    await user.click(trigger)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(document.activeElement === trigger).toBe(true))
    await user.click(trigger)
    await user.click(screen.getByRole('button', { name: 'Done' }))
    await waitFor(() => expect(document.activeElement === trigger).toBe(true))
  },
)

test('an agent cannot persist a task title beyond the backup schema limit', async () => {
  render(<App />)
  await screen.findByRole('button', { name: 'Save acme/atlas' })
  await act(async () => {
    const result = await agent.act({
      steps: [
        {
          ref: 'Quick task title',
          action: 'setValue',
          args: ['x'.repeat(201)],
        },
      ],
    })
    expect(result.ok, result.error?.message).toBe(true)
  })
  expect(
    (
      screen.getByRole('button', {
        name: 'Add quick task',
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true)
  await userEvent.setup().keyboard('{Enter}')
  expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
})
