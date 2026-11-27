import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Session } from '@supabase/supabase-js'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from './App'
import { emptyWorkspace, STORAGE_KEY } from './workspace'
import { WorkspaceConflict } from './cloud'
import { createAgent } from '@ui-sdk/react/agent'

const cloud = vi.hoisted(() => ({
  auth: {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    signInWithOAuth: vi.fn(),
    signOut: vi.fn(),
  },
  load: vi.fn(),
  save: vi.fn(),
}))
vi.mock('./cloud', async (original) => {
  const module = await original<typeof import('./cloud')>()
  return {
    ...module,
    supabase: { auth: cloud.auth },
    loadCloudWorkspace: cloud.load,
    saveCloudWorkspace: cloud.save,
  }
})

let emit: (event: string, session: Session | null) => void
const alice = { user: { id: 'alice' } } as Session
const bob = { user: { id: 'bob' } } as Session
const agent = createAgent()

beforeEach(() => {
  localStorage.clear()
  cloud.auth.getSession.mockResolvedValue({
    data: { session: alice },
    error: null,
  })
  cloud.auth.onAuthStateChange.mockImplementation((callback) => {
    emit = callback
    return { data: { subscription: { unsubscribe: vi.fn() } } }
  })
  cloud.auth.signOut.mockImplementation(async () => {
    emit('SIGNED_OUT', null)
    return { error: null }
  })
  cloud.load
    .mockReset()
    .mockResolvedValue({ data: emptyWorkspace, revision: 0 })
  cloud.save
    .mockReset()
    .mockImplementation(async (_id, _data, revision) => revision + 1)
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          source: 'github-trending',
          period: 'daily',
          fetchedAt: new Date().toISOString(),
          stale: false,
          entries: [],
        }),
      ),
    ),
  )
})
afterEach(() => vi.unstubAllGlobals())

test('signed-in tasks save online and account switches discard the old view and open dialogs', async () => {
  render(<App />)
  await screen.findByText('Saved online')
  const user = userEvent.setup()
  await user.type(
    screen.getByLabelText('Quick task title'),
    'Only Alice should see this{Enter}',
  )
  await waitFor(() =>
    expect(cloud.save).toHaveBeenCalledWith(
      'alice',
      expect.objectContaining({
        items: [
          expect.objectContaining({ title: 'Only Alice should see this' }),
        ],
      }),
      0,
    ),
  )
  await screen.findByText('Saved online')
  await user.click(
    screen.getByRole('button', { name: 'Open workspace backups' }),
  )
  expect(
    screen.getByText('Restores merge into your signed-in account.'),
  ).toBeTruthy()
  act(() => emit('SIGNED_IN', bob))
  await screen.findByText('Saved online')
  expect(screen.queryByText('Only Alice should see this')).toBeNull()
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(cloud.load).toHaveBeenLastCalledWith('bob')
  await act(async () => {
    const result = await agent.act({
      steps: [{ ref: 'Sign out', action: 'press' }],
    })
    expect(result.ok).toBe(false)
  })
  expect(screen.getByRole('heading', { name: 'Overview' })).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Sign out' }))
  await screen.findByRole('button', { name: 'Continue with GitHub' })
  expect(screen.queryByRole('heading', { name: 'Overview' })).toBeNull()
  expect(
    JSON.parse(localStorage.getItem(`${STORAGE_KEY}:alice`)!),
  ).toMatchObject({ pending: false, revision: 1 })
})

test('failed saves expose a working retry action alongside backups', async () => {
  cloud.save.mockRejectedValueOnce(
    new Error('Could not save online. Your edits are kept on this device.'),
  )
  render(<App />)
  await screen.findByText('Saved online')
  const user = userEvent.setup()
  await user.type(
    screen.getByLabelText('Quick task title'),
    'Keep my draft{Enter}',
  )
  await screen.findByRole('alert')
  await user.click(screen.getByRole('button', { name: /^Retry$/ }))
  await screen.findByText('Saved online')
  expect(screen.queryByRole('alert')).toBeNull()
  expect(screen.getByText('Keep my draft')).toBeTruthy()
  expect(cloud.save).toHaveBeenCalledTimes(2)
})

test('loading the online version after a conflict keeps an account-scoped recovery copy', async () => {
  cloud.save.mockRejectedValueOnce(new WorkspaceConflict())
  render(<App />)
  await screen.findByText('Saved online')
  const user = userEvent.setup()
  await user.type(
    screen.getByLabelText('Quick task title'),
    'Unsaved local task{Enter}',
  )
  await screen.findByRole('button', { name: 'Load online version' })
  await act(async () => {
    expect(
      (
        await agent.act({
          steps: [{ ref: 'Load online version', action: 'press' }],
        })
      ).ok,
    ).toBe(false)
  })
  cloud.load.mockResolvedValue({ data: emptyWorkspace, revision: 2 })
  await user.click(screen.getByRole('button', { name: 'Load online version' }))
  await screen.findByText('Saved online')
  expect(screen.queryByText('Unsaved local task')).toBeNull()
  expect(
    JSON.parse(localStorage.getItem(`${STORAGE_KEY}:alice.recovery`)!),
  ).toMatchObject({
    items: [expect.objectContaining({ title: 'Unsaved local task' })],
  })
})

test('old browser data is imported only by an explicit action and its original copy stays intact', async () => {
  const old = {
    ...emptyWorkspace,
    items: [
      {
        id: 'old',
        title: 'My old task',
        kind: 'task',
        date: null,
        done: false,
        notes: '',
      },
    ],
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(old))
  render(<App />)
  await screen.findByText('Saved online')
  expect(screen.queryByText('My old task')).toBeNull()
  const user = userEvent.setup()
  await user.click(
    screen.getByRole('button', { name: 'Open workspace backups' }),
  )
  await act(async () => {
    expect(
      (
        await agent.act({
          steps: [{ ref: 'Import browser data', action: 'press' }],
        })
      ).ok,
    ).toBe(false)
  })
  expect(cloud.save).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Import browser data' }))
  await waitFor(() => expect(cloud.save).toHaveBeenCalledWith('alice', old, 0))
  expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify(old))
})
