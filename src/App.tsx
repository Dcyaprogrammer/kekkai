import { useEffect, useRef, useState } from 'react'
import { Button } from '@ui-sdk/react/button'
import { Github } from './components/github-icon'
import { createAgent, registerTools } from '@ui-sdk/react/agent'
import {
  ArrowUpRight,
  Bookmark,
  CalendarDays,
  CircleAlert,
  HardDrive,
  LayoutGrid,
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
import {
  formatDate,
  localDate,
  mergeBackup,
  type FeedEntry,
  type PlanningItem,
} from './workspace'
import './App.css'

type View = 'overview' | 'feeds' | 'saved'
const viewNames: Record<View, string> = {
  overview: 'Overview',
  feeds: 'GitHub Trending',
  saved: 'Saved',
}
const agent = createAgent()

export default function App() {
  const { data, update, error, recovery } = useWorkspace()
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
  const [deleted, setDeleted] = useState<PlanningItem | null>(null)
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

  useEffect(() => registerTools(agent, { allow: (step) => !step.confirm }), [])
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
    if (accepted)
      setNotice(`${item.kind === 'deadline' ? 'Deadline' : 'Task'} saved`)
    return accepted
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
    update((workspace) => ({
      ...workspace,
      items: workspace.items.filter((existing) => existing.id !== item.id),
    }))
    setDeleted(item)
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
    />
  )

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to workspace
      </a>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M6 5v14M18 5l-9 7 9 7M6 12h3"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
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
          <Button
            className={`nav-button${view === 'saved' ? ' active' : ''}`}
            aria-current={view === 'saved' ? 'page' : undefined}
            onClick={() => setView('saved')}
          >
            <Bookmark size={17} />
            <span>Saved</span>
            {data.saved.length > 0 && (
              <span className="nav-count">{data.saved.length}</span>
            )}
          </Button>
        </nav>
        <div className="sidebar-bottom">
          <Button className="nav-button backup-nav" onClick={openBackup}>
            <HardDrive size={16} />
            <span>Backups & storage</span>
            <ArrowUpRight size={14} />
          </Button>
          <div className="local-status">
            <span className={`status-dot${error ? ' status-error' : ''}`} />
            {error ? 'Storage needs attention' : 'Saved on this device'}
          </div>
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
              </div>
              <div
                className="heading-actions"
                data-planning={planning ? '' : undefined}
              >
                {planning && (
                  <>
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
                  </>
                )}
                <Button
                  className="icon-button header-backup"
                  aria-label="Open workspace backups"
                  title="Backups & storage"
                  onClick={openBackup}
                >
                  <HardDrive size={18} />
                </Button>
              </div>
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
          {view === 'saved' && (
            <FeedPanel savedOnly saved={data.saved} onSave={saveEntry} />
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
          onClose={closeBackup}
          onRestore={(backup) =>
            update((workspace) => mergeBackup(workspace, backup))
          }
        />
      )}
      {deleted && (
        <div className="undo-toast" role="status">
          <span>“{deleted.title}” deleted</span>
          <Button
            className="button ghost small"
            onClick={() => {
              const item = deleted
              update((workspace) => ({
                ...workspace,
                items: workspace.items.some(
                  (existing) => existing.id === item.id,
                )
                  ? workspace.items
                  : [...workspace.items, item],
              }))
              setDeleted(null)
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
