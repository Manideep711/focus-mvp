import { useEffect, useState, Component, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  Sun,
  Target,
  Inbox as InboxIcon,
  Sprout,
  Plus,
  Settings,
  ArrowRight,
  Check,
  X,
  Frown,
  Play,
} from 'lucide-react'
import { supabase, googleEnabled } from './services/supabase'
import { localRepository, cloudRepository, downloadJSON, LOCAL_KEY } from './services/repository'
import { WorkspaceProvider, useWorkspace } from './state/WorkspaceContext'
import { Today, type TaskHandlers } from './pages/Today'
import { TaskDialog } from './components/TaskDialog'
import { ReplanDialog } from './components/PlanningDialogs'
import { Modal, Field, ConfirmDelete } from './components/ui'
import type { Task, Commitment, ActiveTimer } from './domain/types'
import { Inbox, CaptureDialog } from './pages/Inbox'
import { Goals } from './pages/Goals'
import { Progress, ReviewDialog } from './pages/Progress'
import { Focus } from './pages/Focus'
import { SettingsDialog } from './components/SettingsDialog'
import { RecordWorkDialog, OverwhelmedDialog } from './components/WorkDialogs'
import { useFocusTimer, pauseTimer } from './state/useFocusTimer'
import { FocusMark } from './components/FocusMark'
import { motion, useReducedMotion } from 'motion/react'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false }
  static getDerivedStateFromError() {
    return { error: true }
  }
  render() {
    return this.state.error ? (
      <div className="error-page">
        <h1>A moment to reset.</h1>
        <p className="muted mt-4">
          Something unexpected happened. Your saved workspace is still there.
        </p>
        <button className="button mt-6" onClick={() => window.location.reload()}>
          Reload Focus
        </button>
      </div>
    ) : (
      this.props.children
    )
  }
}
export function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(!!supabase)
  const [local, setLocal] = useState(
    () => !supabase || sessionStorage.getItem('focus.workspace.mode') === 'local',
  )
  const [authError, setAuthError] = useState('')
  useEffect(() => {
    if (!supabase) return
    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) setAuthError(error.message)
      setSession(data.session)
      setAuthLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setAuthLoading(false)
    })
    return () => data.subscription.unsubscribe()
  }, [])
  if (authLoading)
    return (
      <div className="loading-page">
        <div className="spinner" />
        Opening your workspace…
      </div>
    )
  return (
    <ErrorBoundary>
      {!session && !local ? (
        <SignIn
          error={authError}
          onLocal={() => {
            sessionStorage.setItem('focus.workspace.mode', 'local')
            setLocal(true)
          }}
        />
      ) : (
        <WorkspaceProvider
          key={session?.user.id ?? 'local'}
          repository={session ? cloudRepository : localRepository}
          storageScope={session?.user.id ?? 'local'}
        >
          <Shell
            onSignOut={async () => {
              if (supabase && session) {
                const { error } = await supabase.auth.signOut()
                if (error) throw new Error(error.message)
              }
              sessionStorage.removeItem('focus.workspace.mode')
              setLocal(false)
            }}
          />
        </WorkspaceProvider>
      )}
    </ErrorBoundary>
  )
}
function SignIn({ onLocal, error: externalError }: { onLocal(): void; error: string }) {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState(externalError)
  const [busy, setBusy] = useState(false)
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="brand">
          <FocusMark size={38} /> Focus
        </div>
        <h1>
          A quieter space
          <br />
          for what matters.
        </h1>
        <p className="muted">
          Clear your mind. Choose your attention.
          <br />
          Take the next step.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            if (!supabase) return
            setBusy(true)
            setError('')
            const { error } = await supabase.auth.signInWithOtp({
              email,
              options: { emailRedirectTo: window.location.origin },
            })
            setBusy(false)
            if (error) setError(error.message)
            else setMessage('Check your email for a secure sign-in link.')
          }}
        >
          <Field label="Email">
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </Field>
          <button className="button" disabled={busy || !supabase}>
            {busy ? 'Sending…' : 'Email me a sign-in link'}
            <ArrowRight size={15} />
          </button>
        </form>
        {googleEnabled && (
          <button
            className="button secondary mt-3"
            onClick={async () => {
              const result = await supabase?.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: window.location.origin },
              })
              if (result?.error) setError(result.error.message)
            }}
          >
            Continue with Google
          </button>
        )}
        {message && (
          <p className="muted mt-4" role="status">
            {message}
          </p>
        )}
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
        <div className="divider" />
        <button className="button secondary" onClick={onLocal}>
          Use a local workspace
        </button>
        <p className="auth-note">
          Local work stays in this browser. Account work is saved privately through Supabase.
        </p>
      </div>
    </div>
  )
}
type Page = 'today' | 'goals' | 'inbox' | 'progress'
function Shell({ onSignOut }: { onSignOut(): Promise<void> }) {
  const reducedMotion = useReducedMotion()
  const {
    state,
    loading,
    loadFailed,
    error,
    notice,
    saving,
    mode,
    storageScope,
    canUndo,
    undo,
    reload,
    dismiss,
  } = useWorkspace()
  const readPage = (): Page => {
    const hash = window.location.hash.slice(1)
    return ['today', 'goals', 'inbox', 'progress'].includes(hash) ? (hash as Page) : 'today'
  }
  const [page, setPage] = useState<Page>(readPage)
  const [taskModal, setTaskModal] = useState<{
    task?: Task
    emergency?: boolean
    addToday?: boolean
  } | null>(null)
  const [replanning, setReplanning] = useState<Commitment | null>(null)
  const [capture, setCapture] = useState<'quick' | 'clear' | null>(null)
  const [settings, setSettings] = useState(false)
  const [review, setReview] = useState<'daily' | 'weekly' | null>(null)
  const [overwhelmed, setOverwhelmed] = useState(false)
  const [focusTask, setFocusTask] = useState<string | null>(null)
  const [focusOpen, setFocusOpen] = useState(false)
  const [switchSession, setSwitchSession] = useState(false)
  const [resetCorrupt, setResetCorrupt] = useState(false)
  const [discardOrphan, setDiscardOrphan] = useState(false)
  const [recording, setRecording] = useState<{
    task: Task
    timer?: ActiveTimer
    elapsed?: number
  } | null>(null)
  const controller = useFocusTimer(storageScope)
  function openFocus(task: Task) {
    if (controller.timer && !state.tasks.some((t) => t.id === controller.timer!.task_id)) {
      setDiscardOrphan(true)
      return
    }
    if (controller.timer && controller.timer.task_id !== task.id) {
      setSwitchSession(true)
      return
    }
    setFocusTask(task.id)
    setFocusOpen(true)
  }
  function finishSession(task: Task) {
    if (!controller.timer) return
    const snapshot = pauseTimer(controller.timer)
    controller.pause()
    setRecording({ task, timer: snapshot, elapsed: snapshot.accumulated_ms })
  }
  function navigate(next: Page) {
    window.location.hash = next
    setPage(next)
    setFocusOpen(false)
  }
  const nav = [
    { id: 'today' as const, label: 'Today', icon: Sun },
    { id: 'goals' as const, label: 'Goals', icon: Target },
    { id: 'inbox' as const, label: 'Inbox', icon: InboxIcon },
    { id: 'progress' as const, label: 'Progress', icon: Sprout },
  ]
  useEffect(() => {
    const fn = () => {
      setPage(readPage())
      setFocusOpen(false)
    }
    window.addEventListener('hashchange', fn)
    return () => window.removeEventListener('hashchange', fn)
  }, [])
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() === 'n' &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !(
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          e.target instanceof HTMLSelectElement
        ) &&
        !document.querySelector('dialog[open], [role="dialog"][data-state="open"]') &&
        !focusOpen
      ) {
        e.preventDefault()
        setCapture('quick')
      }
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [focusOpen])
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(dismiss, 6000)
    return () => clearTimeout(timer)
  }, [notice])
  const handlers: TaskHandlers = {
    onFocus: openFocus,
    onEdit: (task) => setTaskModal({ task }),
    onRecord: (task) => {
      if (controller.timer?.task_id === task.id) finishSession(task)
      else setRecording({ task })
    },
    onReplan: setReplanning,
  }
  const selectedFocusTask = state.tasks.find(
    (t) => t.id === (controller.timer?.task_id ?? focusTask),
  )
  if (loading)
    return (
      <div className="loading-page">
        <div className="spinner" />
        Making a little room…
      </div>
    )
  if (loadFailed)
    return (
      <>
        <div className="error-page">
          <h1>Let’s get your workspace ready.</h1>
          <p className="muted mt-4">{error}</p>
          <div className="split-actions">
            <button className="button" onClick={() => void reload()}>
              Try loading again
            </button>
            {mode === 'local' && (
              <button
                className="button secondary"
                onClick={() =>
                  downloadJSON(localStorage.getItem(LOCAL_KEY) ?? '{}', 'focus-recovery.json')
                }
              >
                Export stored data
              </button>
            )}
            {mode === 'local' && (
              <button className="button secondary" onClick={() => setResetCorrupt(true)}>
                Reset unreadable local workspace
              </button>
            )}
            <button className="button secondary" onClick={() => void onSignOut()}>
              Back to sign-in
            </button>
          </div>
        </div>
        {resetCorrupt && (
          <ConfirmDelete
            title="Reset the unreadable workspace?"
            body="Export the stored data first if you want a recovery copy. Resetting permanently removes the local workspace, draft, and open timer."
            onClose={() => setResetCorrupt(false)}
            onDelete={async () => {
              localStorage.removeItem(LOCAL_KEY)
              localStorage.removeItem('focus.timer.local')
              localStorage.removeItem('focus.draft.local')
              window.location.reload()
              return true
            }}
          />
        )}
      </>
    )
  return (
    <div className={`app-shell ${focusOpen ? 'is-focusing' : ''}`}>
      <aside className="sidebar">
        <div className="brand">
          <FocusMark size={34} /> Focus<span className="brand-period">.</span>
        </div>
        <p className="brand-caption">MAKE ROOM FOR WHAT MATTERS</p>
        <nav className="nav" aria-label="Main navigation">
          {nav.map((item) => (
            <button
              key={item.id}
              aria-label={item.label}
              className={!focusOpen && page === item.id ? 'active' : ''}
              aria-current={!focusOpen && page === item.id ? 'page' : undefined}
              onClick={() => navigate(item.id)}
            >
              {!focusOpen && page === item.id && (
                <motion.span
                  layoutId="navigation-selection"
                  className="nav-selection"
                  transition={{ duration: reducedMotion ? 0 : 0.2, ease: 'easeOut' }}
                  aria-hidden="true"
                />
              )}
              <item.icon size={18} strokeWidth={1.6} />
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>
        <button className="button secondary sidebar-add" onClick={() => setCapture('quick')}>
          <Plus size={17} /> Capture a thought <span className="keyboard-hint">N</span>
        </button>
        <div className="sidebar-bottom">
          <p className="sidebar-quote">
            You don’t manage your tasks.
            <br />
            You manage your attention.
          </p>
          <button className="profile" onClick={() => setSettings(true)}>
            <span className="avatar">
              {state.preferences.name?.slice(0, 1).toUpperCase() || 'F'}
            </span>
            <span>
              <span className="block text-xs">{state.preferences.name || 'Your workspace'}</span>
              <span className="block text-[10px] muted">
                {mode === 'local' ? 'Saved in this browser' : 'Private cloud workspace'}
              </span>
            </span>
            <Settings size={14} className="ml-auto muted" />
          </button>
        </div>
      </aside>
      <main className="main">
        <div className="topbar">
          <div className="topbar-context">
            <Sun size={15} />
            <span>{focusOpen ? 'Focus' : nav.find((n) => n.id === page)?.label}</span>
            <span className="small muted">/ Your personal workspace</span>
          </div>
          <div className="topbar-actions">
            {focusOpen && (
              <button
                className="icon-button"
                aria-label="Capture a thought"
                onClick={() => setCapture('quick')}
              >
                <Plus size={17} />
              </button>
            )}
            {controller.timer && !focusOpen && (
              <button
                className="text-link"
                onClick={() => {
                  if (!selectedFocusTask) setDiscardOrphan(true)
                  else setFocusOpen(true)
                }}
              >
                <Play size={13} /> Return to session
              </button>
            )}
            <span className="flex items-center gap-2">
              <span className="status-dot" />
              {saving ? 'Saving…' : mode === 'local' ? 'Local workspace' : 'Saved'}
            </span>
            <button className="icon-button" aria-label="Settings" onClick={() => setSettings(true)}>
              <Settings size={16} />
            </button>
          </div>
        </div>
        <div className="content">
          {focusOpen && selectedFocusTask ? (
            <Focus
              key={selectedFocusTask.id}
              task={selectedFocusTask}
              timer={controller}
              onBack={() => setFocusOpen(false)}
              onFinish={() => finishSession(selectedFocusTask)}
              onFocus={openFocus}
            />
          ) : page === 'today' ? (
            <Today
              handlers={handlers}
              onAdd={() => setTaskModal({ addToday: true })}
              onCapture={() => setCapture('quick')}
              onEmergency={() => setTaskModal({ emergency: true })}
              onReview={() => setReview('daily')}
              onOverwhelmed={() => setOverwhelmed(true)}
            />
          ) : page === 'inbox' ? (
            <Inbox
              handlers={handlers}
              onCapture={() => setCapture('quick')}
              onClearHead={() => setCapture('clear')}
              onAdd={() => setTaskModal({})}
            />
          ) : page === 'goals' ? (
            <Goals handlers={handlers} />
          ) : (
            <Progress onReview={() => setReview('daily')} onWeekly={() => setReview('weekly')} />
          )}
        </div>
      </main>
      {!focusOpen && (
        <nav className="mobile-bar" aria-label="Mobile navigation">
          {nav.map((item) => (
            <button
              key={item.id}
              className={page === item.id ? 'active' : ''}
              onClick={() => navigate(item.id)}
            >
              <item.icon size={19} />
              {item.label}
            </button>
          ))}
          <button className="mobile-add" onClick={() => setCapture('quick')}>
            <Plus size={21} />
            Capture
          </button>
        </nav>
      )}
      {(error || notice) && (
        <div className={`toast ${error ? 'error' : ''}`} role={error ? 'alert' : 'status'}>
          {error ? <Frown size={16} /> : <Check size={16} />}
          <span>{error || notice}</span>
          {error ? (
            <button className="text-link" onClick={() => void reload()}>
              Reload
            </button>
          ) : (
            canUndo && (
              <button className="text-link" onClick={() => void undo()}>
                Undo
              </button>
            )
          )}
          <button className="icon-button" aria-label="Dismiss notification" onClick={dismiss}>
            <X size={14} />
          </button>
        </div>
      )}
      {taskModal && (
        <TaskDialog
          {...taskModal}
          activeTaskId={controller.timer?.task_id}
          onClose={() => setTaskModal(null)}
        />
      )}
      {replanning && <ReplanDialog commitment={replanning} onClose={() => setReplanning(null)} />}
      {capture && (
        <CaptureDialog clearHead={capture === 'clear'} onClose={() => setCapture(null)} />
      )}
      {settings && <SettingsDialog onClose={() => setSettings(false)} onSignOut={onSignOut} />}
      {review && <ReviewDialog weekly={review === 'weekly'} onClose={() => setReview(null)} />}
      {overwhelmed && (
        <OverwhelmedDialog onClose={() => setOverwhelmed(false)} onFocus={openFocus} />
      )}
      {recording && (
        <RecordWorkDialog
          {...recording}
          onClose={() => setRecording(null)}
          onRecorded={() => {
            if (recording.timer) {
              controller.clear()
              setFocusOpen(false)
              setFocusTask(null)
            }
            setRecording(null)
          }}
        />
      )}
      {switchSession && (
        <Modal
          title="One session is already open."
          subtitle="Record or finish that session before choosing a different action."
          onClose={() => setSwitchSession(false)}
        >
          <button
            className="button"
            onClick={() => {
              setSwitchSession(false)
              setFocusOpen(true)
            }}
          >
            Return to the current session
          </button>
        </Modal>
      )}
      {discardOrphan && (
        <Modal
          title="The action for this timer was removed."
          subtitle="Your unsaved timer is still on this device. Keep any notes you need before discarding it."
          onClose={() => setDiscardOrphan(false)}
        >
          <p className="notice-panel">
            {Math.floor(controller.elapsed / 60000)} min of unrecorded focus time.
          </p>
          {controller.timer?.notes && (
            <pre className="small whitespace-pre-wrap my-4">{controller.timer.notes}</pre>
          )}
          <div className="form-actions">
            <button className="button secondary" onClick={() => setDiscardOrphan(false)}>
              Keep the timer for now
            </button>
            <button
              className="button danger"
              onClick={() => {
                controller.clear()
                setDiscardOrphan(false)
                setFocusOpen(false)
              }}
            >
              Discard this unsaved timer
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
