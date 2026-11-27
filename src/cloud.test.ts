import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { emptyWorkspace } from './workspace'

const client = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
}))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => client }))
afterEach(() => vi.unstubAllEnvs())

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test')
  client.from.mockReturnValue(client)
  client.select.mockReturnValue(client)
  client.eq.mockReturnValue(client)
  client.rpc.mockReset()
  client.maybeSingle.mockReset()
})

test('binds every save to the expected account as well as its revision', async () => {
  client.rpc.mockResolvedValue({ data: 4, error: null })
  const { saveCloudWorkspace } = await import('./cloud')
  expect(await saveCloudWorkspace('alice', emptyWorkspace, 3)).toBe(4)
  expect(client.rpc).toHaveBeenCalledWith('save_workspace', {
    p_user_id: 'alice',
    p_data: emptyWorkspace,
    p_revision: 3,
  })
})

test('distinguishes revision conflicts from connection failures and invalid acknowledgements', async () => {
  const { saveCloudWorkspace, WorkspaceConflict } = await import('./cloud')
  client.rpc.mockResolvedValueOnce({ data: null, error: { code: '40001' } })
  await expect(
    saveCloudWorkspace('alice', emptyWorkspace, 3),
  ).rejects.toBeInstanceOf(WorkspaceConflict)
  client.rpc.mockResolvedValueOnce({ data: null, error: { code: '42501' } })
  await expect(saveCloudWorkspace('alice', emptyWorkspace, 3)).rejects.toThrow(
    'Could not save online',
  )
  client.rpc.mockResolvedValueOnce({ data: 9, error: null })
  await expect(saveCloudWorkspace('alice', emptyWorkspace, 3)).rejects.toThrow(
    'Could not confirm',
  )
})

test('loads only the expected account and validates remote data before displaying it', async () => {
  const { loadCloudWorkspace } = await import('./cloud')
  client.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
  expect(await loadCloudWorkspace('alice')).toEqual({
    data: emptyWorkspace,
    revision: 0,
  })
  expect(client.eq).toHaveBeenCalledWith('user_id', 'alice')
  client.maybeSingle.mockResolvedValueOnce({
    data: { data: {}, revision: 1 },
    error: null,
  })
  await expect(loadCloudWorkspace('alice')).rejects.toThrow(
    'not a Kekkai backup',
  )
  client.maybeSingle.mockResolvedValueOnce({
    data: { data: emptyWorkspace, revision: 0 },
    error: null,
  })
  await expect(loadCloudWorkspace('alice')).rejects.toThrow('could not be read')
})
