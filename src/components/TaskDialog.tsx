import { useState, type FormEvent } from 'react'
import type { Task, TaskStatus, Energy } from '../domain/types'
import { Modal, Field, ConfirmDelete } from './ui'
import { useWorkspace } from '../state/WorkspaceContext'
import {
  newTask,
  commitTask,
  planSummary,
  replan,
  logEvent,
  completeTask,
} from '../domain/workspace'
import { minutesLabel } from '../domain/dates'
import { AIAssist } from './AIAssist'
import type { AIResult } from '../services/ai'

export function TaskDialog({
  task,
  goalId,
  emergency = false,
  addToday = false,
  activeTaskId,
  onClose,
}: {
  task?: Task
  goalId?: string
  emergency?: boolean
  addToday?: boolean
  activeTaskId?: string
  onClose(): void
}) {
  const { state, today, change, saving } = useWorkspace()
  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [estimate, setEstimate] = useState(task?.estimate_minutes?.toString() ?? '')
  const [energy, setEnergy] = useState<Energy>(task?.energy ?? 'steady')
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'active')
  const [goal, setGoal] = useState(task?.goal_id ?? goalId ?? '')
  const [project, setProject] = useState(task?.project_id ?? '')
  const [resource, setResource] = useState(task?.resource_id ?? '')
  const [due, setDue] = useState(task?.due_at ? toLocalInput(task.due_at) : '')
  const [resume, setResume] = useState(task?.resume_note ?? '')
  const [blocker, setBlocker] = useState(task?.blocker ?? '')
  const [followUp, setFollowUp] = useState(task?.follow_up_date ?? '')
  const [todayChosen, setTodayChosen] = useState(addToday || emergency)
  const [scheduled, setScheduled] = useState('')
  const [moved, setMoved] = useState<string[]>([])
  const [advanced, setAdvanced] = useState(!!task)
  const [deleting, setDeleting] = useState(false)
  const [suggestion, setSuggestion] = useState<AIResult | null>(null)
  const summary = planSummary(state, today)
  const impact =
    summary.remainingWork +
    (Number(estimate) || 0) -
    moved.reduce((sum, id) => {
      const c = summary.pending.find((c) => c.id === id)
      return sum + (c ? summary.remainingFor(c) : 0)
    }, 0)
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!title.trim()) return
    const ok = await change(
      (s) => {
        const fields = {
          title: title.trim(),
          description,
          estimate_minutes: estimate ? Number(estimate) : null,
          energy,
          status,
          goal_id: goal || null,
          project_id: project || null,
          resource_id: resource || null,
          due_at: due ? new Date(due).toISOString() : null,
          resume_note: resume,
          blocker,
          follow_up_date: followUp || null,
          updated_at: new Date().toISOString(),
        }
        const action = task
          ? s.tasks.find((t) => t.id === task.id)!
          : newTask(title, { is_emergency: emergency })
        Object.assign(action, fields)
        if (!task) s.tasks.push(action)
        if (task && status !== task.status)
          logEvent(s, task.id, null, 'status', `${title} → ${status}`)
        if (status === 'done') completeTask(s, action.id)
        if (status !== 'done') action.completed_at = null
        if (task?.status === 'done' && status === 'active')
          s.commitments
            .filter(
              (c) =>
                c.task_id === action.id &&
                c.status === 'completed' &&
                s.plans.some((p) => p.id === c.plan_id && p.date === today),
            )
            .forEach((c) => {
              c.status = 'planned'
              c.updated_at = new Date().toISOString()
            })
        if (['later', 'archived', 'waiting'].includes(status))
          s.commitments
            .filter(
              (c) =>
                c.task_id === action.id &&
                c.status === 'planned' &&
                s.plans.some((p) => p.id === c.plan_id && p.date >= today),
            )
            .forEach((c) => {
              c.status = 'removed'
              c.reason = `Task marked ${status}`
            })
        if (todayChosen && !task) {
          commitTask(s, action.id, today)
          const plan = s.plans.find((p) => p.date === today)
          const c = s.commitments.find((c) => c.plan_id === plan?.id && c.task_id === action.id)
          if (c) c.scheduled_time = scheduled || null
        }
        if (emergency && todayChosen)
          moved.forEach((id) => {
            const c = s.commitments.find((c) => c.id === id)
            if (c) replan(s, c, 'tomorrow', 'An emergency interrupted me')
          })
      },
      task
        ? 'Action updated'
        : emergency
          ? 'Interruption captured. Your plan is adjusted.'
          : todayChosen
            ? 'Added to Today'
            : 'Action created',
    )
    if (ok) onClose()
  }
  return (
    <>
      <Modal
        title={
          task
            ? 'Give this action some clarity'
            : emergency
              ? 'Make room for the unexpected'
              : 'One concrete next action'
        }
        subtitle={
          emergency
            ? 'Capture it, then choose what can move. You stay in control.'
            : 'Keep it small enough to know where to start.'
        }
        onClose={onClose}
      >
        <form onSubmit={submit}>
          <Field label="What will you do?">
            <input
              autoFocus
              required
              maxLength={500}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Outline the first section of the proposal"
            />
          </Field>
          <div className="form-row">
            <Field label="Estimate · optional">
              <input
                type="number"
                min={1}
                max={1440}
                value={estimate}
                onChange={(e) => setEstimate(e.target.value)}
                placeholder="Minutes"
              />
            </Field>
            <Field label="Energy needed">
              <select value={energy} onChange={(e) => setEnergy(e.target.value as Energy)}>
                <option value="low">Low · a lighter action</option>
                <option value="steady">Steady · some attention</option>
                <option value="high">High · deeper work</option>
              </select>
            </Field>
          </div>
          {!task && (
            <label className="check-label">
              <input
                type="checkbox"
                checked={todayChosen}
                onChange={(e) => setTodayChosen(e.target.checked)}
              />{' '}
              Choose this for Today
            </label>
          )}
          {!advanced && (
            <button className="text-link mt-3" type="button" onClick={() => setAdvanced(true)}>
              Add context, a goal, or a time
            </button>
          )}
          {(advanced || emergency) && (
            <div className="mt-5">
              <Field label="Next step or description · optional">
                <textarea
                  maxLength={20000}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What does getting started look like?"
                />
              </Field>
              <details className="mb-5 text-xs muted">
                <summary className="cursor-pointer mb-3">
                  Help make this action more concrete
                </summary>
                <AIAssist
                  purpose="next_action"
                  text={`Action: ${title}\nContext: ${description}`}
                  onResult={setSuggestion}
                />
                {suggestion && (
                  <>
                    <p className="mb-3">{suggestion.summary}</p>
                    {suggestion.suggestions.map((x, index) => (
                      <div className="suggestion-card" key={index}>
                        <h3>{x.title}</h3>
                        <p>{x.detail}</p>
                        <p>{x.reason}</p>
                        <button
                          type="button"
                          className="text-link"
                          onClick={() => {
                            setTitle(x.title)
                            setDescription(x.detail)
                          }}
                        >
                          Use and edit this next action
                        </button>
                      </div>
                    ))}
                    <button type="button" className="text-link" onClick={() => setSuggestion(null)}>
                      Reject suggestions
                    </button>
                  </>
                )}
              </details>
              <div className="form-row">
                <Field label="Connected goal">
                  <select
                    value={goal}
                    onChange={(e) => {
                      setGoal(e.target.value)
                      setProject('')
                      setResource('')
                    }}
                  >
                    <option value="">No goal needed</option>
                    {state.goals
                      .filter((g) => g.status !== 'archived')
                      .map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.title}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Deadline · optional">
                  <input
                    type="datetime-local"
                    value={due}
                    onChange={(e) => setDue(e.target.value)}
                  />
                </Field>
              </div>
              <div className="form-row">
                <Field label="Project · optional">
                  <select value={project} onChange={(e) => setProject(e.target.value)}>
                    <option value="">No project</option>
                    {state.projects
                      .filter((p) => !goal || p.goal_id === goal)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Resource · optional">
                  <select value={resource} onChange={(e) => setResource(e.target.value)}>
                    <option value="">No resource</option>
                    {state.resources
                      .filter((r) => !goal || r.goal_id === goal)
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.title}
                        </option>
                      ))}
                  </select>
                </Field>
              </div>
              {!task && todayChosen && (
                <Field label="Start time · optional">
                  <input
                    type="time"
                    value={scheduled}
                    onChange={(e) => setScheduled(e.target.value)}
                  />
                </Field>
              )}
              {task && (
                <>
                  <Field label="Where will you pick this up?">
                    <textarea
                      maxLength={20000}
                      value={resume}
                      onChange={(e) => setResume(e.target.value)}
                      placeholder="Leave your future self a useful starting point."
                    />
                  </Field>
                  <Field label="State">
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as TaskStatus)}
                    >
                      <option value="active">Available to work on</option>
                      <option value="waiting">Waiting on something</option>
                      <option value="later">Later</option>
                      <option value="done">Completed</option>
                      <option value="archived">Archived</option>
                    </select>
                  </Field>
                  {status === 'waiting' && (
                    <>
                      <Field label="What are you waiting on?">
                        <input
                          maxLength={500}
                          value={blocker}
                          onChange={(e) => setBlocker(e.target.value)}
                          placeholder="A reply, a decision, a delivery…"
                        />
                      </Field>
                      <Field label="Check in again · optional">
                        <input
                          type="date"
                          value={followUp}
                          onChange={(e) => setFollowUp(e.target.value)}
                        />
                      </Field>
                    </>
                  )}
                </>
              )}
            </div>
          )}
          {emergency && todayChosen && (
            <div className="notice-panel mt-5">
              <p>
                With this interruption, your estimated remaining work is{' '}
                <strong>{minutesLabel(impact)}</strong>, with{' '}
                {minutesLabel(summary.remainingCapacity)} available.
              </p>
              {summary.unknownEstimates > 0 && (
                <p className="small mt-2">Some commitments have no estimate yet.</p>
              )}
              {summary.pending.length > 0 && (
                <>
                  <p className="small mt-4 mb-2">
                    Move any of these to tomorrow? Nothing moves unless you choose it.
                  </p>
                  {summary.pending.map((c) => (
                    <label className="check-label mt-2" key={c.id}>
                      <input
                        type="checkbox"
                        checked={moved.includes(c.id)}
                        onChange={(e) =>
                          setMoved(
                            e.target.checked ? [...moved, c.id] : moved.filter((id) => id !== c.id),
                          )
                        }
                      />
                      {state.tasks.find((t) => t.id === c.task_id)?.title}
                    </label>
                  ))}
                </>
              )}
            </div>
          )}
          {task && task.id === activeTaskId && (
            <p className="small muted mt-4">
              Record the open focus session before deleting this action.
            </p>
          )}
          <div className="form-actions">
            {task && task.id !== activeTaskId && (
              <button type="button" className="button subtle" onClick={() => setDeleting(true)}>
                Delete
              </button>
            )}
            <button type="button" className="button secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="button" disabled={saving || !title.trim()}>
              {saving
                ? 'Saving…'
                : task
                  ? 'Save changes'
                  : emergency
                    ? 'Make room'
                    : todayChosen
                      ? 'Add to Today'
                      : 'Create action'}
            </button>
          </div>
        </form>
      </Modal>
      {deleting && task && (
        <ConfirmDelete
          title="Delete this action?"
          body="This also deletes its commitments and session history. Archiving keeps that history."
          onClose={() => setDeleting(false)}
          onDelete={async () => {
            const ok = await change(
              (s) => {
                s.tasks = s.tasks.filter((t) => t.id !== task.id)
                s.commitments = s.commitments.filter((c) => c.task_id !== task.id)
                s.sessions = s.sessions.filter((x) => x.task_id !== task.id)
                s.plans.forEach((p) => {
                  if (p.anchor_task_id === task.id) p.anchor_task_id = null
                })
                s.events.forEach((e) => {
                  if (e.task_id === task.id) e.task_id = null
                })
              },
              'Action deleted',
              false,
            )
            if (ok) onClose()
            return ok
          }}
        />
      )}
    </>
  )
}
function toLocalInput(value: string) {
  const d = new Date(value)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
