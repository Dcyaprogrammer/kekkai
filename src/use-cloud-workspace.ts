import { useEffect, useEffectEvent, useRef, useState } from 'react'
import {
  loadCloudWorkspace,
  saveCloudWorkspace,
  WorkspaceConflict,
} from './cloud'
import {
  emptyWorkspace,
  parseWorkspace,
  STORAGE_KEY,
  type Workspace,
} from './workspace'

type Cache = { data: Workspace; revision: number; pending: boolean }
type Status = 'loading' | 'saving' | 'saved' | 'error' | 'conflict'

function readCache(raw: string | null): Cache {
  if (!raw) return { data: emptyWorkspace, revision: 0, pending: false }
  const value = JSON.parse(raw)
  if (
    !Number.isInteger(value.revision) ||
    value.revision < 0 ||
    typeof value.pending !== 'boolean'
  )
    throw new Error('Unreadable workspace cache')
  return { ...value, data: parseWorkspace(JSON.stringify(value.data)) }
}

export function useCloudWorkspace(userId: string) {
  const storageKey = `${STORAGE_KEY}:${userId}`
  const [initial] = useState(() => {
    let raw: string | null = null
    try {
      raw = localStorage.getItem(storageKey)
      return { ...readCache(raw), damaged: null as string | null }
    } catch {
      return { data: emptyWorkspace, revision: 0, pending: false, damaged: raw }
    }
  })
  const [data, setData] = useState(initial.data)
  const [error, setError] = useState('')
  const [recovery, setRecovery] = useState<string | null>(initial.damaged)
  const damaged = useRef(initial.damaged)
  const [status, setStatus] = useState<Status>('loading')
  const state = useRef({
    ...initial,
    loaded: false,
    writing: false,
    blocked: false,
    epoch: 0,
  })

  function persist() {
    const { data, revision, pending } = state.current
    try {
      if (damaged.current) {
        localStorage.setItem(`${storageKey}.recovery`, damaged.current)
        damaged.current = null
      }
      localStorage.setItem(
        storageKey,
        JSON.stringify({ data, revision, pending }),
      )
      return true
    } catch {
      setError(
        'Browser storage is unavailable. Keep this page open until the online save succeeds, or export a backup.',
      )
      return false
    }
  }

  async function flush() {
    const current = state.current
    if (
      !current.loaded ||
      current.writing ||
      current.blocked ||
      !current.pending
    )
      return
    current.writing = true
    const epoch = current.epoch
    setStatus('saving')
    setError('')
    try {
      while (current.pending) {
        const snapshot = current.data
        const revision = await saveCloudWorkspace(
          userId,
          snapshot,
          current.revision,
        )
        if (epoch !== current.epoch) return
        current.revision = revision
        current.pending = current.data !== snapshot
        persist()
      }
      setStatus('saved')
      setError('')
    } catch (cause) {
      if (epoch !== current.epoch) return
      current.blocked = cause instanceof WorkspaceConflict
      setStatus(current.blocked ? 'conflict' : 'error')
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not save online. Export a backup before closing this page.',
      )
    } finally {
      if (epoch === current.epoch) current.writing = false
    }
  }

  async function load(discardPending = false) {
    const current = state.current
    const epoch = ++current.epoch
    current.loaded = false
    current.writing = false
    setStatus('loading')
    setError('')
    try {
      if (discardPending && current.pending) {
        const backup = JSON.stringify(current.data)
        localStorage.setItem(`${storageKey}.recovery`, backup)
        setRecovery(backup)
      }
      const online = await loadCloudWorkspace(userId)
      if (epoch !== current.epoch) return
      if (
        !discardPending &&
        current.pending &&
        online.revision !== current.revision &&
        JSON.stringify(online.data) !== JSON.stringify(current.data)
      ) {
        current.loaded = true
        current.blocked = true
        setStatus('conflict')
        setError(new WorkspaceConflict().message)
        return
      }
      const keepPending =
        !discardPending &&
        current.pending &&
        online.revision === current.revision
      current.data = keepPending ? current.data : online.data
      current.revision = online.revision
      current.pending = keepPending
      current.loaded = true
      current.blocked = false
      setData(current.data)
      persist()
      if (current.pending) void flush()
      else setStatus('saved')
    } catch {
      if (epoch !== current.epoch) return
      setStatus('error')
      setError(
        'Could not load your online workspace. Your local copy is kept. Retry, or export a backup before closing this page.',
      )
    }
  }

  const initialize = useEffectEvent(() => {
    void load()
  })
  useEffect(() => {
    const current = state.current
    // oxlint-disable-next-line react/set-state-in-effect -- Initial loading shares the explicit connection retry path.
    initialize()
    return () => {
      current.epoch++
    }
  }, [userId])

  function update(transform: (workspace: Workspace) => Workspace) {
    const current = state.current
    if (!current.loaded || current.blocked) {
      setError(
        current.blocked
          ? new WorkspaceConflict().message
          : 'Wait for your online workspace to load, or retry the connection.',
      )
      return false
    }
    try {
      current.data = parseWorkspace(JSON.stringify(transform(current.data)))
    } catch (cause) {
      setError(
        `Change was not saved: ${cause instanceof Error ? cause.message : 'Invalid workspace data.'}`,
      )
      return false
    }
    current.pending = true
    setData(current.data)
    persist()
    void flush()
    return true
  }

  return {
    data,
    update,
    error,
    recovery,
    status,
    storageKey,
    retry: () =>
      state.current.loaded && !state.current.blocked ? flush() : load(),
    loadOnline: () => load(true),
  }
}
