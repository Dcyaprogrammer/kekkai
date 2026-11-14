import { useRef, useState } from 'react'
import {
  emptyWorkspace,
  parseWorkspace,
  STORAGE_KEY,
  type Workspace,
} from './workspace'

function loadWorkspace() {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
    return {
      data: raw ? parseWorkspace(raw) : emptyWorkspace,
      error: '',
      damaged: null as string | null,
    }
  } catch {
    return {
      data: emptyWorkspace,
      error:
        'Your saved workspace could not be read. Export a recovery copy from Backups before continuing.',
      damaged: raw,
    }
  }
}

export function useWorkspace() {
  const [initial] = useState(loadWorkspace)
  const [data, setData] = useState(initial.data)
  const [error, setError] = useState(initial.error)
  const current = useRef(data)
  const damaged = useRef(initial.damaged)

  function update(transform: (workspace: Workspace) => Workspace) {
    let next: Workspace
    try {
      next = parseWorkspace(JSON.stringify(transform(current.current)))
    } catch (error) {
      setError(
        `Change was not saved: ${error instanceof Error ? error.message : 'Invalid workspace data.'}`,
      )
      return false
    }
    try {
      if (damaged.current) {
        localStorage.setItem(`${STORAGE_KEY}.recovery`, damaged.current)
        damaged.current = null
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      setError('')
    } catch {
      setError(
        'Changes are only in memory. Browser storage is unavailable or full. Export a backup before closing this page.',
      )
    }
    current.current = next
    setData(next)
    return true
  }

  return { data, update, error, recovery: initial.damaged }
}
