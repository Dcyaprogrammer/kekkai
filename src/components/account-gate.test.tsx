import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createAgent, registerTools } from '@ui-sdk/react/agent'
import type { Session } from '@supabase/supabase-js'
import { beforeEach, expect, test, vi } from 'vitest'
import { AccountGate } from './account-gate'

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithOAuth: vi.fn(),
  signOut: vi.fn(),
}))
vi.mock('../cloud', () => ({ supabase: { auth } }))
let emit: (event: string, session: Session | null) => void
const alice = { user: { id: 'alice' } } as Session
const bob = { user: { id: 'bob' } } as Session
const agent = createAgent()

beforeEach(() => {
  auth.getSession
    .mockReset()
    .mockResolvedValue({ data: { session: null }, error: null })
  auth.onAuthStateChange.mockReset().mockImplementation((callback) => {
    emit = callback
    return { data: { subscription: { unsubscribe: vi.fn() } } }
  })
  auth.signInWithOAuth.mockReset().mockResolvedValue({ error: null })
  auth.signOut.mockReset().mockImplementation(async () => {
    emit('SIGNED_OUT', null)
    return { error: null }
  })
})

function TestAccount() {
  return (
    <AccountGate>
      {(user, signOut) => (
        <div key={user?.id}>
          <span>{user?.id}</span>
          <button onClick={signOut}>Sign out</button>
        </div>
      )}
    </AccountGate>
  )
}

test('sign-in is keyboard and agent reachable and requests GitHub with the current origin', async () => {
  const unregister = registerTools(agent, { allow: (step) => !step.confirm })
  try {
    render(<TestAccount />)
    const button = await screen.findByRole('button', {
      name: 'Continue with GitHub',
    })
    expect(
      agent
        .snapshot()
        .some(
          (entry) => !entry.offPage && entry.label === 'Continue with GitHub',
        ),
    ).toBe(true)
    button.focus()
    await userEvent.setup().keyboard('{Enter}')
    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'github',
      options: { redirectTo: `${window.location.origin}/` },
    })
    expect(button.hasAttribute('disabled')).toBe(true)
  } finally {
    unregister()
  }
})

test('failed login can be retried without losing the sign-in control', async () => {
  auth.signInWithOAuth.mockResolvedValueOnce({
    error: new Error('Unavailable'),
  })
  render(<TestAccount />)
  const user = userEvent.setup()
  await user.click(
    await screen.findByRole('button', { name: 'Continue with GitHub' }),
  )
  expect((await screen.findByRole('alert')).textContent).toContain(
    'Please try again',
  )
  await act(async () => {
    const result = await agent.act({
      steps: [{ ref: 'Continue with GitHub', action: 'press' }],
    })
    expect(result.ok, result.error?.message).toBe(true)
  })
  expect(auth.signInWithOAuth).toHaveBeenCalledTimes(2)
})

test('session changes replace the account workspace and signing out returns to login', async () => {
  auth.getSession.mockResolvedValue({ data: { session: alice }, error: null })
  render(<TestAccount />)
  await screen.findByText('alice')
  act(() => emit('SIGNED_IN', bob))
  expect(screen.queryByText('alice')).toBeNull()
  expect(screen.getByText('bob')).toBeTruthy()
  await userEvent
    .setup()
    .click(screen.getByRole('button', { name: 'Sign out' }))
  await screen.findByRole('button', { name: 'Continue with GitHub' })
  expect(screen.queryByText('bob')).toBeNull()
  expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
})

test('an older getSession response cannot overwrite a newer auth event', async () => {
  let resolve!: (value: unknown) => void
  auth.getSession.mockReturnValue(
    new Promise((done) => {
      resolve = done
    }),
  )
  render(<TestAccount />)
  act(() => emit('SIGNED_IN', bob))
  await act(async () => resolve({ data: { session: alice }, error: null }))
  expect(screen.getByText('bob')).toBeTruthy()
  expect(screen.queryByText('alice')).toBeNull()
})

test('sign-out errors keep the account visible and explain how to retry', async () => {
  auth.getSession.mockResolvedValue({ data: { session: alice }, error: null })
  auth.signOut.mockResolvedValueOnce({ error: new Error('Offline') })
  render(<TestAccount />)
  await screen.findByText('alice')
  await userEvent
    .setup()
    .click(screen.getByRole('button', { name: 'Sign out' }))
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain(
      'Could not sign out',
    ),
  )
  expect(screen.getByText('alice')).toBeTruthy()
})
