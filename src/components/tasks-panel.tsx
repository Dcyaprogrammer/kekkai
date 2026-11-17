import { useState, type FormEvent } from 'react'
import { Button } from '@ui-sdk/react/button'
import { Checkbox, CheckboxIndicator } from '@ui-sdk/react/checkbox'
import { Input } from '@ui-sdk/react/input'
import {
  Progress,
  ProgressIndicator,
  ProgressTrack,
} from '@ui-sdk/react/progress'
import {
  SegmentedControl,
  SegmentedControlItem,
} from '@ui-sdk/react/segmented-control'
import {
  ArrowUp,
  CalendarDays,
  Check,
  CircleCheck,
  MoreHorizontal,
  Plus,
} from 'lucide-react'
import { formatDate, localDate, type PlanningItem } from '../workspace'

type Props = {
  items: PlanningItem[]
  onAdd: (title: string) => boolean
  onNew: () => void
  onEdit: (item: PlanningItem) => void
  onToggle: (id: string, done: boolean) => void
}

export function TasksPanel({ items, onAdd, onNew, onEdit, onToggle }: Props) {
  const [title, setTitle] = useState('')
  const [filter, setFilter] = useState('open')
  const tasks = items.filter((item) => item.kind === 'task')
  const completed = tasks.filter((task) => task.done).length
  const filtered = tasks
    .filter(
      (task) =>
        filter === 'all' || (filter === 'done' ? task.done : !task.done),
    )
    .sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'))
  const today = localDate()

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!title.trim() || title.trim().length > 200 || !onAdd(title.trim()))
      return
    setTitle('')
    setFilter('open')
  }

  return (
    <section className="panel tasks-panel" aria-labelledby="tasks-title">
      <header className="panel-header">
        <div>
          <h2 id="tasks-title">
            To-do list{' '}
            <span className="count-badge">{tasks.length - completed}</span>
          </h2>
        </div>
        <Button
          className="icon-button"
          aria-label="Create task with details"
          onClick={onNew}
        >
          <Plus size={18} />
        </Button>
      </header>
      <div className="task-panel-content">
        <SegmentedControl
          value={filter}
          onValueChange={(value) => {
            if (value) setFilter(value)
          }}
          aria-label="Task filter"
          className="segments"
        >
          <SegmentedControlItem value="open">Open</SegmentedControlItem>
          <SegmentedControlItem value="all">All</SegmentedControlItem>
          <SegmentedControlItem value="done">Completed</SegmentedControlItem>
        </SegmentedControl>
        <form className="quick-task" onSubmit={submit}>
          <Plus size={17} />
          <Input
            aria-label="Quick task title"
            placeholder="Add a task…"
            maxLength={200}
            value={title}
            onValueChange={setTitle}
          />
          <Button
            type="submit"
            className="icon-button quick-submit"
            aria-label="Add quick task"
            disabled={!title.trim() || title.trim().length > 200}
          >
            <ArrowUp size={15} />
          </Button>
        </form>
        {filtered.length ? (
          <ul className="task-list">
            {filtered.map((task) => (
              <li
                key={task.id}
                className={`task-row${task.done ? ' is-complete' : ''}`}
              >
                <Checkbox
                  checked={task.done}
                  onCheckedChange={(done) => onToggle(task.id, done === true)}
                  aria-label={`Complete ${task.title}`}
                  className="task-checkbox"
                >
                  <CheckboxIndicator>
                    <Check size={12} />
                  </CheckboxIndicator>
                </Checkbox>
                <Button
                  className="task-title"
                  onClick={() => onEdit(task)}
                  aria-label={`Edit ${task.title}`}
                >
                  <span>{task.title}</span>
                  {task.date && (
                    <small
                      className={
                        !task.done && task.date < today ? 'overdue' : ''
                      }
                    >
                      <CalendarDays size={11} />
                      {task.date === today ? 'Today' : formatDate(task.date)}
                      {!task.done && task.date < today && ' · Overdue'}
                    </small>
                  )}
                </Button>
                <Button
                  className="icon-button task-more"
                  aria-label={`Task details for ${task.title}`}
                  onClick={() => onEdit(task)}
                >
                  <MoreHorizontal size={17} />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="tasks-empty">
            <p>
              {filter === 'done'
                ? 'No completed tasks.'
                : tasks.length
                  ? 'No open tasks.'
                  : 'No tasks yet.'}
            </p>
          </div>
        )}
      </div>
      <footer className="task-progress">
        <div>
          <CircleCheck size={14} />
          <span>
            {completed} of {tasks.length} completed
          </span>
          <span className="progress-percent">
            {tasks.length ? Math.round((completed / tasks.length) * 100) : 0}%
          </span>
        </div>
        <Progress
          value={completed}
          max={tasks.length || 1}
          aria-label="Task completion"
          className="task-completion"
        >
          <ProgressTrack className="progress-track">
            <ProgressIndicator />
          </ProgressTrack>
        </Progress>
      </footer>
    </section>
  )
}
