import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@ui-sdk/react/button'
import {
  Calendar,
  CalendarDay,
  CalendarGrid,
  CalendarHeading,
  CalendarNext,
  CalendarPrevious,
  CalendarWeekday,
  CalendarWeekdays,
  CalendarWeeks,
} from '@ui-sdk/react/calendar'
import { Checkbox, CheckboxIndicator } from '@ui-sdk/react/checkbox'
import {
  createPopoverController,
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
} from '@ui-sdk/react/popover'
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
} from 'lucide-react'
import { ItemForm } from './item-form'
import { formatDate, localDate, type PlanningItem } from '../workspace'

type AttachmentPayload = { date: string; create: boolean }
export type CalendarRequest = { date: string; id: number }
type Props = {
  items: PlanningItem[]
  selected: string
  month: string
  onMonthChange: (month: string) => void
  onSelect: (date: string) => void
  onSave: (item: PlanningItem) => boolean
  onDelete: (item: PlanningItem) => void
  onEditTask: (item: PlanningItem) => void
  onToggle: (id: string, done: boolean) => void
  request: CalendarRequest | null
  onRequestHandled: () => void
}

export function CalendarPanel({
  items,
  selected,
  month,
  onMonthChange,
  onSelect,
  onSave,
  onDelete,
  onEditTask,
  onToggle,
  request,
  onRequestHandled,
}: Props) {
  const [attachment] = useState(() =>
    createPopoverController<AttachmentPayload>(),
  )
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<
    (Partial<PlanningItem> & { kind: 'deadline' }) | null
  >(null)
  const [session, setSession] = useState(0)
  const [dismissMessage, setDismissMessage] = useState('')
  const calendar = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const addButton = useRef<HTMLButtonElement>(null)
  const pendingTask = useRef<PlanningItem | null>(null)
  const today = localDate()
  const deadlines = items.filter((item) => item.kind === 'deadline')
  const dayItems = items
    .filter((item) => item.date === selected)
    .sort((a, b) => Number(a.done) - Number(b.done))
  const openDeadlines = deadlines.filter((item) => !item.done).length
  const label = formatDate(selected, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  function anchorFor(date: string) {
    return `[data-slot="calendar-day"][data-value="${date}"]`
  }
  function openDay(date: string, anchor?: HTMLElement) {
    if (editing) return
    onSelect(date)
    void attachment.open({
      payload: { date, create: false },
      anchor:
        anchor ??
        calendar.current?.querySelector<HTMLElement>(anchorFor(date)) ??
        undefined,
    })
  }
  function startEditor(item: Partial<PlanningItem> & { kind: 'deadline' }) {
    setDraft(item)
    setSession((value) => value + 1)
    setEditing(true)
    setDismissMessage('')
  }
  function showAgenda() {
    setEditing(false)
    setDismissMessage('')
  }

  const focusActiveView = useCallback(() => {
    const view = panel.current?.querySelector<HTMLElement>(
      '.attachment-view[data-active]',
    )
    if (view?.contains(document.activeElement)) return
    const target = editing
      ? view?.querySelector<HTMLInputElement>('[name="title"]')
      : addButton.current
    target?.focus({ preventScroll: true })
  }, [editing])

  useEffect(() => {
    if (!draft) return
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(focusActiveView)
    })
    return () => cancelAnimationFrame(frame)
  }, [draft, session, focusActiveView])

  useEffect(() => {
    if (!request) return
    void attachment.open({
      payload: { date: request.date, create: true },
      anchor:
        calendar.current?.querySelector<HTMLElement>(
          `[data-slot="calendar-day"][data-value="${request.date}"]`,
        ) ?? undefined,
    })
    onRequestHandled()
  }, [request, attachment, onRequestHandled])

  return (
    <section className="panel calendar-panel" aria-labelledby="calendar-title">
      <header className="panel-header">
        <div>
          <h2 id="calendar-title">
            Calendar
            {openDeadlines > 0 && (
              <span
                className="count-badge"
                aria-label={`${openDeadlines} open deadline${openDeadlines === 1 ? '' : 's'}`}
              >
                {openDeadlines}
              </span>
            )}
          </h2>
        </div>
      </header>
      <Calendar
        ref={calendar}
        aria-label="Deadline calendar"
        className="workspace-calendar"
        value={selected}
        onValueChange={(value) => {
          if (typeof value === 'string') openDay(value)
        }}
        month={month}
        onMonthChange={onMonthChange}
        today={today}
        fixedWeeks
        weekStartsOn={1}
        locale="en-US"
        readOnly={editing}
      >
        <div className="month-toolbar">
          <CalendarHeading />
          <div className="month-actions">
            <Button
              className="button ghost small"
              onClick={() => {
                onSelect(today)
                onMonthChange(today.slice(0, 7))
                requestAnimationFrame(() => openDay(today))
              }}
            >
              Today
            </Button>
            <CalendarPrevious className="icon-button">
              <ChevronLeft size={18} />
            </CalendarPrevious>
            <CalendarNext className="icon-button">
              <ChevronRight size={18} />
            </CalendarNext>
          </div>
        </div>
        <CalendarGrid className="calendar-grid">
          <CalendarWeekdays>
            {(index) => <CalendarWeekday index={index} />}
          </CalendarWeekdays>
          <CalendarWeeks>
            {(cell) => {
              const due = deadlines.filter(
                (item) => item.date === cell.date && !item.done,
              ).length
              return (
                <CalendarDay
                  value={cell.date}
                  className="calendar-day"
                  onClick={(event) => openDay(cell.date, event.currentTarget)}
                  aria-label={`${formatDate(cell.date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}${due ? `, ${due} deadline${due === 1 ? '' : 's'}` : ''}`}
                >
                  <span className="day-number">
                    {Number(cell.date.slice(-2))}
                  </span>
                  <span className="day-caption" aria-hidden="true">
                    {due ? `${due} due` : cell.date === today ? 'Today' : ''}
                  </span>
                </CalendarDay>
              )
            }}
          </CalendarWeeks>
        </CalendarGrid>
      </Calendar>
      <Popover
        controller={attachment}
        modal={editing ? true : 'trap-focus'}
        dismissible={!editing}
        onPayloadChange={(payload) => {
          const next = payload as AttachmentPayload | undefined
          if (next?.create) startEditor({ kind: 'deadline', date: next.date })
          else setEditing(false)
        }}
        onDismissAttempt={() =>
          setDismissMessage('Save or cancel your draft before closing.')
        }
        onOpenChangeComplete={(open) => {
          if (open && editing) focusActiveView()
          if (!open) {
            setEditing(false)
            setDraft(null)
            setDismissMessage('')
            const task = pendingTask.current
            pendingTask.current = null
            if (task) requestAnimationFrame(() => onEditTask(task))
          }
        }}
      >
        <PopoverContent
          ref={panel}
          keepMounted
          anchor={anchorFor(selected)}
          className="day-attachment"
          side="bottom"
          align="start"
          sideOffset={10}
          collisionPadding={16}
          initialFocus={editing ? '[name="title"]' : 'content'}
          finalFocus={() =>
            calendar.current?.querySelector<HTMLElement>(anchorFor(selected)) ??
            null
          }
        >
          <PopoverTitle className="sr-only">Agenda for {label}</PopoverTitle>
          <PopoverDescription className="sr-only">
            View this day’s commitments or add a deadline.
          </PopoverDescription>
          <div
            className="attachment-views"
            onTransitionEnd={(event) => {
              if (
                event.target instanceof HTMLElement &&
                event.target.hasAttribute('data-active')
              )
                focusActiveView()
            }}
            data-editing={editing ? '' : undefined}
          >
            <div
              className="attachment-agenda attachment-view"
              data-active={!editing ? '' : undefined}
              inert={editing}
              aria-hidden={editing}
            >
              <header className="attachment-header">
                <div>
                  <p>{formatDate(selected, { weekday: 'long' })}</p>
                  <h3>
                    {formatDate(selected, { month: 'long', day: 'numeric' })}
                  </h3>
                </div>
                <PopoverClose
                  className="icon-button"
                  aria-label="Close day agenda"
                >
                  <X size={18} />
                </PopoverClose>
              </header>
              <div className="agenda-table-header">
                <span>Commitment</span>
                <span>
                  {dayItems.length} {dayItems.length === 1 ? 'item' : 'items'}
                </span>
              </div>
              {dayItems.length ? (
                <ul className="agenda-list">
                  {dayItems.map((item) => (
                    <li
                      key={item.id}
                      className={item.done ? 'is-complete' : ''}
                    >
                      <Checkbox
                        checked={item.done}
                        onCheckedChange={(done) =>
                          onToggle(item.id, done === true)
                        }
                        aria-label={`Complete ${item.kind} ${item.title}`}
                        className="task-checkbox"
                      >
                        <CheckboxIndicator>
                          <Check size={12} />
                        </CheckboxIndicator>
                      </Checkbox>
                      <Button
                        className="agenda-item-button"
                        aria-label={`Edit ${item.kind} ${item.title}`}
                        onClick={() => {
                          if (item.kind === 'deadline')
                            startEditor({ ...item, kind: 'deadline' })
                          else {
                            pendingTask.current = item
                            void attachment.close()
                          }
                        }}
                      >
                        <span>
                          {item.title}
                          {item.notes && (
                            <span className="agenda-note">{item.notes}</span>
                          )}
                        </span>
                        <small>
                          {item.kind === 'deadline' ? 'Deadline' : 'Task'}
                        </small>
                        <ArrowUpRight size={14} />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="agenda-empty">
                  <p>No deadlines or dated tasks.</p>
                </div>
              )}
              <Button
                ref={addButton}
                className="button primary attachment-add"
                onClick={() =>
                  startEditor({ kind: 'deadline', date: selected })
                }
              >
                <Plus size={16} />
                Add deadline
              </Button>
            </div>
            <div
              className="attachment-editor attachment-view"
              data-active={editing ? '' : undefined}
              inert={!editing}
              aria-hidden={!editing}
            >
              <header className="attachment-editor-header">
                <Button
                  className="button ghost small"
                  aria-label="Back to day agenda"
                  onClick={showAgenda}
                >
                  <ArrowLeft size={16} />
                  Agenda
                </Button>
                <span>{formatDate(selected)}</span>
              </header>
              <h3>{draft?.id ? 'Edit deadline' : 'New deadline'}</h3>
              {draft && (
                <ItemForm
                  key={session}
                  item={draft}
                  onSave={(item) => {
                    const accepted = onSave(item)
                    if (accepted) {
                      if (item.date && item.date !== selected) {
                        void attachment.close()
                        onSelect(item.date)
                      } else showAgenda()
                    }
                    return accepted
                  }}
                  onDelete={(item) => {
                    onDelete(item)
                    void attachment.close()
                  }}
                  onClose={showAgenda}
                />
              )}
              {dismissMessage && (
                <p className="draft-message" role="status">
                  {dismissMessage}
                </p>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </section>
  )
}
