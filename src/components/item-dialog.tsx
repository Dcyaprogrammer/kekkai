import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@ui-sdk/react/dialog'
import { CalendarDays, Check, X } from 'lucide-react'
import { ItemForm, type ItemFormProps } from './item-form'

export function ItemDialog({ item, onSave, onDelete, onClose }: ItemFormProps) {
  const noun = item.kind === 'deadline' ? 'deadline' : 'task'
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
        <ItemForm
          item={item}
          onSave={onSave}
          onDelete={onDelete}
          onClose={onClose}
        />
      </DialogContent>
    </Dialog>
  )
}
