import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import {
  loadCloudWorkspace,
  saveCloudWorkspace,
  WorkspaceConflict,
} from './cloud'
import { useCloudWorkspace } from './use-cloud-workspace'
import { emptyWorkspace, STORAGE_KEY, type Workspace } from './workspace'

vi.mock('./cloud', async (original) => {
  const module = await original<typeof import('./cloud')>()
  return { ...module, loadCloudWorkspace: vi.fn(), saveCloudWorkspace: vi.fn() }
})

const load = vi.mocked(loadCloudWorkspace)
const save = vi.mocked(saveCloudWorkspace)
const cacheKey = `${STORAGE_KEY}:alice`
const task = {
  id: 'task',
  kind: 'task' as const,
  title: 'Ship it',
  date: null,
  done: false,
  notes: '',
}
const edited = { ...emptyWorkspace, items: [task] }
const other = {
  ...emptyWorkspace,
  items: [{ ...task, id: 'other', title: 'From another device' }],
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

beforeEach(() => {
  localStorage.clear()
  load.mockReset().mockResolvedValue({ data: emptyWorkspace, revision: 0 })
  save
    .mockReset()
    .mockImplementation(async (_id, _data, revision) => revision + 1)
})

test('blocks editing until loaded and keeps accounts and guest data separate', async () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(edited))
  localStorage.setItem(
    `${STORAGE_KEY}:bob`,
    JSON.stringify({ data: other, revision: 1, pending: true }),
  )
  const online = deferred<{ data: Workspace; revision: number }>()
  load.mockReturnValue(online.promise)
  const { result } = renderHook(() => useCloudWorkspace('alice'))
  expect(result.current.data).toEqual(emptyWorkspace)
  act(() => {
    expect(result.current.update(() => edited)).toBe(false)
  })
  expect(save).not.toHaveBeenCalled()
  await act(async () => online.resolve({ data: emptyWorkspace, revision: 0 }))
  act(() => {
    expect(result.current.update(() => edited)).toBe(true)
  })
  await waitFor(() => expect(result.current.status).toBe('saved'))
  expect(save).toHaveBeenCalledWith('alice', edited, 0)
  expect(JSON.parse(localStorage.getItem(cacheKey)!)).toEqual({
    data: edited,
    revision: 1,
    pending: false,
  })
  expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify(edited))
  expect(load).toHaveBeenCalledWith('alice')
})

test('serializes rapid edits using the latest revision without losing intermediate input', async () => {
  const first = deferred<number>()
  save.mockReturnValueOnce(first.promise)
  const { result } = renderHook(() => useCloudWorkspace('alice'))
  await waitFor(() => expect(result.current.status).toBe('saved'))
  act(() => {
    result.current.update(() => edited)
  })
  act(() => {
    result.current.update((data) => ({
      ...data,
      items: [{ ...data.items[0], done: true }],
    }))
  })
  expect(save).toHaveBeenCalledTimes(1)
  expect(result.current.data.items[0].done).toBe(true)
  await act(async () => first.resolve(1))
  await waitFor(() => expect(result.current.status).toBe('saved'))
  expect(save).toHaveBeenLastCalledWith('alice', result.current.data, 1)
  expect(JSON.parse(localStorage.getItem(cacheKey)!).revision).toBe(2)
})

test('keeps pending edits across a failed save and reload, then retries them', async () => {
  save.mockRejectedValueOnce(new Error('Offline'))
  const first = renderHook(() => useCloudWorkspace('alice'))
  await waitFor(() => expect(first.result.current.status).toBe('saved'))
  act(() => {
    first.result.current.update(() => edited)
  })
  await waitFor(() => expect(first.result.current.status).toBe('error'))
  expect(JSON.parse(localStorage.getItem(cacheKey)!).pending).toBe(true)
  first.unmount()
  const next = renderHook(() => useCloudWorkspace('alice'))
  await waitFor(() => expect(next.result.current.status).toBe('saved'))
  expect(next.result.current.data).toEqual(edited)
  expect(save).toHaveBeenLastCalledWith('alice', edited, 0)
})

