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

test('workspace header follows navigation and keeps backups available in feed views', async () => {
  render(<App />)
  const user = userEvent.setup()
  expect(screen.getByRole('heading', { level: 1, name: 'Overview' })).toBeTruthy()
  expect(
    within(screen.getByRole('navigation', { name: 'Workspace navigation' }))
      .getAllByRole('button')
      .map((button) => button.textContent),
  ).toEqual(['Overview', 'GitHub Trending', 'Saved'])
  expect(screen.getByLabelText('Deadline calendar')).toBeTruthy()
  expect(screen.getByLabelText('Quick task title')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'New task' })).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'GitHub Trending' }))
  expect(
    screen.getByRole('heading', { level: 1, name: 'GitHub Trending' }),
  ).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'New task' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Add deadline' })).toBeNull()
  await screen.findByRole('button', { name: 'Save acme/atlas' })
  expect(
    screen.getByRole('link', { name: 'Open GitHub' }).getAttribute('href'),
  ).toBe('https://github.com/trending')
  const backup = screen.getByRole('button', { name: 'Open workspace backups' })
  expect(
    agent.snapshot().some(
      (entry) => !entry.offPage && entry.label === 'Open workspace backups',
    ),
  ).toBe(true)
  await user.click(backup)
  expect(screen.getByRole('dialog')).toBeTruthy()
  await user.keyboard('{Escape}')
  await waitFor(() => expect(document.activeElement === backup).toBe(true))
  await user.click(screen.getByRole('button', { name: 'Overview' }))
  expect(screen.getByRole('button', { name: 'New task' })).toBeTruthy()
  expect(screen.getByLabelText('Deadline calendar')).toBeTruthy()
  expect(screen.getByLabelText('Quick task title')).toBeTruthy()
})

test('compact planning summary retains the next deadline and overdue count', async () => {
  const today = localDate()
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...emptyWorkspace,
      items: [
        {
          id: 'upcoming',
          kind: 'deadline',
          title: 'Ship layout',
          date: today,
          done: false,
          notes: '',
        },
        {
          id: 'overdue',
          kind: 'task',
          title: 'Review notes',
          date: '2020-01-01',
          done: false,
          notes: '',
        },
      ],
    }),
  )
  render(<App />)
  expect(screen.getByText(/Next deadline:.*Ship layout/)).toBeTruthy()
  expect(screen.getByText('1 overdue')).toBeTruthy()
  await userEvent.setup().click(
    screen.getByRole('button', { name: 'GitHub Trending' }),
  )
  expect(screen.queryByText('1 overdue')).toBeNull()
})

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
  const dialog = screen.getByRole('dialog', { name: /^Agenda for/ })
  await user.type(
    within(dialog).getByLabelText('Deadline name'),
    'Ship the proposal',
  )
  expect(
    (within(dialog).getByLabelText('Deadline date') as HTMLInputElement).value,
  ).toBe(localDate())
  await user.click(within(dialog).getByRole('button', { name: 'Add deadline' }))
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull(),
  )
  expect(screen.getByRole('gridcell', { name: /1 deadline/ })).toBeTruthy()
  await user.click(
    screen.getByRole('button', { name: 'Edit deadline Ship the proposal' }),
  )
  const edit = screen.getByRole('dialog', { name: /^Agenda for/ })
  await user.clear(within(edit).getByLabelText('Deadline name'))
  await user.type(
    within(edit).getByLabelText('Deadline name'),
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
  await user.click(screen.getByRole('gridcell', { name: /1 deadline/ }))
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
    (screen.getByLabelText('Task name') as HTMLInputElement).validity
      .valueMissing,
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
  expect(screen.getByRole('heading', { name: 'No saved items' })).toBeTruthy()
})

