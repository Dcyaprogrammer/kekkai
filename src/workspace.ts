export type PlanningItem = {
  id: string
  title: string
  kind: 'task' | 'deadline'
  date: string | null
  done: boolean
  notes: string
}

export type FeedEntry = {
  id: string
  source: string
  title: string
  url: string
  description: string
  language?: string | null
  stars?: number
  gained?: number
}

export type FeedResult = {
  source: string
  period: 'daily' | 'weekly'
  fetchedAt: string
  stale: boolean
  entries: FeedEntry[]
}

export type Workspace = {
  version: 1
  items: PlanningItem[]
  saved: FeedEntry[]
}
export const STORAGE_KEY = 'kekkai.workspace.v1'
export const emptyWorkspace: Workspace = { version: 1, items: [], saved: [] }

export function localDate(date = new Date()): string {
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false
  const date = new Date(`${value}T12:00:00`)
  return !Number.isNaN(date.getTime()) && localDate(date) === value
}

export function formatDate(
  value: string,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' },
) {
  return new Intl.DateTimeFormat('en', options).format(
    new Date(`${value}T12:00:00`),
  )
}

export function validFeedEntry(entry: unknown): entry is FeedEntry {
  if (!entry || typeof entry !== 'object') return false
  const value = entry as FeedEntry
  try {
    const url = new URL(value.url)
    if (url.protocol !== 'https:' || url.username || url.password) return false
  } catch {
    return false
  }
  return (
    typeof value.id === 'string' &&
    !!value.id &&
    value.id.length < 1000 &&
    typeof value.source === 'string' &&
    !!value.source &&
    value.source.length < 100 &&
    typeof value.title === 'string' &&
    !!value.title.trim() &&
    value.title.length <= 200 &&
    typeof value.description === 'string' &&
    value.description.length <= 5000 &&
    (value.language == null ||
      (typeof value.language === 'string' && value.language.length <= 100)) &&
    (value.stars === undefined ||
      (Number.isFinite(value.stars) && value.stars >= 0)) &&
    (value.gained === undefined ||
      (Number.isFinite(value.gained) && value.gained >= 0))
  )
}

export function parseFeed(
  value: unknown,
  source: string,
  period: FeedResult['period'],
): FeedResult {
  if (!value || typeof value !== 'object')
    throw new Error('The feed returned an unreadable response.')
  const result = value as FeedResult
  if (
    result.source !== source ||
    result.period !== period ||
    typeof result.stale !== 'boolean' ||
    typeof result.fetchedAt !== 'string' ||
    !Number.isFinite(Date.parse(result.fetchedAt)) ||
    !Array.isArray(result.entries) ||
    result.entries.length > 1000 ||
    !result.entries.every(validFeedEntry) ||
    result.entries.some((entry) => entry.source !== source) ||
    new Set(result.entries.map((entry) => entry.id)).size !==
      result.entries.length
  )
    throw new Error('The feed returned an unreadable response.')
  return result
}

export function parseWorkspace(text: string): Workspace {
  const value = JSON.parse(text)
  if (
    !value ||
    value.version !== 1 ||
    !Array.isArray(value.items) ||
    !Array.isArray(value.saved)
  )
    throw new Error('This is not a Kekkai backup.')
  if (value.items.length > 10000 || value.saved.length > 10000)
    throw new Error('This backup is too large.')
  const ids = new Set<string>()
  for (const item of value.items) {
    if (
      !item ||
      typeof item.id !== 'string' ||
      !item.id ||
      ids.has(item.id) ||
      typeof item.title !== 'string' ||
      !item.title.trim() ||
      item.title.length > 200 ||
      !['task', 'deadline'].includes(item.kind) ||
      typeof item.done !== 'boolean' ||
      typeof item.notes !== 'string' ||
      item.notes.length > 2000 ||
      (item.date !== null && !validDate(item.date)) ||
      (item.kind === 'deadline' && !validDate(item.date))
    ) {
      throw new Error('The backup contains an invalid task or deadline.')
    }
    ids.add(item.id)
  }
  const savedIds = new Set<string>()
  for (const entry of value.saved) {
    if (!validFeedEntry(entry) || savedIds.has(entry.id)) {
      throw new Error('The backup contains an invalid saved repository.')
    }
    savedIds.add(entry.id)
  }
  return { version: 1, items: value.items, saved: value.saved }
}

export function mergeBackup(current: Workspace, backup: Workspace): Workspace {
  const items = new Map(backup.items.map((item) => [item.id, item]))
  const saved = new Map(backup.saved.map((entry) => [entry.id, entry]))
  for (const item of current.items) items.set(item.id, item)
  for (const entry of current.saved) saved.set(entry.id, entry)
  return { version: 1, items: [...items.values()], saved: [...saved.values()] }
}
