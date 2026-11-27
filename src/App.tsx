import { useEffect, useRef, useState } from 'react'
import { Button } from '@ui-sdk/react/button'
import { Toggle } from '@ui-sdk/react/toggle'
import { Github } from './components/github-icon'
import { createAgent, registerTools } from '@ui-sdk/react/agent'
import {
  ArrowUpRight,
  CalendarDays,
  CircleAlert,
  HardDrive,
  LayoutGrid,
  Moon,
  LogOut,
  Plus,
  RotateCcw,
  X,
} from 'lucide-react'
import { BackupDialog } from './components/backup-dialog'
import {
  CalendarPanel,
  type CalendarRequest,
} from './components/calendar-panel'
import { FeedPanel } from './components/feed-panel'
import { ItemDialog } from './components/item-dialog'
import { TasksPanel } from './components/tasks-panel'
import { useWorkspace } from './use-workspace'
import { useCloudWorkspace } from './use-cloud-workspace'
import { AccountGate } from './components/account-gate'
import {
  formatDate,
  localDate,
  mergeBackup,
  type FeedEntry,
  type PlanningItem,
} from './workspace'
import './App.css'

type View = 'overview' | 'feeds'
const viewNames: Record<View, string> = {
  overview: 'Overview',
  feeds: 'GitHub Trending',
}
const agent = createAgent()

export default function App() {
  useEffect(() => registerTools(agent, { allow: (step) => !step.confirm }), [])
  return (
    <AccountGate>
      {(user, signOut) =>
        user ? (
          <CloudApp key={user.id} userId={user.id} signOut={signOut} />
        ) : (
          <LocalApp />
        )
      }
    </AccountGate>
  )
}

function LocalApp() {
  return <WorkspaceApp workspace={useWorkspace()} />
}

function CloudApp({
  userId,
  signOut,
}: {
  userId: string
  signOut?: () => Promise<void>
}) {
  const workspace = useCloudWorkspace(userId)
  return (
    <WorkspaceApp workspace={workspace} cloud={workspace} signOut={signOut} />
  )
}