test('conflicts never overwrite another device; loading online archives local edits', async () => {
  save.mockRejectedValueOnce(new WorkspaceConflict())
  const { result } = renderHook(() => useCloudWorkspace('alice'))
  await waitFor(() => expect(result.current.status).toBe('saved'))
  act(() => {
    result.current.update(() => edited)
  })
  await waitFor(() => expect(result.current.status).toBe('conflict'))
  act(() => {
    expect(result.current.update(() => other)).toBe(false)
  })
  expect(result.current.data).toEqual(edited)
  load.mockResolvedValue({ data: other, revision: 2 })
  await act(async () => {
    await result.current.loadOnline()
  })
  expect(result.current.status).toBe('saved')
  expect(result.current.data).toEqual(other)
  expect(JSON.parse(localStorage.getItem(`${cacheKey}.recovery`)!)).toEqual(
    edited,
  )
  expect(result.current.recovery).toBe(JSON.stringify(edited))
  expect(save).toHaveBeenCalledTimes(1)
})

test('detects a conflicting pending cache on reload instead of uploading it', async () => {
  localStorage.setItem(
    cacheKey,
    JSON.stringify({ data: edited, revision: 1, pending: true }),
  )
  load.mockResolvedValue({ data: other, revision: 2 })
  const { result } = renderHook(() => useCloudWorkspace('alice'))
  await waitFor(() => expect(result.current.status).toBe('conflict'))
  expect(result.current.data).toEqual(edited)
  expect(save).not.toHaveBeenCalled()
})

test('acknowledges a save whose network response was lost', async () => {
  localStorage.setItem(
    cacheKey,
    JSON.stringify({ data: edited, revision: 1, pending: true }),
  )
  load.mockResolvedValue({ data: edited, revision: 2 })
  const { result } = renderHook(() => useCloudWorkspace('alice'))
  await waitFor(() => expect(result.current.status).toBe('saved'))
  expect(save).not.toHaveBeenCalled()
  expect(JSON.parse(localStorage.getItem(cacheKey)!).pending).toBe(false)
})

test('preserves corrupt cache as a recovery copy before replacing it', async () => {
  localStorage.setItem(cacheKey, 'unreadable cache')
  const { result } = renderHook(() => useCloudWorkspace('alice'))
  await waitFor(() => expect(result.current.status).toBe('saved'))
  expect(localStorage.getItem(`${cacheKey}.recovery`)).toBe('unreadable cache')
  expect(result.current.recovery).toBe('unreadable cache')
})

test('loading errors keep a cached workspace exportable and allow retry', async () => {
  localStorage.setItem(
    cacheKey,
    JSON.stringify({ data: edited, revision: 1, pending: false }),
  )
  load.mockRejectedValueOnce(new Error('Offline'))
  const { result } = renderHook(() => useCloudWorkspace('alice'))
  await waitFor(() => expect(result.current.status).toBe('error'))
  expect(result.current.data).toEqual(edited)
  act(() => {
    expect(result.current.update(() => other)).toBe(false)
  })
  load.mockResolvedValue({ data: other, revision: 2 })
  await act(async () => {
    await result.current.retry()
  })
  expect(result.current.data).toEqual(other)
})

test('recovery storage failure never discards pending edits when loading online', async () => {
  localStorage.setItem(
    cacheKey,
    JSON.stringify({ data: edited, revision: 1, pending: true }),
  )
  load.mockResolvedValue({ data: other, revision: 2 })
  const { result } = renderHook(() => useCloudWorkspace('alice'))
  await waitFor(() => expect(result.current.status).toBe('conflict'))
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('Full')
  })
  await act(async () => {
    await result.current.loadOnline()
  })
  expect(result.current.status).toBe('error')
  expect(result.current.data).toEqual(edited)
  expect(JSON.parse(localStorage.getItem(cacheKey)!).data).toEqual(edited)
})

test('browser storage failure still allows a confirmed cloud save', async () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('Full')
  })
  const { result } = renderHook(() => useCloudWorkspace('alice'))
  await waitFor(() => expect(result.current.status).toBe('saved'))
  act(() => {
    expect(result.current.update(() => edited)).toBe(true)
  })
  await waitFor(() => expect(save).toHaveBeenCalledWith('alice', edited, 0))
  await waitFor(() => expect(result.current.status).toBe('saved'))
  expect(result.current.error).toBe('')
})

test('unmount stops a queued follow-up save from an old account', async () => {
  const first = deferred<number>()
  save.mockReturnValueOnce(first.promise)
  const { result, unmount } = renderHook(() => useCloudWorkspace('alice'))
  await waitFor(() => expect(result.current.status).toBe('saved'))
  act(() => {
    result.current.update(() => edited)
  })
  act(() => {
    result.current.update(() => other)
  })
  unmount()
  await act(async () => first.resolve(1))
  expect(save).toHaveBeenCalledTimes(1)
})
