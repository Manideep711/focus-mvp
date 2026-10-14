import { useState } from 'react'
import { Play, ArrowRight, Leaf } from 'lucide-react'
import { Modal, Field, Empty } from './ui'
import type { Commitment, Task, Energy } from '../domain/types'
import { useWorkspace } from '../state/WorkspaceContext'
import {
  commitTask,
  suggestTasks,
  replan,
  newTask,
  logEvent,
  planSummary,
  type SuggestionMode,
} from '../domain/workspace'
import { minutesLabel } from '../domain/dates'

export function ChooseTaskDialog({ onClose }: { onClose(): void }) {
  const { state, today, change, saving } = useWorkspace()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState('')
  const [minutes, setMinutes] = useState('')
  const plan = state.plans.find((p) => p.date === today)
  const tasks = state.tasks.filter(
    (t) =>
      (t.status === 'active' || t.status === 'later') &&
      !state.commitments.some(
        (c) => c.plan_id === plan?.id && c.task_id === t.id && c.status === 'planned',
      ) &&
      t.title.toLowerCase().includes(search.toLowerCase()),
  )
  return (
    <Modal
      title="Choose what matters today"
      subtitle="Your backlog can stay a backlog. Choose just a few actions."
      onClose={onClose}
    >
      <Field label="Find an action">
        <input
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search your actions"
        />
      </Field>
      {tasks.length === 0 ? (
        <Empty
          title="Nothing waiting here"
          body="Create an action from Today, or organize a thought from your Inbox."
        />
      ) : (
        <>
          <Field label="Action">
            <select
              value={selected}
              onChange={(e) => {
                setSelected(e.target.value)
                setMinutes(
                  state.tasks.find((t) => t.id === e.target.value)?.estimate_minutes?.toString() ??
                    '',
                )
              }}
            >
              <option value="">Choose an action</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                  {t.status === 'later' ? ' · Later' : ''}
                </option>
              ))}
            </select>
          </Field>
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              if (
                await change(
                  (s) => commitTask(s, selected, today, minutes ? Number(minutes) : null),
                  'Chosen for Today',
                )
              )
                onClose()
            }}
          >
            <Field
              label="Today’s portion · optional"
              hint="This can be smaller than the whole task."
            >
              <input
                type="number"
                min={1}
                max={1440}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                placeholder="Minutes you want to spend today"
              />
            </Field>
            <div className="form-actions">
              <button className="button" disabled={!selected || saving}>
                Choose for Today
              </button>
            </div>
          </form>
        </>
      )}
    </Modal>
  )
}
export function SuggestionsDialog({
  onClose,
  onFocus,
}: {
  onClose(): void
  onFocus(t: Task): void
}) {
  const { state, today, change, saving } = useWorkspace()
  const [mode, setMode] = useState<SuggestionMode>('plan')
  const summary = planSummary(state, today)
  const [window, setWindow] = useState('day')
  const [energy, setEnergy] = useState<Energy>(summary.plan?.energy ?? 'steady')
  const [variation, setVariation] = useState(0)
  const available =
    window === 'day'
      ? summary.remainingCapacity
      : Math.min(Number(window), summary.remainingCapacity)
  const choices: [SuggestionMode, string][] = [
    ['plan', 'Continue the plan'],
    ['quick', 'A quick win'],
    ['study', 'Focused study'],
    ['low', 'Low energy'],
    ['surprise', 'Surprise me'],
  ]
  const suggestions = suggestTasks(state, today, mode, new Date(), {
    availableMinutes: available,
    energy,
    variation,
  })
  return (
    <Modal
      title="What fits this moment?"
      subtitle="A few possibilities, based on your plan, time, and energy. You decide."
      onClose={onClose}
    >
      <div className="now-context">
        <div className="form-row">
          <Field label="Time right now">
            <select value={window} onChange={(e) => setWindow(e.target.value)}>
              <option value="day">Remaining day · {minutesLabel(summary.remainingCapacity)}</option>
              {[15, 25, 45, 90].map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes} minutes
                </option>
              ))}
            </select>
          </Field>
          <Field label="Energy right now">
            <select value={energy} onChange={(e) => setEnergy(e.target.value as Energy)}>
              <option value="low">Low</option>
              <option value="steady">Steady</option>
              <option value="high">High</option>
            </select>
          </Field>
        </div>
        <p className="small muted">
          These choices only guide suggestions; your daily plan stays as you chose it.
        </p>
      </div>
      {available === 0 && (
        <p className="notice-panel">
          You’ve used the time you set aside. Taking a break is a valid next step. You can still
          choose a small portion or adjust your available time on Today.
        </p>
      )}
      <div className="filter-row" role="group" aria-label="Suggestion approach">
        {choices.map(([value, title]) => (
          <button
            key={value}
            className={`choice-chip ${mode === value ? 'selected' : ''}`}
            aria-pressed={mode === value}
            onClick={() => setMode(value)}
          >
            {title}
          </button>
        ))}
      </div>
      {suggestions.length === 0 ? (
        <Empty
          title="No matching actions right now"
          body="Try another option, or create a small action you would like to move forward."
        />
      ) : (
        suggestions.map(({ task, reason, fits, remainingMinutes, committed, energyMatches }) => (
          <article className="suggestion-card" key={task.id}>
            <div className="now-option-label">
              {committed ? 'Chosen for today' : 'Optional · adds to Today'}
            </div>
            <h3>{task.title}</h3>
            <p>{reason}</p>
            <p>
              {remainingMinutes === null
                ? 'No time estimate yet'
                : remainingMinutes === 0
                  ? 'Your planned portion is used; decide how much more to give it.'
                  : `${minutesLabel(remainingMinutes)} remaining`}
              {fits === false
                ? ` · More than the ${minutesLabel(available)} available right now. Try a smaller portion.`
                : fits === true
                  ? ' · Fits your time right now.'
                  : ''}
              {energyMatches ? ' · Matches your energy.' : ''}
            </p>
            {(task.resume_note || task.description) && (
              <div className="now-next-step">
                <span>Pick up here</span>
                <p>{task.resume_note || task.description}</p>
              </div>
            )}
            <button
              className="button small"
              disabled={saving}
              onClick={async () => {
                if (await change((s) => commitTask(s, task.id, today), 'Ready when you are')) {
                  onClose()
                  onFocus(task)
                }
              }}
            >
              <Play size={13} /> Choose and focus
            </button>
          </article>
        ))
      )}
      {mode === 'surprise' && suggestions.length > 0 && (
        <button className="button subtle small" onClick={() => setVariation((v) => v + 1)}>
          Show another possibility
        </button>
      )}
      <p className="small muted mt-5">
        These suggestions use transparent rules. Paused goals and blocked actions are excluded.
      </p>
    </Modal>
  )
}
export const reviewReasons = [
  'Not enough time',
  'Too difficult',
  'The next action is unclear',
  'A resource is missing',
  'Got distracted',
  'An emergency interrupted me',
  'I didn’t feel like doing it',
  'The estimate was wrong',
  'It is no longer important',
  'I’ve lost interest',
  'Other',
]
export function ReplanDialog({ commitment, onClose }: { commitment: Commitment; onClose(): void }) {
  const { state, today, change, saving } = useWorkspace()
  const task = state.tasks.find((t) => t.id === commitment.task_id)!
  const [reason, setReason] = useState('Not enough time')
  const [other, setOther] = useState('')
  const [step, setStep] = useState('')
  const [estimate, setEstimate] = useState(commitment.planned_minutes?.toString() ?? '')
  const [scheduled, setScheduled] = useState(commitment.scheduled_time ?? '')
  const postponed = state.events.filter(
    (e) => e.task_id === task.id && e.kind === 'replanned',
  ).length
  async function act(action: 'today' | 'tomorrow' | 'later' | 'inbox' | 'archive' | 'remove') {
    if (
      await change(
        (s) =>
          replan(
            s,
            s.commitments.find((c) => c.id === commitment.id)!,
            action,
            reason === 'Other' ? other : reason,
          ),
        'Plan adjusted',
      )
    )
      onClose()
  }
  return (
    <Modal title="Plans can change" subtitle={task.title} onClose={onClose}>
      {postponed >= 2 && (
        <p className="notice-panel">
          This action has moved a few times. Is the next step clear, and does it still matter? You
          can make it smaller or let it go.
        </p>
      )}
      <Field label="What changed?">
        <select value={reason} onChange={(e) => setReason(e.target.value)}>
          {reviewReasons.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </Field>
      {reason === 'Other' && (
        <Field label="A little context · optional">
          <input value={other} maxLength={500} onChange={(e) => setOther(e.target.value)} />
        </Field>
      )}
      <details className="mb-5 text-xs muted">
        <summary className="cursor-pointer mb-3">Adjust this day’s portion or start time</summary>
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            await change((s) => {
              const c = s.commitments.find((c) => c.id === commitment.id)!
              c.planned_minutes = estimate ? Number(estimate) : null
              c.scheduled_time = scheduled || null
              c.updated_at = new Date().toISOString()
              logEvent(
                s,
                task.id,
                c.plan_id,
                'commitment',
                `Adjusted the planned portion or time for ${task.title}`,
              )
            }, 'Commitment updated')
          }}
        >
          <div className="form-row">
            <Field label="Minutes for this day · optional">
              <input
                type="number"
                min={1}
                max={1440}
                value={estimate}
                onChange={(e) => setEstimate(e.target.value)}
              />
            </Field>
            <Field label="Start time · optional">
              <input type="time" value={scheduled} onChange={(e) => setScheduled(e.target.value)} />
            </Field>
          </div>
          <button className="button secondary small" disabled={saving}>
            Save this day’s commitment
          </button>
        </form>
      </details>
      {reason === 'The estimate was wrong' && (
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            await change((s) => {
              const c = s.commitments.find((c) => c.id === commitment.id)!
              c.planned_minutes = estimate ? Number(estimate) : null
              s.tasks.find((t) => t.id === task.id)!.estimate_minutes = c.planned_minutes
              logEvent(
                s,
                task.id,
                c.plan_id,
                'estimate',
                `Re-estimated ${task.title}: ${estimate || 'unknown'} minutes`,
              )
            }, 'Estimate updated')
          }}
        >
          <Field label="A more realistic estimate">
            <input
              type="number"
              min={1}
              max={1440}
              value={estimate}
              onChange={(e) => setEstimate(e.target.value)}
            />
          </Field>
          <button className="button small secondary" disabled={saving}>
            Update estimate
          </button>
        </form>
      )}
      <div className="split-actions">
        {state.plans.find((p) => p.id === commitment.plan_id)?.date !== today && (
          <button className="button secondary" disabled={saving} onClick={() => void act('today')}>
            Choose for Today
          </button>
        )}
        <button className="button secondary" disabled={saving} onClick={() => void act('tomorrow')}>
          {state.plans.find((p) => p.id === commitment.plan_id)?.date === today
            ? 'Tomorrow'
            : 'Next day'}{' '}
          <ArrowRight size={14} />
        </button>
        <button className="button secondary" disabled={saving} onClick={() => void act('later')}>
          Later
        </button>
        <button className="button secondary" disabled={saving} onClick={() => void act('inbox')}>
          Return to Inbox
        </button>
        <button className="button subtle" disabled={saving} onClick={() => void act('remove')}>
          Remove from this day
        </button>
        <button className="button subtle" disabled={saving} onClick={() => void act('archive')}>
          Archive
        </button>
      </div>
      <div className="divider" />
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          if (!step.trim()) return
          if (
            await change((s) => {
              const c = s.commitments.find((c) => c.id === commitment.id)!
              replan(s, c, 'later', `${reason}: made the next step smaller`)
              const smaller = newTask(step, {
                goal_id: task.goal_id,
                project_id: task.project_id,
                resource_id: task.resource_id,
                estimate_minutes: 15,
                description: `A smaller step toward: ${task.title}`,
              })
              s.tasks.push(smaller)
              const date = s.plans.find((p) => p.id === c.plan_id)!.date
              commitTask(s, smaller.id, date)
            }, 'One smaller step is ready')
          )
            onClose()
        }}
      >
        <Field label="Or make the next step smaller">
          <input
            required
            maxLength={500}
            value={step}
            onChange={(e) => setStep(e.target.value)}
            placeholder="One thing you can do in about 15 minutes"
          />
        </Field>
        <button className="button small" disabled={saving}>
          <Leaf size={13} /> Replace with this smaller step
        </button>
      </form>
    </Modal>
  )
}
