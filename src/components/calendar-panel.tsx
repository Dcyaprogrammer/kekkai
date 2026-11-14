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
  ArrowUpRight,
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
} from 'lucide-react'
import { formatDate, localDate, type PlanningItem } from '../workspace'

type Props = {
  items: PlanningItem[]
  selected: string
  month: string
  onMonthChange: (month: string) => void
  onSelect: (date: string) => void
  onAdd: (date: string) => void
  onEdit: (item: PlanningItem) => void
  onToggle: (id: string, done: boolean) => void
}

export function CalendarPanel({
  items,
  selected,
  month,
  onMonthChange,
  onSelect,
  onAdd,
  onEdit,
  onToggle,
}: Props) {
  const today = localDate()
  const deadlines = items.filter((item) => item.kind === 'deadline')
  const dayItems = items
    .filter((item) => item.date === selected)
    .sort((a, b) => Number(a.done) - Number(b.done))
  const openDeadlines = deadlines.filter((item) => !item.done).length

  return (
    <section className="panel calendar-panel" aria-labelledby="calendar-title">
      <header className="panel-header">
        <div>
          <h2 id="calendar-title">
            Your calendar <span className="count-badge">{openDeadlines}</span>
          </h2>
          <p>A little perspective on what’s ahead.</p>
        </div>
        <Button
          className="button secondary small"
          onClick={() => onAdd(selected)}
        >
          <Plus size={15} />
          Deadline
        </Button>
      </header>
      <Calendar
        aria-label="Deadline calendar"
        className="workspace-calendar"
        value={selected}
        onValueChange={(value) => {
          if (typeof value === 'string') onSelect(value)
        }}
        month={month}
        onMonthChange={onMonthChange}
        today={today}
        fixedWeeks
        weekStartsOn={1}
        locale="en-US"
      >
        <div className="month-toolbar">
          <CalendarHeading />
          <div className="month-actions">
            <Button
              className="button ghost small"
              onClick={() => {
                onSelect(today)
                onMonthChange(today.slice(0, 7))
              }}
            >
              Today
            </Button>
            <CalendarPrevious className="icon-button">
              <ChevronLeft size={16} />
            </CalendarPrevious>
            <CalendarNext className="icon-button">
              <ChevronRight size={16} />
            </CalendarNext>
          </div>
        </div>
        <CalendarGrid className="calendar-grid">
          <CalendarWeekdays>
            {(index) => <CalendarWeekday index={index} />}
          </CalendarWeekdays>
          <CalendarWeeks>
            {(cell) => {
              const onDate = deadlines.filter(
                (item) => item.date === cell.date && !item.done,
              )
              return (
                <CalendarDay
                  value={cell.date}
                  className="calendar-day"
                  aria-label={`${formatDate(cell.date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}${onDate.length ? `, ${onDate.length} deadline${onDate.length > 1 ? 's' : ''}` : ''}`}
                >
                  <span className="day-number">
                    {Number(cell.date.slice(-2))}
                  </span>
                  <span className="day-events" aria-hidden="true">
                    {onDate.slice(0, 1).map((item) => (
                      <span key={item.id} className="day-event">
                        {item.title}
                      </span>
                    ))}
                    {onDate.length > 1 && (
                      <span className="more-events">
                        +{onDate.length - 1} more
                      </span>
                    )}
                  </span>
                </CalendarDay>
              )
            }}
          </CalendarWeeks>
        </CalendarGrid>
      </Calendar>
      <div className="day-agenda">
        <div className="agenda-heading">
          <h3>
            {selected === today
              ? 'Today'
              : formatDate(selected, { weekday: 'long' })}{' '}
            <span>{formatDate(selected)}</span>
          </h3>
          <Button
            className="icon-button"
            aria-label={`Add deadline on ${formatDate(selected)}`}
            onClick={() => onAdd(selected)}
          >
            <Plus size={16} />
          </Button>
        </div>
        {dayItems.length ? (
          <ul className="agenda-list">
            {dayItems.map((item) => (
              <li key={item.id} className={item.done ? 'is-complete' : ''}>
                <Checkbox
                  checked={item.done}
                  onCheckedChange={(done) => onToggle(item.id, done === true)}
                  aria-label={`Complete ${item.kind} ${item.title}`}
                  className="task-checkbox"
                >
                  <CheckboxIndicator>
                    <Check size={12} />
                  </CheckboxIndicator>
                </Checkbox>
                <Button
                  className="agenda-item-button"
                  onClick={() => onEdit(item)}
                  aria-label={`Edit ${item.kind} ${item.title}`}
                >
                  <span>{item.title}</span>
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
            <CalendarPlus size={18} />
            <span>No commitments. A little breathing room.</span>
          </div>
        )}
      </div>
      <footer className="calendar-legend">
        <span>
          <i className="legend-dot" />
          Deadline
        </span>
        <span>Choose a day to plan ahead</span>
      </footer>
    </section>
  )
}