test('changes Trending period and recovers from a visible fetch error', async () => {
  const fetch = vi.mocked(globalThis.fetch)
  fetch.mockRejectedValueOnce(new Error('Offline'))
  render(<App />)
  const user = userEvent.setup()
  await screen.findByRole('heading', { name: 'Feed unavailable' })
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
  expect(
    screen.getByRole('dialog', { name: 'Agenda for Thursday, December 3' }),
  ).toBeTruthy()
  await userEvent.setup().keyboard('{Escape}')
  const day = screen.getByRole('gridcell', { selected: true })
  day.focus()
  await userEvent.setup().keyboard('{ArrowRight}{Enter}')
  expect(
    screen.getByRole('dialog', { name: 'Agenda for Friday, December 4' }),
  ).toBeTruthy()
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

test('a date opens its attachment and the editor covers it without losing a draft', async () => {
  render(<App />)
  const user = userEvent.setup()
  const day = screen.getByRole('gridcell', { selected: true })
  await user.click(day)
  let attachment = screen.getByRole('dialog', { name: /^Agenda for/ })
  expect(
    within(attachment).getByText('No deadlines or dated tasks.'),
  ).toBeTruthy()
  await user.click(
    within(attachment).getByRole('button', { name: 'Add deadline' }),
  )
  const title = within(attachment).getByRole('textbox', {
    name: 'Deadline name',
  })
  await waitFor(() => expect(document.activeElement === title).toBe(true))
  expect(
    within(attachment).queryByRole('button', { name: 'Close day agenda' }),
  ).toBeNull()
  await user.type(title, 'Keep this deadline draft')
  await user.keyboard('{Escape}')
  expect(
    (screen.getByRole('textbox', { name: 'Deadline name' }) as HTMLInputElement)
      .value,
  ).toBe('Keep this deadline draft')
  expect(
    screen.getByText('Save or cancel your draft before closing.'),
  ).toBeTruthy()
  await user.click(within(attachment).getByRole('button', { name: 'Cancel' }))
  const add = within(attachment).getByRole('button', { name: 'Add deadline' })
  await waitFor(() => expect(document.activeElement === add).toBe(true))
  expect(
    within(attachment).queryByRole('textbox', { name: 'Deadline name' }),
  ).toBeNull()
  await user.keyboard('{Escape}')
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  await waitFor(() => expect(document.activeElement === day).toBe(true))
  await user.click(day)
  attachment = screen.getByRole('dialog', { name: /^Agenda for/ })
  await user.click(
    within(attachment).getByRole('button', { name: 'Add deadline' }),
  )
  expect(
    (
      within(attachment).getByRole('textbox', {
        name: 'Deadline name',
      }) as HTMLInputElement
    ).value,
  ).toBe('')
})

test('adding a deadline on Overview does not reopen its form after navigating back', async () => {
  render(<App />)
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Add deadline' }))
  const attachment = screen.getByRole('dialog', { name: /^Agenda for/ })
  await user.type(
    within(attachment).getByRole('textbox', { name: 'Deadline name' }),
    'A deadline from Overview',
  )
  await user.click(
    within(attachment).getByRole('button', { name: 'Add deadline' }),
  )
  await user.keyboard('{Escape}')
  await user.click(screen.getByRole('button', { name: 'GitHub Trending' }))
  await user.click(screen.getByRole('button', { name: 'Overview' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.getByRole('gridcell', { name: /1 deadline/ })).toBeTruthy()
})

test('a deadline moved to another month stays on the chosen local date', async () => {
  render(<App />)
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Add deadline' }))
  const attachment = screen.getByRole('dialog', { name: /^Agenda for/ })
  await user.type(
    within(attachment).getByRole('textbox', { name: 'Deadline name' }),
    'A January commitment',
  )
  await user.clear(within(attachment).getByLabelText('Deadline date'))
  await user.type(
    within(attachment).getByLabelText('Deadline date'),
    '2027-01-02',
  )
  await user.click(
    within(attachment).getByRole('button', { name: 'Add deadline' }),
  )
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(screen.getByRole('heading', { name: 'January 2027' })).toBeTruthy()
  expect(
    screen.getByRole('gridcell', { selected: true }).getAttribute('data-value'),
  ).toBe('2027-01-02')
  expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).items[0]).toMatchObject(
    { date: '2027-01-02', title: 'A January commitment' },
  )
})

test('an agent can discover the attached agenda and the deadline form controls', async () => {
  render(<App />)
  await screen.findByRole('button', { name: 'Save acme/atlas' })
  await act(async () => {
    expect(
      (
        await agent.act({
          steps: [
            {
              ref: 'Deadline calendar',
              action: 'setValue',
              args: ['2026-11-24'],
            },
          ],
        })
      ).ok,
    ).toBe(true)
  })
  const agenda = agent
    .snapshot()
    .find(
      (entry) =>
        !entry.offPage &&
        entry.component === 'popover' &&
        entry.label === 'Agenda for Tuesday, November 24',
    )
  expect(agenda).toBeTruthy()
  const actions = await agent.query({
    text: 'Add deadline',
    within: agenda!.ref,
  })
  if (!Array.isArray(actions)) throw new Error(actions.error)
  expect(actions).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        ref: agenda!.ref,
        buttons: expect.arrayContaining(['Add deadline']),
      }),
    ]),
  )
  await act(async () => {
    expect(
      (
        await agent.act({
          steps: [
            { ref: agenda!.ref, action: 'press', args: ['Add deadline'] },
          ],
        })
      ).ok,
    ).toBe(true)
  })
  const controls = agent
    .snapshot()
    .filter((entry) => !entry.offPage && entry.component !== 'more')
  for (const entry of controls)
    expect(
      entry.label,
      `${entry.component} has no accessible name`,
    ).toBeTruthy()
  for (const label of [
    'Deadline name',
    'Deadline date',
    'Notes (optional)',
    'Back to day agenda',
  ])
    expect(controls.map((entry) => entry.label)).toContain(label)
  await act(async () => {
    const result = await agent.act({
      steps: [
        {
          ref: 'Deadline name',
          action: 'setValue',
          args: ['An agent-created deadline'],
        },
      ],
    })
    expect(result.ok, result.error?.message).toBe(true)
  })
  const submitters = await agent.query({
    text: 'Add deadline',
    within: agenda!.ref,
  })
  if (!Array.isArray(submitters)) throw new Error(submitters.error)
  expect(submitters).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        ref: agenda!.ref,
        buttons: expect.arrayContaining(['Add deadline']),
      }),
    ]),
  )
  await act(async () => {
    expect(
      (
        await agent.act({
          steps: [
            { ref: agenda!.ref, action: 'press', args: ['Add deadline'] },
          ],
        })
      ).ok,
    ).toBe(true)
  })
  expect(
    screen.getByRole('checkbox', {
      name: 'Complete deadline An agent-created deadline',
    }),
  ).toBeTruthy()
})

test('a dated task opens its existing editor after the day attachment closes', async () => {
  const date = localDate()
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...emptyWorkspace,
      items: [
        {
          id: 'dated-task',
          kind: 'task',
          title: 'Prepare for the review',
          date,
          done: false,
          notes: '',
        },
      ],
    }),
  )
  render(<App />)
  const user = userEvent.setup()
  const day = screen.getByRole('gridcell', { selected: true })
  await user.click(day)
  await user.click(
    screen.getByRole('button', { name: 'Edit task Prepare for the review' }),
  )
  const dialog = await screen.findByRole('dialog', { name: 'Edit task' })
  expect(
    (
      within(dialog).getByRole('textbox', {
        name: 'Task name',
      }) as HTMLInputElement
    ).value,
  ).toBe('Prepare for the review')
  await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
  await waitFor(() => expect(document.activeElement === day).toBe(true))
})
