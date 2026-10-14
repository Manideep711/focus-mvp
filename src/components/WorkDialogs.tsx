import { useState, type FormEvent } from 'react'
import { Leaf, ArrowRight } from 'lucide-react'
import { Modal, Field, Empty } from './ui'
import { useWorkspace } from '../state/WorkspaceContext'
import { recordWork, newTask, commitTask, suggestTasks } from '../domain/workspace'
import { AIAssist } from './AIAssist'
import type { ActiveTimer, Outcome, Task } from '../domain/types'
import type { AIResult } from '../services/ai'

export function RecordWorkDialog({
  task,
  timer,
  elapsed,
  onClose,
  onRecorded,
}: {
  task: Task
  timer?: ActiveTimer
  elapsed?: number
  onClose(): void
  onRecorded(): void
}) {
  const { state, change, saving } = useWorkspace()
  const [outcome, setOutcome] = useState<Outcome>('progress')
  const [minutes, setMinutes] = useState('')
  const [notes, setNotes] = useState(timer?.notes ?? '')
  const [resume, setResume] = useState(task.resume_note)
  const [units, setUnits] = useState('')
  const [error, setError] = useState('')
  const resource = state.resources.find((r) => r.id === task.resource_id)
  const seconds = timer
    ? Math.round((elapsed ?? timer.accumulated_ms) / 1000)
    : Math.round((Number(minutes) || 0) * 60)
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (units && resource?.total_units && Number(units) > resource.total_units) {
      setError('Resource progress can’t exceed its total.')
      return
    }
    if (
      await change(
        (s) => {
          recordWork(
            s,
            task.id,
            outcome,
            seconds,
            notes,
            resume,
            timer?.started_at ?? new Date(Date.now() - seconds * 1000).toISOString(),
            timer?.target_minutes ?? null,
            timer ? 'timer' : 'manual',
          )
          if (resource && units)
            s.resources.find((r) => r.id === resource.id)!.progress = Number(units)
        },
        outcome === 'completed'
          ? 'Work recorded. Action completed.'
          : 'Progress recorded. Your next step is saved.',
        false,
      )
    )
      onRecorded()
  }
  return (
    <Modal title="What happened?" subtitle={task.title} onClose={onClose}>
      <form onSubmit={submit}>
        {timer ? (
          <p className="notice-panel">
            Actual focused time: {Math.floor(seconds / 60)} min {seconds % 60} sec. The timer
            doesn’t decide whether the work is complete.
          </p>
        ) : (
          <Field label="Time spent · optional">
            <input
              type="number"
              min={0}
              max={1440}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              placeholder="Minutes, if useful"
            />
          </Field>
        )}
        <Field label="Outcome">
          <select value={outcome} onChange={(e) => setOutcome(e.target.value as Outcome)}>
            <option value="progress">Made progress</option>
            <option value="completed">Completed the action</option>
            <option value="stopped">Stopped</option>
          </select>
        </Field>
        <Field label="What moved forward? · optional">
          <textarea
            maxLength={20000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="A small note about what actually happened."
          />
        </Field>
        {outcome !== 'completed' && (
          <Field label="Where will you pick this up?">
            <textarea
              maxLength={20000}
              value={resume}
              onChange={(e) => setResume(e.target.value)}
              placeholder="The next step, an open question, or the exact place to continue."
            />
          </Field>
        )}
        {resource && (
          <Field
            label={`${resource.title} · total completed ${resource.unit_label}`}
            hint={`Currently ${resource.progress}${resource.total_units ? ` of ${resource.total_units}` : ''}. Updating this doesn’t complete your goal.`}
          >
            <input
              type="number"
              min={0}
              max={resource.total_units ?? undefined}
              step={1}
              value={units}
              onChange={(e) => setUnits(e.target.value)}
              placeholder="Update progress only if useful"
            />
          </Field>
        )}
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Keep considering
          </button>
          <button className="button" disabled={saving}>
            Save what happened
          </button>
        </div>
      </form>
    </Modal>
  )
}
export function StuckDialog({ task, onClose }: { task: Task; onClose(): void }) {
  const { change, saving } = useWorkspace()
  const [reason, setReason] = useState('I don’t understand the problem')
  const [next, setNext] = useState('')
  const [result, setResult] = useState<AIResult | null>(null)
  const options = [
    'I don’t understand the problem',
    'The task is too big',
    'I need a resource',
    'Something else',
  ]
  const guidance =
    reason === options[0]
      ? 'Write down the specific question you need answered. Find one example or ask someone who can help.'
      : reason === options[1]
        ? 'Choose a first step you can do in five to fifteen minutes. You don’t have to solve the whole thing now.'
        : reason === options[2]
          ? 'Name the resource you need, or make finding one your next action. You can attach it from the action editor.'
          : 'Describe what is getting in the way. A pause or a different next step is a valid choice.'
  return (
    <Modal
      title="Let’s find one useful next step."
      subtitle="Being stuck is information. You can adjust the work."
      onClose={onClose}
    >
      <Field label="What’s getting in the way?">
        <select value={reason} onChange={(e) => setReason(e.target.value)}>
          {options.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </Field>
      <p className="notice-panel">{guidance}</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          if (!next.trim()) return
          if (
            await change((s) => {
              const t = s.tasks.find((t) => t.id === task.id)!
              t.resume_note = next.trim()
              t.updated_at = new Date().toISOString()
            }, 'Your next step is saved')
          )
            onClose()
        }}
      >
        <Field label="One useful next step">
          <textarea
            required
            maxLength={20000}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            placeholder="What would make it possible to begin?"
          />
        </Field>
        <div className="form-actions">
          <button className="button" disabled={saving}>
            Keep this next step
          </button>
        </div>
      </form>
      <div className="mt-5">
        <AIAssist
          purpose="stuck"
          text={`Action: ${task.title}\nContext: ${task.description}\nWhy I'm stuck: ${reason}\nMy next step: ${next}`}
          onResult={setResult}
        />
        {result && (
          <>
            <p className="muted small">{result.summary}</p>
            {result.suggestions.map((x, i) => (
              <div className="suggestion-card" key={i}>
                <h3>{x.title}</h3>
                <p>{x.detail}</p>
                <p>{x.reason}</p>
                <button
                  className="text-link"
                  onClick={() => setNext(x.title + (x.detail ? `\n${x.detail}` : ''))}
                >
                  Use and edit this suggestion
                </button>
              </div>
            ))}
          </>
        )}
      </div>
    </Modal>
  )
}
export function OverwhelmedDialog({
  onClose,
  onFocus,
}: {
  onClose(): void
  onFocus(t: Task): void
}) {
  const { state, today, change, saving } = useWorkspace()
  const [step, setStep] = useState('')
  const candidate =
    suggestTasks(state, today, 'low')[0] ??
    suggestTasks(state, today, 'quick')[0] ??
    suggestTasks(state, today, 'plan')[0]
  return (
    <Modal
      title="Just one thing."
      subtitle="Everything else can take a little space. You don’t have to solve the whole day."
      onClose={onClose}
    >
      <div className="focus-orbit">
        <Leaf size={22} />
      </div>
      {candidate ? (
        <div className="suggestion-card">
          <h3>{candidate.task.title}</h3>
          <p>{candidate.task.resume_note || candidate.reason}</p>
          <button
            className="button small"
            onClick={() => {
              onClose()
              onFocus(candidate.task)
            }}
          >
            Try a few minutes <ArrowRight size={14} />
          </button>
        </div>
      ) : (
        <Empty
          title="A small beginning is enough"
          body="Write one manageable action. Opening the document can count as a first step."
        />
      )}
      <div className="divider" />
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          if (!step.trim()) return
          let created: Task | null = null
          if (
            await change((s) => {
              created = newTask(step, { estimate_minutes: 5, energy: 'low' })
              s.tasks.push(created)
              commitTask(s, created.id, today)
            }, 'One manageable step is ready')
          ) {
            onClose()
            if (created) onFocus(created)
          }
        }}
      >
        <Field label="Or choose your own tiny next step">
          <input
            maxLength={500}
            required
            value={step}
            onChange={(e) => setStep(e.target.value)}
            placeholder="One small thing you can begin"
          />
        </Field>
        <button className="button small secondary" disabled={saving}>
          Choose this one thing
        </button>
      </form>
      <button className="text-link mt-5" onClick={onClose}>
        Take a pause and return when ready
      </button>
    </Modal>
  )
}