function WorkspaceApp({
  workspace,
  cloud,
  signOut,
}: {
  workspace: ReturnType<typeof useWorkspace>
  cloud?: ReturnType<typeof useCloudWorkspace>
  signOut?: () => Promise<void>
}) {
  const { data, update, error, recovery } = workspace
  const storageMessage = error
    ? 'Storage needs attention'
    : cloud
      ? {
          loading: 'Loading workspace…',
          saving: 'Saving online…',
          saved: 'Saved online',
          error: 'Save needs attention',
          conflict: 'Changed on another device',
        }[cloud.status]
      : 'Saved on this device'
  const [signingOut, setSigningOut] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('kekkai.theme')
      if (saved === 'light' || saved === 'dark') return saved
    } catch {}
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  })
  const [view, setView] = useState<View>('overview')
  const [selected, setSelected] = useState(localDate)
  const [month, setMonth] = useState(() => localDate().slice(0, 7))
  const [calendarRequest, setCalendarRequest] =
    useState<CalendarRequest | null>(null)
  const dialogTrigger = useRef<HTMLElement | null>(null)
  const [editor, setEditor] = useState<
    (Partial<PlanningItem> & { kind: PlanningItem['kind'] }) | null
  >(null)
  const [backupOpen, setBackupOpen] = useState(false)
  const [deleted, setDeleted] = useState<PlanningItem[] | null>(null)
  const [notice, setNotice] = useState('')
  const today = localDate()
  const planning = view === 'overview'
  const upcoming = data.items
    .filter(
      (item) => item.kind === 'deadline' && !item.done && item.date! >= today,
    )
    .sort((a, b) => a.date!.localeCompare(b.date!))
  const overdue = data.items.filter(
    (item) => item.date && item.date < today && !item.done,
  )

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#111315' : '#fafafa')
  }, [theme])
  useEffect(() => {
    if (!notice) return
    const timeout = setTimeout(() => setNotice(''), 3500)
    return () => clearTimeout(timeout)
  }, [notice])

  function saveItem(item: PlanningItem) {
    const accepted = update((workspace) => ({
      ...workspace,
      items: workspace.items.some((existing) => existing.id === item.id)
        ? workspace.items.map((existing) =>
            existing.id === item.id ? item : existing,
          )
        : [...workspace.items, item],
    }))
    if (accepted && !cloud)
      setNotice(`${item.kind === 'deadline' ? 'Deadline' : 'Task'} saved`)
    return accepted
  }
  function changeTheme(dark: boolean) {
    const next = dark ? 'dark' : 'light'
    setTheme(next)
    try {
      localStorage.setItem('kekkai.theme', next)
    } catch {}
  }
  function toggleItem(id: string, done: boolean) {
    update((workspace) => ({
      ...workspace,
      items: workspace.items.map((item) =>
        item.id === id ? { ...item, done } : item,
      ),
    }))
  }
  function deleteItem(item: PlanningItem) {
    const accepted = update((workspace) => ({
      ...workspace,
      items: workspace.items.filter((existing) => existing.id !== item.id),
    }))
    if (accepted) setDeleted([item])
  }
  function clearCompletedTasks() {
    const completed = data.items.filter(
      (item) => item.kind === 'task' && item.done,
    )
    if (!completed.length) return
    const accepted = update((workspace) => ({
      ...workspace,
      items: workspace.items.filter(
        (item) => item.kind !== 'task' || !item.done,
      ),
    }))
    if (accepted) setDeleted(completed)
  }
  function saveEntry(entry: FeedEntry) {
    const wasSaved = data.saved.some((existing) => existing.id === entry.id)
    const accepted = update((workspace) => ({
      ...workspace,
      saved: wasSaved
        ? workspace.saved.filter((existing) => existing.id !== entry.id)
        : [...workspace.saved, entry],
    }))
    if (accepted)
      setNotice(wasSaved ? 'Removed from saved discoveries' : 'Saved for later')
  }
  function openEditor(
    item: Partial<PlanningItem> & { kind: PlanningItem['kind'] },
  ) {
    dialogTrigger.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    setEditor(item)
  }
  function restoreDialogFocus() {
    const target = dialogTrigger.current
    requestAnimationFrame(() => {
      if (target?.isConnected) target.focus()
      else document.getElementById('main-content')?.focus()
    })
  }
  function closeEditor() {
    setEditor(null)
    restoreDialogFocus()
  }
  function openBackup() {
    dialogTrigger.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    setBackupOpen(true)
  }
  function closeBackup() {
    setBackupOpen(false)
    restoreDialogFocus()
  }
  function newDeadline(date: string) {
    selectDate(date)
    setCalendarRequest((previous) => ({ date, id: (previous?.id ?? 0) + 1 }))
  }
  function newTask() {
    openEditor({ kind: 'task' })
  }
  function selectDate(date: string) {
    setSelected(date)
    setMonth(date.slice(0, 7))
  }

  const calendar = (
    <CalendarPanel
      items={data.items}
      selected={selected}
      month={month}
      onMonthChange={setMonth}
      onSelect={selectDate}
      onSave={saveItem}
      onDelete={deleteItem}
      onEditTask={openEditor}
      request={calendarRequest}
      onRequestHandled={() => setCalendarRequest(null)}
      onToggle={toggleItem}
    />
  )
  const todo = (
    <TasksPanel
      items={data.items}
      onAdd={(title) =>
        saveItem({
          id: crypto.randomUUID(),
          title,
          kind: 'task',
          date: null,
          done: false,
          notes: '',
        })
      }
      onNew={newTask}
      onEdit={openEditor}
      onToggle={toggleItem}
      onClearCompleted={clearCompletedTasks}
    />
  )

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to workspace
      </a>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span>
            kekkai<span className="brand-period">.</span>
          </span>
        </div>
        <nav aria-label="Workspace navigation" className="workspace-nav">
          <p className="nav-label">Workspace</p>
          <Button
            className={`nav-button${view === 'overview' ? ' active' : ''}`}
            aria-current={view === 'overview' ? 'page' : undefined}
            onClick={() => setView('overview')}
          >
            <LayoutGrid size={17} />
            <span>Overview</span>
          </Button>
          <p className="nav-label discover-label">Discover</p>
          <Button
            className={`nav-button${view === 'feeds' ? ' active' : ''}`}
            aria-current={view === 'feeds' ? 'page' : undefined}
            onClick={() => setView('feeds')}
          >
            <Github size={17} />
            <span>GitHub Trending</span>
            <span className="nav-source-dot" />
          </Button>
        </nav>
        <div className="sidebar-bottom">
          <Button className="nav-button backup-nav" onClick={openBackup}>
            <HardDrive size={16} />
            <span>Backups & storage</span>
            <ArrowUpRight size={14} />
          </Button>
          {!cloud && (
            <div className="local-status">
              <span className={`status-dot${error ? ' status-error' : ''}`} />
              <span role="status">{storageMessage}</span>
            </div>
          )}
        </div>
      </aside>
      <div className="main-shell">
        <main id="main-content" tabIndex={-1}>
          <header className="workspace-header">
            <div className="page-heading">
              <div className="page-title">
                <h1>{viewNames[view]}</h1>
                <time dateTime={today}>
                  {formatDate(today, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </time>
                {cloud && (
                  <span className="cloud-status" role="status">
                    <span
                      className={`status-dot${error ? ' status-error' : ''}`}
                      aria-hidden="true"
                    />
                    {storageMessage}
                  </span>
                )}
              </div>
              <div className="header-tools">
                {signOut && (
                  <Button
                    className="icon-button"
                    data-agent-confirm="Signs out of this browser's account"
                    aria-label="Sign out"
                    title="Sign out"
                    disabled={signingOut}
                    onClick={async () => {
                      setSigningOut(true)
                      try {
                        await signOut()
                      } finally {
                        setSigningOut(false)
                      }
                    }}
                  >
                    <LogOut size={18} />
                  </Button>
                )}
                <Toggle
                  className="icon-button theme-toggle"
                  aria-label="Night mode"
                  title="Night mode"
                  pressed={theme === 'dark'}
                  onPressedChange={changeTheme}
                >
                  <Moon
                    size={18}
                    fill={theme === 'dark' ? 'currentColor' : 'none'}
                  />
                </Toggle>
                <Button
                  className="icon-button header-backup"
                  aria-label="Open workspace backups"
                  title="Backups & storage"
                  onClick={openBackup}
                >
                  <HardDrive size={18} />
                </Button>
              </div>
              {planning && (
                <div className="heading-actions" data-planning="">
                  <Button
                    className="button secondary"
                    onClick={() => newDeadline(selected)}
                  >
                    <CalendarDays size={15} />
                    Add deadline
                  </Button>
                  <Button className="button primary" onClick={newTask}>
                    <Plus size={16} />
                    New task
                  </Button>
                </div>
              )}
            </div>
            {planning && (upcoming.length > 0 || overdue.length > 0) && (
              <div className="day-summary">
                {upcoming.length > 0 && (
                  <span className="next-deadline">
                    Next deadline: {formatDate(upcoming[0].date!)} —{' '}
                    {upcoming[0].title}
                  </span>
                )}
                {overdue.length > 0 && (
                  <span className="overdue-summary">
                    {overdue.length} overdue
                  </span>
                )}
              </div>
            )}
          </header>
          {error && (
            <div className="storage-warning" role="alert">
              <CircleAlert size={17} />
              <span>{error}</span>
              {cloud && (
                <Button
                  className="button secondary small"
                  data-agent-confirm={
                    cloud.status === 'conflict'
                      ? 'Replaces local edits with the online version after saving a recovery copy'
                      : undefined
                  }
                  disabled={
                    cloud.status === 'loading' || cloud.status === 'saving'
                  }
                  onClick={() => {
                    void (cloud.status === 'conflict'
                      ? cloud.loadOnline()
                      : cloud.retry())
                  }}
                >
                  {cloud.status === 'conflict'
                    ? 'Load online version'
                    : 'Retry'}
                </Button>
              )}
              <Button className="button secondary small" onClick={openBackup}>
                Backups
              </Button>
            </div>
          )}
          {view === 'overview' && (
            <>
              <div className="planning-grid">
                {calendar}
                {todo}
              </div>
              <FeedPanel
                saved={data.saved}
                onSave={saveEntry}
                limit={6}
                onSeeAll={() => setView('feeds')}
              />
            </>
          )}
          {view === 'feeds' && (
            <FeedPanel saved={data.saved} onSave={saveEntry} />
          )}
        </main>
      </div>
      {editor && (
        <ItemDialog
          key={editor.id ?? `${editor.kind}:${editor.date ?? ''}`}
          item={editor}
          onClose={closeEditor}
          onSave={saveItem}
          onDelete={deleteItem}
        />
      )}
      {backupOpen && (
        <BackupDialog
          workspace={data}
          recovery={recovery}
          cloud={Boolean(cloud)}
          storageKey={cloud?.storageKey}
          onClose={closeBackup}
          onRestore={(backup) =>
            update((workspace) => mergeBackup(workspace, backup))
          }
        />
      )}
      {deleted && (
        <div className="undo-toast" role="status">
          <span>
            {deleted.length === 1
              ? `“${deleted[0].title}” deleted`
              : `${deleted.length} completed tasks cleared`}
          </span>
          <Button
            className="button ghost small"
            onClick={() => {
              const accepted = update((workspace) =>
                mergeBackup(workspace, {
                  version: 1,
                  items: deleted,
                  saved: [],
                }),
              )
              if (accepted) setDeleted(null)
            }}
          >
            <RotateCcw size={13} />
            Undo
          </Button>
          <Button
            className="icon-button"
            aria-label="Dismiss deletion notice"
            onClick={() => setDeleted(null)}
          >
            <X size={14} />
          </Button>
        </div>
      )}
      {notice && !deleted && (
        <div className="notice-toast" role="status">
          <CheckNotice />
          {notice}
        </div>
      )}
    </div>
  )
}

function CheckNotice() {
  return <span className="notice-check">✓</span>
}
