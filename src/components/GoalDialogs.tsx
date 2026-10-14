import { useState, type FormEvent } from 'react'
import { Modal, Field } from './ui'
import { AIAssist } from './AIAssist'
import { useWorkspace } from '../state/WorkspaceContext'
import { baseRecord } from '../domain/dates'
import { logEvent } from '../domain/workspace'
import type { Goal, GoalStatus, Project, Resource, Phase } from '../domain/types'
import type { AIResult } from '../services/ai'
export const statuses: GoalStatus[] = ['active', 'idea', 'later', 'paused', 'completed', 'archived']
export function GoalDialog({ goal, onClose }: { goal?: Goal; onClose(): void }) {
  const { change, saving } = useWorkspace()
  const [title, setTitle] = useState(goal?.title ?? '')
  const [why, setWhy] = useState(goal?.why ?? '')
  const [status, setStatus] = useState<GoalStatus>(goal?.status ?? 'idea')
  const [target, setTarget] = useState(goal?.target_date ?? '')
  const [resume, setResume] = useState(goal?.resume_date ?? '')
  const [notes, setNotes] = useState(goal?.notes ?? '')
  return (
    <Modal
      title={goal ? 'Make this goal your own' : 'An outcome you care about'}
      subtitle="A title is enough to begin. Add context when it helps."
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          if (!title.trim()) return
          if (
            await change(
              (s) => {
                const fields = {
                  title: title.trim(),
                  why,
                  status,
                  target_date: target || null,
                  resume_date: status === 'paused' ? resume || null : null,
                  notes,
                  updated_at: new Date().toISOString(),
                }
                if (goal)
                  Object.assign(
                    s.goals.find((g) => g.id === goal.id)!,
                    fields,
                  )
                else s.goals.push({ ...baseRecord(), ...fields, source_inbox_id: null })
                logEvent(
                  s,
                  null,
                  null,
                  'goal',
                  `${goal ? 'Updated' : 'Created'} ${title}: ${status}`,
                )
              },
              goal ? 'Goal updated' : 'Goal created',
            )
          )
            onClose()
        }}
      >
        <Field label="What do you want to achieve?">
          <input
            autoFocus
            required
            maxLength={500}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="An outcome, rather than a list of tasks"
          />
        </Field>
        <Field label="Why it matters · optional">
          <textarea maxLength={20000} value={why} onChange={(e) => setWhy(e.target.value)} />
        </Field>
        <div className="form-row">
          <Field label="Attention right now">
            <select value={status} onChange={(e) => setStatus(e.target.value as GoalStatus)}>
              {statuses.map((v) => (
                <option key={v} value={v}>
                  {v[0].toUpperCase() + v.slice(1)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Target date · optional">
            <input type="date" value={target} onChange={(e) => setTarget(e.target.value)} />
          </Field>
        </div>
        {status === 'paused' && (
          <Field
            label="Reconsider around · optional"
            hint="Focus will remind you to reconsider, without automatically activating it."
          >
            <input type="date" value={resume} onChange={(e) => setResume(e.target.value)} />
          </Field>
        )}
        <Field label="Notes · optional">
          <textarea maxLength={20000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <div className="form-actions">
          <button className="button secondary" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="button" disabled={saving}>
            Save goal
          </button>
        </div>
      </form>
    </Modal>
  )
}
export function ProjectDialog({
  project,
  goalId,
  onClose,
}: {
  project?: Project
  goalId?: string
  onClose(): void
}) {
  const { state, change, saving } = useWorkspace()
  const [title, setTitle] = useState(project?.title ?? '')
  const [goal, setGoal] = useState(project?.goal_id ?? goalId ?? '')
  const [notes, setNotes] = useState(project?.notes ?? '')
  const [status, setStatus] = useState<Project['status']>(project?.status ?? 'active')
  return (
    <Modal title={project ? 'Edit project' : 'A larger piece of work'} onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          if (!title.trim()) return
          if (
            await change((s) => {
              const fields = {
                title: title.trim(),
                goal_id: goal || null,
                notes,
                status,
                updated_at: new Date().toISOString(),
              }
              if (project)
                Object.assign(
                  s.projects.find((p) => p.id === project.id)!,
                  fields,
                )
              else s.projects.push({ ...baseRecord(), ...fields, source_inbox_id: null })
              logEvent(
                s,
                null,
                null,
                'project',
                `${project ? 'Updated' : 'Created'} project: ${title}`,
              )
            }, 'Project saved')
          )
            onClose()
        }}
      >
        <Field label="Project title">
          <input
            autoFocus
            required
            maxLength={500}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        <Field label="Connected goal">
          <select value={goal} onChange={(e) => setGoal(e.target.value)}>
            <option value="">Independent project</option>
            {state.goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value as Project['status'])}>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </select>
        </Field>
        <Field label="Outcome or notes">
          <textarea maxLength={20000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <div className="form-actions">
          <button className="button" disabled={saving}>
            Save project
          </button>
        </div>
      </form>
    </Modal>
  )
}
export function ResourceDialog({
  resource,
  goalId,
  onClose,
}: {
  resource?: Resource
  goalId?: string
  onClose(): void
}) {
  const { state, change, saving } = useWorkspace()
  const [title, setTitle] = useState(resource?.title ?? '')
  const [type, setType] = useState<Resource['type']>(resource?.type ?? 'course')
  const [url, setUrl] = useState(resource?.url ?? '')
  const [progress, setProgress] = useState(String(resource?.progress ?? 0))
  const [total, setTotal] = useState(resource?.total_units?.toString() ?? '')
  const [unit, setUnit] = useState(resource?.unit_label ?? 'units')
  const [goal, setGoal] = useState(resource?.goal_id ?? goalId ?? '')
  const [project, setProject] = useState(resource?.project_id ?? '')
  const [target, setTarget] = useState(resource?.target_date ?? '')
  const [notes, setNotes] = useState(resource?.notes ?? '')
  const [error, setError] = useState('')
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    if (total && Number(progress) > Number(total)) {
      setError('Progress can’t exceed the total units.')
      return
    }
    if (
      await change((s) => {
        const fields = {
          title: title.trim(),
          type,
          url,
          progress: Number(progress),
          total_units: total ? Number(total) : null,
          unit_label: unit,
          goal_id: goal || null,
          project_id: project || null,
          target_date: target || null,
          notes,
          updated_at: new Date().toISOString(),
        }
        if (resource)
          Object.assign(
            s.resources.find((r) => r.id === resource.id)!,
            fields,
          )
        else s.resources.push({ ...baseRecord(), ...fields, source_inbox_id: null })
        logEvent(
          s,
          null,
          null,
          'resource',
          `${title}: ${progress}${total ? ` of ${total}` : ''} ${unit}`,
        )
      }, 'Resource saved')
    )
      onClose()
  }
  return (
    <Modal
      title={resource ? 'Resource and progress' : 'Use a resource you chose'}
      subtitle="Progress helps you plan. It doesn’t have to become another obligation."
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <Field label="Resource title">
          <input
            autoFocus
            required
            maxLength={500}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        <div className="form-row">
          <Field label="Type">
            <select value={type} onChange={(e) => setType(e.target.value as Resource['type'])}>
              {['course', 'book', 'documentation', 'video', 'other'].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="URL · optional">
            <input
              type="url"
              pattern="https?://.*"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
            />
          </Field>
        </div>
        <div className="form-row">
          <Field label="Completed units">
            <input
              required
              type="number"
              min={0}
              step={1}
              value={progress}
              onChange={(e) => setProgress(e.target.value)}
            />
          </Field>
          <Field label="Total units · optional">
            <input
              type="number"
              min={1}
              step={1}
              value={total}
              onChange={(e) => setTotal(e.target.value)}
            />
          </Field>
        </div>
        <div className="form-row">
          <Field label="Units called">
            <input
              maxLength={80}
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="Videos, pages, chapters…"
            />
          </Field>
          <Field label="Target · optional">
            <input type="date" value={target} onChange={(e) => setTarget(e.target.value)} />
          </Field>
        </div>
        <div className="form-row">
          <Field label="Connected goal">
            <select
              value={goal}
              onChange={(e) => {
                setGoal(e.target.value)
                setProject('')
              }}
            >
              <option value="">Independent resource</option>
              {state.goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Connected project">
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
        </div>
        <Field label="Notes">
          <textarea maxLength={20000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button className="button" disabled={saving}>
            Save resource
          </button>
        </div>
      </form>
    </Modal>
  )
}
export function PhaseDialog({
  goal,
  phase,
  onClose,
}: {
  goal: Goal
  phase?: Phase
  onClose(): void
}) {
  const { change, saving } = useWorkspace()
  const [title, setTitle] = useState(phase?.title ?? '')
  return (
    <Modal title={phase ? 'Edit a stage' : 'Give this part a name'} onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          if (!title.trim()) return
          if (
            await change((s) => {
              if (phase) s.phases.find((p) => p.id === phase.id)!.title = title.trim()
              else
                s.phases.push({
                  ...baseRecord(),
                  goal_id: goal.id,
                  title: title.trim(),
                  position:
                    Math.max(
                      -1,
                      ...s.phases.filter((p) => p.goal_id === goal.id).map((p) => p.position),
                    ) + 1,
                  completed: false,
                })
            }, 'Stage saved')
          )
            onClose()
        }}
      >
        <Field label="Stage name">
          <input
            autoFocus
            required
            maxLength={500}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="A broad stage, or a section from your resource"
          />
        </Field>
        <div className="form-actions">
          {phase && (
            <button
              type="button"
              className="button subtle"
              disabled={saving}
              onClick={async () => {
                if (
                  await change((s) => {
                    s.phases = s.phases.filter((p) => p.id !== phase.id)
                  }, 'Stage removed')
                )
                  onClose()
              }}
            >
              Remove stage
            </button>
          )}
          <button className="button" disabled={saving}>
            Save stage
          </button>
        </div>
      </form>
    </Modal>
  )
}
export function StructureDialog({ goal, onClose }: { goal: Goal; onClose(): void }) {
  const { state, change, saving } = useWorkspace()
  const [result, setResult] = useState<AIResult | null>(null)
  const [titles, setTitles] = useState<string[]>([])
  const resources = state.resources.filter((r) => r.goal_id === goal.id)
  return (
    <Modal
      title="A broad, editable structure"
      subtitle="Your chosen resources come first. Every suggested stage is optional."
      onClose={onClose}
    >
      <AIAssist
        purpose="phases"
        text={`Goal: ${goal.title}\nWhy: ${goal.why}\nResources: ${resources.map((r) => `${r.title} (${r.type})`).join(', ') || 'None chosen'}\nExisting stages: ${state.phases
          .filter((p) => p.goal_id === goal.id)
          .map((p) => p.title)
          .join(', ')}`}
        onResult={(r) => {
          setResult(r)
          setTitles(r.suggestions.filter((x) => x.kind === 'phase').map((x) => x.title))
        }}
      />
      {result && (
        <>
          <p className="muted small mb-4">{result.summary}</p>
          {titles.map((title, index) => (
            <Field key={index} label={`Stage ${index + 1}`}>
              <div className="flex gap-2">
                <input
                  value={title}
                  maxLength={500}
                  onChange={(e) =>
                    setTitles(titles.map((t, i) => (i === index ? e.target.value : t)))
                  }
                />
                <button
                  className="button small subtle"
                  onClick={() => setTitles(titles.filter((_, i) => i !== index))}
                >
                  Reject
                </button>
              </div>
            </Field>
          ))}
          <button
            className="button"
            disabled={saving || !titles.some((t) => t.trim())}
            onClick={async () => {
              if (
                await change((s) => {
                  const position =
                    Math.max(
                      -1,
                      ...s.phases.filter((p) => p.goal_id === goal.id).map((p) => p.position),
                    ) + 1
                  titles
                    .filter((t) => t.trim())
                    .forEach((title, i) =>
                      s.phases.push({
                        ...baseRecord(),
                        goal_id: goal.id,
                        title: title.trim(),
                        position: position + i,
                        completed: false,
                      }),
                    )
                }, 'Chosen stages added')
              )
                onClose()
            }}
          >
            Add only these stages
          </button>
        </>
      )}
      <button className="text-link block mt-4" onClick={onClose}>
        I’ll organize it myself
      </button>
    </Modal>
  )
}
