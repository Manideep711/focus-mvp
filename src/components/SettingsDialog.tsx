import { useState } from 'react'
import { Download, LogOut, Settings, FlaskConical } from 'lucide-react'
import { Modal, Field, ConfirmDelete } from './ui'
import { useWorkspace } from '../state/WorkspaceContext'
import { downloadJSON } from '../services/repository'
import { emptyWorkspace } from '../domain/workspace'
import { exampleWorkspace } from '../domain/demo'
import { supabase } from '../services/supabase'

export function SettingsDialog({
  onClose,
  onSignOut,
}: {
  onClose(): void
  onSignOut(): Promise<void>
}) {
  const { state, mode, change, saving } = useWorkspace()
  const [name, setName] = useState(state.preferences.name)
  const [timezone, setTimezone] = useState(state.preferences.timezone)
  const [reset, setReset] = useState(false)
  const [deleteAccount, setDeleteAccount] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const isEmpty =
    state.tasks.length +
      state.goals.length +
      state.inbox.length +
      state.projects.length +
      state.resources.length ===
    0
  return (
    <>
      <Modal
        title="Your space, your preferences."
        subtitle={
          mode === 'local'
            ? 'This workspace is saved on this browser and device.'
            : 'Your signed-in workspace is saved privately in Supabase.'
        }
        onClose={onClose}
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            try {
              new Intl.DateTimeFormat('en', { timeZone: timezone })
            } catch {
              setError('Use a valid IANA timezone, such as Asia/Kolkata.')
              return
            }
            if (
              await change((s) => {
                s.preferences.name = name.trim()
                s.preferences.timezone = timezone.trim()
              }, 'Preferences saved')
            )
              onClose()
          }}
        >
          <Field label="What should we call you? · optional">
            <input
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your first name"
            />
          </Field>
          <Field
            label="Your timezone"
            hint="Daily plans follow this timezone. Scheduled clock times use your device timezone."
          >
            <input
              required
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              list="timezones"
            />
            <datalist id="timezones">
              {[
                'Asia/Kolkata',
                'Europe/London',
                'America/New_York',
                'America/Los_Angeles',
                'Asia/Tokyo',
                'Australia/Sydney',
                'UTC',
              ].map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </Field>
          <div className="form-actions">
            <button className="button" disabled={saving}>
              <Settings size={14} /> Save preferences
            </button>
          </div>
        </form>
        <div className="divider" />
        <h3 className="mb-2">Your data belongs to you</h3>
        <p className="small muted mb-3">
          Export includes your captured thoughts, goals, plans, sessions, and reflections. Treat the
          downloaded file as personal data.
        </p>
        <button
          className="button secondary small"
          onClick={() =>
            downloadJSON(state, `focus-export-${new Date().toISOString().slice(0, 10)}.json`)
          }
        >
          <Download size={14} /> Export workspace
        </button>
        {mode === 'local' && (
          <>
            <div className="divider" />
            <p className="small muted mb-3">
              Local mode is a real browser workspace. It does not sync across devices. Clearing
              browser data removes it.
            </p>
            {isEmpty && (
              <button
                className="button secondary small"
                disabled={saving}
                onClick={async () => {
                  if (
                    await change(
                      (s) =>
                        Object.assign(s, {
                          ...exampleWorkspace(),
                          revision: s.revision,
                          preferences: s.preferences,
                        }),
                      'Example workspace loaded. You can undo or reset it.',
                    )
                  )
                    onClose()
                }}
              >
                <FlaskConical size={14} /> Try a clearly labeled example
              </button>
            )}
            <button className="text-link block mt-4" onClick={() => setReset(true)}>
              Reset local workspace
            </button>
          </>
        )}
        <div className="divider" />
        <button
          className="button secondary small"
          onClick={async () => {
            setError('')
            try {
              await onSignOut()
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Could not sign out. Please try again.')
            }
          }}
        >
          <LogOut size={14} />
          {mode === 'cloud' ? 'Sign out' : 'Go to sign-in'}
        </button>
        {mode === 'cloud' && (
          <button className="text-link block mt-4" onClick={() => setDeleteAccount(true)}>
            Delete my account and cloud data
          </button>
        )}
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
      </Modal>
      {reset && (
        <ConfirmDelete
          title="Reset this local workspace?"
          body="All local work will be removed. Export first if you want to keep a copy. Any separate cloud account is unaffected."
          onClose={() => setReset(false)}
          onDelete={async () => {
            const ok = await change(
              (s) => Object.assign(s, { ...emptyWorkspace(), revision: s.revision }),
              'Local workspace reset',
              false,
            )
            if (ok) {
              localStorage.removeItem('focus.timer.local')
              localStorage.removeItem('focus.draft.local')
              window.location.reload()
            }
            return ok
          }}
        />
      )}
      {deleteAccount && (
        <Modal
          title="Delete your account permanently?"
          subtitle="This removes all cloud work and revokes your sessions. Export your workspace first if you want to keep it."
          onClose={() => setDeleteAccount(false)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              if (confirmation !== 'DELETE' || !supabase) return
              setBusy(true)
              setError('')
              try {
                const { data } = await supabase.auth.getSession()
                const response = await fetch('/api/account', {
                  method: 'DELETE',
                  headers: { Authorization: `Bearer ${data.session?.access_token}` },
                })
                if (!response.headers.get('content-type')?.includes('application/json'))
                  throw new Error(
                    'Account deletion needs the Cloudflare server endpoint. See deployment setup in README.',
                  )
                const body = await response.json()
                if (!response.ok) throw new Error(body.error || 'Could not delete account.')
                await supabase.auth.signOut({ scope: 'local' })
                onClose()
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Account deletion is unavailable.')
              } finally {
                setBusy(false)
              }
            }}
          >
            <Field label="Type DELETE to confirm">
              <input
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                autoComplete="off"
              />
            </Field>
            {error && (
              <p className="inline-error" role="alert">
                {error}
              </p>
            )}
            <div className="form-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => setDeleteAccount(false)}
              >
                Keep my account
              </button>
              <button className="button danger" disabled={busy || confirmation !== 'DELETE'}>
                Delete account permanently
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
