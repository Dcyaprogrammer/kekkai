import { useState } from 'react'
import { Button } from '@ui-sdk/react/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@ui-sdk/react/dialog'
import { Input } from '@ui-sdk/react/input'
import { Download, HardDrive, Upload, X } from 'lucide-react'
import { parseWorkspace, STORAGE_KEY, type Workspace } from '../workspace'

function download(text: string, filename: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: 'application/json' }),
  )
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function BackupDialog({
  workspace,
  recovery,
  cloud = false,
  storageKey = STORAGE_KEY,
  onRestore,
  onClose,
}: {
  workspace: Workspace
  recovery: string | null
  cloud?: boolean
  storageKey?: string
  onRestore: (backup: Workspace) => boolean
  onClose: () => void
}) {
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const [browserData, setBrowserData] = useState(() => {
    try {
      return cloud ? localStorage.getItem(STORAGE_KEY) : null
    } catch {
      return null
    }
  })
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="editor-dialog backup-dialog">
        <div className="dialog-icon">
          <HardDrive size={20} />
        </div>
        <DialogTitle>Your workspace, kept safe</DialogTitle>
        <DialogDescription>
          {cloud
            ? 'Your workspace saves to your account. Keep an extra copy, or bring a backup from another browser.'
            : 'Tasks, deadlines, and saved discoveries stay in this browser. Keep a backup somewhere you trust.'}
        </DialogDescription>
        <DialogClose
          className="icon-button dialog-dismiss"
          aria-label="Close backups"
        >
          <X size={18} />
        </DialogClose>
        <div className="backup-section">
          <Download size={20} />
          <div>
            <h3>Export a backup</h3>
            <p>A copy of everything you’ve kept here.</p>
          </div>
          <Button
            className="button secondary small"
            onClick={() =>
              download(
                JSON.stringify(workspace, null, 2),
                `kekkai-${new Date().toISOString().slice(0, 10)}.json`,
              )
            }
          >
            Export JSON
          </Button>
        </div>
        <div className="backup-section restore-section">
          <Upload size={20} />
          <div>
            <h3>Restore a backup</h3>
            <p>Merge missing items. Your current edits stay as they are.</p>
          </div>
          <Input
            aria-label="Restore backup file"
            type="file"
            accept=".json,application/json"
            onChange={async (event) => {
              const file = event.currentTarget.files?.[0]
              if (!file) return
              try {
                if (file.size > 5 * 1024 * 1024)
                  throw new Error('Choose a backup smaller than 5 MB.')
                const backup = parseWorkspace(await file.text())
                if (!onRestore(backup))
                  throw new Error(
                    'This backup could not be merged. Your existing workspace is unchanged.',
                  )
                setFailed(false)
                setMessage('Backup merged into your workspace.')
              } catch (error) {
                setFailed(true)
                setMessage(
                  error instanceof Error
                    ? error.message
                    : 'This backup could not be read.',
                )
              }
              event.target.value = ''
            }}
          />
        </div>
        {browserData && (
          <Button
            className="button secondary small"
            data-agent-confirm="Imports browser-only data into your signed-in account"
            onClick={() => {
              try {
                if (!onRestore(parseWorkspace(browserData)))
                  throw new Error(
                    'Could not merge browser data. Your original copy is kept.',
                  )
                setBrowserData(null)
                setFailed(false)
                setMessage(
                  'Browser data merged into your workspace. Your original copy is kept.',
                )
              } catch (error) {
                setFailed(true)
                setMessage(
                  error instanceof Error
                    ? error.message
                    : 'Could not read browser data.',
                )
              }
            }}
          >
            Import browser data
          </Button>
        )}
        <Button
          className="button ghost small"
          onClick={() => {
            try {
              const raw =
                recovery ?? localStorage.getItem(`${storageKey}.recovery`)
              if (!raw) {
                setFailed(false)
                setMessage(
                  'No recovery copy is needed. Your workspace is readable.',
                )
                return
              }
              download(raw, 'kekkai-recovery.json')
            } catch {
              setFailed(true)
              setMessage('Browser storage is unavailable.')
            }
          }}
        >
          Export recovery copy
        </Button>
        {message && (
          <p
            className={failed ? 'form-error' : 'success-message'}
            role={failed ? 'alert' : 'status'}
          >
            {message}
          </p>
        )}
        <div className="backup-note">
          <HardDrive size={14} />
          {cloud
            ? 'Restores merge into your signed-in account.'
            : 'Local to this browser. No account or cloud sync.'}
        </div>
        <div className="dialog-actions">
          <span className="spacer" />
          <DialogClose className="button primary">Done</DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  )
}
