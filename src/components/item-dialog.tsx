import { useState, type FormEvent } from 'react'
import { Button } from '@ui-sdk/react/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@ui-sdk/react/dialog'
import { Field, FieldLabel } from '@ui-sdk/react/field'
import { Input } from '@ui-sdk/react/input'
import { Textarea } from '@ui-sdk/react/textarea'
import { CalendarDays, Check, Trash2, X } from 'lucide-react'
import { localDate, validDate, type PlanningItem } from '../workspace'

type Props = {
  item: Partial<PlanningItem> & { kind: PlanningItem['kind'] }
  onSave: (item: PlanningItem) => boolean
  onDelete: (item: PlanningItem) => void
  onClose: () => void
}

export function ItemDialog({ item, onSave, onDelete, onClose }: Props) {
  const [title, setTitle] = useState(item.title ?? '')
  const [date, setDate] = useState(
    item.date ?? (item.kind === 'deadline' ? localDate() : ''),
  )
  const [notes, setNotes] = useState(item.notes ?? '')
  const [error, setError] = useState('')
  const noun = item.kind === 'deadline' ? 'deadline' : 'task'

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (
      !title.trim() ||
      title.trim().length > 200 ||
      notes.length > 2000 ||
      (date && !validDate(date)) ||
      (item.kind === 'deadline' && !validDate(date))
    ) {
      setError(
        'Add a title and a valid date for your deadline. Titles can be up to 200 characters.',
      )
      return
    }
    const accepted = onSave({
      id: item.id ?? crypto.randomUUID(),
      kind: item.kind,
      done: item.done ?? false,
      title: title.trim(),
      date: date || null,
      notes,
    })
    if (accepted) onClose()
    else
      setError(
        'This change could not be saved. Your existing workspace is unchanged.',
      )
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="editor-dialog" initialFocus="[name=title]">
        <div className="dialog-icon">
          {item.kind === 'deadline' ? (
            <CalendarDays size={20} />
          ) : (
            <Check size={20} />
          )}
        </div>
        <DialogTitle>
          {item.id ? 'Edit' : 'New'} {noun}
        </DialogTitle>
        <DialogDescription>
          {item.kind === 'deadline'
            ? 'Give your next commitment a place on the calendar.'
            : 'One less thing to keep in your head.'}
        </DialogDescription>
        <DialogClose
          className="icon-button dialog-dismiss"
          aria-label={`Close ${noun} editor`}
        >
          <X size={18} />
        </DialogClose>
        <form onSubmit={submit} className="editor-form">
          <Field>
            <FieldLabel>Title</FieldLabel>
            <Input
              name="title"
              placeholder={
                item.kind === 'deadline'
                  ? 'What’s the deadline?'
                  : 'What needs to get done?'
              }
              value={title}
              onValueChange={setTitle}
              required
              maxLength={200}
            />
          </Field>
          <Field>
            <FieldLabel>
              {item.kind === 'deadline'
                ? 'Deadline date'
                : 'Due date (optional)'}
            </FieldLabel>
            <Input
              type="date"
              value={date}
              onValueChange={setDate}
              required={item.kind === 'deadline'}
              min="0001-01-01"
              max="9999-12-31"
            />
          </Field>
          <Field>
            <FieldLabel>Notes (optional)</FieldLabel>
            <Textarea
              placeholder="A little context for your future self…"
              rows={3}
              value={notes}
              onValueChange={setNotes}
              maxLength={2000}
            />
          </Field>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            {item.id && (
              <Button
                className="button danger-ghost"
                onClick={() => {
                  onDelete(item as PlanningItem)
                  onClose()
                }}
                data-agent-confirm={`Removes ${item.title}. Undo is available.`}
              >
                <Trash2 size={15} />
                Delete {noun}
              </Button>
            )}
            <span className="spacer" />
            <DialogClose className="button secondary">Cancel</DialogClose>
            <Button type="submit" className="button primary">
              {item.id ? 'Save changes' : `Add ${noun}`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
