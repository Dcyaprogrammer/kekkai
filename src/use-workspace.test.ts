import { act, renderHook } from '@testing-library/react'
import { beforeEach, expect, test } from 'vitest'
import { useWorkspace } from './use-workspace'
import {
  emptyWorkspace,
  mergeBackup,
  parseWorkspace,
  STORAGE_KEY,
  type PlanningItem,
} from './workspace'

beforeEach(() => localStorage.clear())

test('rejects invalid writes while leaving the existing persisted workspace readable', () => {
  const item: PlanningItem = {
    id: 'good',
    kind: 'task',
    title: 'Keep this task',
    date: null,
    done: false,
    notes: '',
  }
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...emptyWorkspace, items: [item] }),
  )
  const { result } = renderHook(useWorkspace)
  act(() => {
    expect(
      result.current.update((workspace) => ({
        ...workspace,
        items: [
          ...workspace.items,
          { ...item, id: 'bad', title: 'x'.repeat(201) },
        ],
      })),
    ).toBe(false)
  })
  expect(result.current.data.items).toEqual([item])
  expect(parseWorkspace(localStorage.getItem(STORAGE_KEY)!).items).toEqual([
    item,
  ])
})

test('rejects an oversized merge without changing current data or its backup', () => {
  const items: PlanningItem[] = Array.from({ length: 6000 }, (_, index) => ({
    id: `local-${index}`,
    kind: 'task',
    title: `Task ${index}`,
    date: null,
    done: false,
    notes: '',
  }))
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...emptyWorkspace, items }),
  )
  const before = localStorage.getItem(STORAGE_KEY)
  const backup = {
    ...emptyWorkspace,
    items: items.map((item) => ({ ...item, id: `backup-${item.id}` })),
  }
  const { result } = renderHook(useWorkspace)
  act(() => {
    expect(
      result.current.update((workspace) => mergeBackup(workspace, backup)),
    ).toBe(false)
  })
  expect(result.current.data.items).toHaveLength(6000)
  expect(localStorage.getItem(STORAGE_KEY)).toBe(before)
  expect(result.current.error).toContain('too large')
})
