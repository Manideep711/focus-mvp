import { useState } from 'react'
import { ArrowLeft, Play, Pause, Leaf, Check, HelpCircle } from 'lucide-react'
import type { Task } from '../domain/types'
import { Field } from '../components/ui'
import { StuckDialog, OverwhelmedDialog } from '../components/WorkDialogs'
import type { TimerController } from '../state/useFocusTimer'
import { useWorkspace } from '../state/WorkspaceContext'
export function Focus({
  task,
  timer: controller,
  onBack,
  onFinish,
  onFocus,
}: {
  task: Task
  timer: TimerController
  onBack(): void
  onFinish(): void
  onFocus(t: Task): void
}) {
  const [duration, setDuration] = useState(5)
  const { change, saving } = useWorkspace()
  const [editingStep, setEditingStep] = useState(false)
  const [step, setStep] = useState(task.resume_note)
  const [custom, setCustom] = useState(false)
  const [stuck, setStuck] = useState(false)
  const [overwhelmed, setOverwhelmed] = useState(false)
  const { timer, elapsed, storageError } = controller
  const remaining = Math.max(
    0,
    (timer?.target_minutes ?? duration) * 60 - Math.floor(elapsed / 1000),
  )
  const display = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`
  return (
    <>
      <div className="focus-page">
        <div className="flex justify-between items-center">
          <button className="back-button !mb-0" onClick={onBack}>
            <ArrowLeft size={14} /> Return to workspace
          </button>
          <span className="small muted">One thing at a time</span>
        </div>
        <div className="eyebrow">This is where your attention is</div>
        <div className="focus-orbit">
          <Leaf size={25} strokeWidth={1.5} />
        </div>
        <h1>{task.title}</h1>
        <p className="muted mt-4 whitespace-pre-wrap">
          {task.resume_note ||
            task.description ||
            'Start small. Give this action a little uninterrupted attention.'}
        </p>
        {!timer && (
          <button
            className="text-link mx-auto mt-4"
            onClick={() => setEditingStep(!editingStep)}
            aria-expanded={editingStep}
          >
            Make the first step smaller
          </button>
        )}
        {editingStep && !timer && (
          <form
            className="focus-first-step"
            onSubmit={async (e) => {
              e.preventDefault()
              if (!step.trim()) return
              if (
                await change((s) => {
                  const current = s.tasks.find((t) => t.id === task.id)!
                  current.resume_note = step.trim()
                  current.updated_at = new Date().toISOString()
                }, 'First step saved')
              )
                setEditingStep(false)
            }}
          >
            <Field
              label="When I begin, I will…"
              hint="One visible action. For example: open the document and write one sentence."
            >
              <input
                autoFocus
                required
                maxLength={500}
                value={step}
                onChange={(e) => setStep(e.target.value)}
                placeholder="Open the course and play the next lesson"
              />
            </Field>
            <button className="button secondary small" disabled={saving}>
              Save first step
            </button>
          </form>
        )}
        {!timer && (
          <p className="small muted mt-5">
            Try five minutes to get started. You can stop or continue.
          </p>
        )}
        {!timer && (
          <div className="focus-duration">
            {[5, 15, 25, 45, 90].map((m) => (
              <button
                className={`choice-chip ${duration === m && !custom ? 'selected' : ''}`}
                key={m}
                aria-pressed={duration === m && !custom}
                onClick={() => {
                  setDuration(m)
                  setCustom(false)
                }}
              >
                {m} min
              </button>
            ))}
            <button
              className={`choice-chip ${custom ? 'selected' : ''}`}
              onClick={() => setCustom(true)}
            >
              Custom
            </button>
          </div>
        )}
        {custom && !timer && (
          <div className="max-w-48 mx-auto">
            <Field label="Session minutes">
              <input
                type="number"
                min={1}
                max={1440}
                required
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              />
            </Field>
          </div>
        )}
        <div
          className="focus-timer"
          role="timer"
          aria-label={`${Math.floor(remaining / 60)} minutes and ${remaining % 60} seconds remaining`}
        >
          {display}
        </div>
        {timer?.expired && (
          <p className="notice-panel" role="status">
            A moment to pause. A movement or water break is an option.
            <br />
            Choose an outcome when you’re ready.
          </p>
        )}
        <div className="focus-actions">
          {!timer ? (
            <button
              className="button"
              disabled={!Number.isInteger(duration) || duration < 1 || duration > 1440}
              onClick={() => controller.start(task.id, duration)}
            >
              <Play size={15} /> Begin this session
            </button>
          ) : (
            <>
              {!timer.expired && (
                <button
                  className="button secondary"
                  onClick={timer.running_since === null ? controller.resume : controller.pause}
                >
                  {timer.running_since === null ? <Play size={15} /> : <Pause size={15} />}
                  {timer.running_since === null ? 'Resume' : 'Pause'}
                </button>
              )}
              {timer.expired && timer.target_minutes < 1440 && (
                <button className="button secondary" onClick={controller.extend}>
                  Another 15 min
                </button>
              )}
              <button className="button" onClick={onFinish}>
                <Check size={15} /> Finish session
              </button>
            </>
          )}
        </div>
        <div className="focus-secondary">
          <button className="text-link" onClick={() => setStuck(true)}>
            <HelpCircle size={14} /> I’m stuck
          </button>
          <button className="text-link" onClick={() => setOverwhelmed(true)}>
            <Leaf size={14} /> I’m overwhelmed
          </button>
          {timer && (
            <button className="text-link" onClick={onFinish}>
              Stop early
            </button>
          )}
        </div>
        {timer && (
          <div className="focus-notes">
            <Field label="Session notes · optional">
              <textarea
                maxLength={20000}
                value={timer.notes}
                onChange={(e) => controller.setNotes(e.target.value)}
                placeholder="A thought about this work. A question. Somewhere to pick up."
              />
            </Field>
          </div>
        )}
        {storageError && (
          <p className="inline-error" role="alert">
            {storageError}
          </p>
        )}
        <p className="small muted mt-8">
          The timer is a container for your attention, not a measure of your worth.
        </p>
      </div>
      {stuck && <StuckDialog task={task} onClose={() => setStuck(false)} />}
      {overwhelmed && <OverwhelmedDialog onClose={() => setOverwhelmed(false)} onFocus={onFocus} />}
    </>
  )
}
