import type { Workspace, Task, DailyPlan, Commitment, Energy, Outcome } from './types'
import { baseRecord, nextDate, localDate } from './dates'

export function emptyWorkspace(): Workspace {
  return {
    schema_version: 1,
    revision: 0,
    preferences: {
      name: '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      weekly_note: '',
    },
    tasks: [],
    goals: [],
    projects: [],
    resources: [],
    phases: [],
    inbox: [],
    plans: [],
    commitments: [],
    sessions: [],
    reviews: [],
    events: [],
  }
}
export function newTask(title: string, fields: Partial<Task> = {}): Task {
  return {
    ...baseRecord(),
    title: title.trim(),
    description: '',
    status: 'active',
    estimate_minutes: null,
    energy: 'steady',
    goal_id: null,
    project_id: null,
    resource_id: null,
    source_inbox_id: null,
    is_emergency: false,
    due_at: null,
    resume_note: '',
    blocker: '',
    follow_up_date: null,
    completed_at: null,
    ...fields,
  }
}
export function ensurePlan(s: Workspace, date: string): DailyPlan {
  let plan = s.plans.find((p) => p.date === date)
  if (!plan) {
    plan = { ...baseRecord(), date, available_minutes: 180, energy: 'steady', anchor_task_id: null }
    s.plans.push(plan)
  }
  return plan
}
export function logEvent(
  s: Workspace,
  taskId: string | null,
  planId: string | null,
  kind: string,
  note: string,
) {
  s.events.push({ ...baseRecord(), task_id: taskId, plan_id: planId, kind, note })
}
export function commitTask(
  s: Workspace,
  taskId: string,
  date: string,
  plannedMinutes?: number | null,
) {
  const task = s.tasks.find((t) => t.id === taskId)
  if (!task || task.status === 'done' || task.status === 'archived' || task.status === 'waiting')
    return
  const plan = ensurePlan(s, date)
  if (
    s.commitments.some(
      (c) =>
        c.plan_id === plan.id &&
        c.task_id === taskId &&
        c.status !== 'removed' &&
        c.status !== 'moved',
    )
  )
    return
  task.status = 'active'
  task.updated_at = new Date().toISOString()
  const existing = s.commitments.find((c) => c.plan_id === plan.id && c.task_id === taskId)
  const position =
    Math.max(-1, ...s.commitments.filter((c) => c.plan_id === plan.id).map((c) => c.position)) + 1
  if (existing)
    Object.assign(existing, {
      status: 'planned',
      position,
      updated_at: new Date().toISOString(),
      planned_minutes: plannedMinutes ?? task.estimate_minutes,
      reason: '',
    })
  else
    s.commitments.push({
      ...baseRecord(),
      task_id: taskId,
      plan_id: plan.id,
      position,
      planned_minutes: plannedMinutes ?? task.estimate_minutes,
      scheduled_time: null,
      status: 'planned',
      reason: '',
    })
  logEvent(s, taskId, plan.id, 'committed', `Chose ${task.title} for ${date}`)
}
export function completeTask(s: Workspace, taskId: string) {
  const task = s.tasks.find((t) => t.id === taskId)
  if (!task) return
  task.status = 'done'
  task.completed_at = new Date().toISOString()
  task.updated_at = task.completed_at
  // Historical plans remain as they were. Only current-day commitments are completed.
  const today = localDate(new Date(), s.preferences.timezone)
  const plan = s.plans.find((p) => p.date === today)
  s.commitments
    .filter((c) => c.task_id === taskId && c.plan_id === plan?.id && c.status === 'planned')
    .forEach((c) => {
      c.status = 'completed'
      c.updated_at = task.completed_at!
    })
  logEvent(s, taskId, plan?.id ?? null, 'completed', `Completed ${task.title}`)
}
export function replan(
  s: Workspace,
  c: Commitment,
  action: 'today' | 'tomorrow' | 'later' | 'inbox' | 'archive' | 'remove',
  reason: string,
) {
  const task = s.tasks.find((t) => t.id === c.task_id)
  const plan = s.plans.find((p) => p.id === c.plan_id)
  if (!task || !plan) return
  c.status = action === 'remove' ? 'removed' : 'moved'
  c.reason = reason
  c.updated_at = new Date().toISOString()
  if (plan.anchor_task_id === task.id) plan.anchor_task_id = null
  if (action === 'tomorrow') commitTask(s, task.id, nextDate(plan.date), c.planned_minutes)
  if (action === 'today')
    commitTask(s, task.id, localDate(new Date(), s.preferences.timezone), c.planned_minutes)
  if (action === 'later') task.status = 'later'
  if (action === 'archive') task.status = 'archived'
  if (action === 'inbox') {
    s.inbox.push({
      ...baseRecord(),
      text: `${task.title}${task.resume_note ? `\nPick up here: ${task.resume_note}` : ''}`,
      status: 'unprocessed',
      kind: 'thought',
      interpretation: '',
    })
    task.status = 'later'
  }
  task.updated_at = new Date().toISOString()
  logEvent(s, task.id, plan.id, 'replanned', `${task.title} → ${action}. ${reason}`)
}
export function recordWork(
  s: Workspace,
  taskId: string,
  outcome: Outcome,
  seconds: number,
  notes: string,
  resumeNote: string,
  startedAt: string,
  plannedMinutes: number | null,
  mode: 'timer' | 'manual',
) {
  const task = s.tasks.find((t) => t.id === taskId)
  if (!task) throw new Error('This task no longer exists.')
  s.sessions.push({
    ...baseRecord(),
    task_id: taskId,
    outcome,
    duration_seconds: Math.max(0, Math.round(seconds)),
    notes,
    resume_note: resumeNote,
    started_at: startedAt,
    ended_at: new Date().toISOString(),
    planned_minutes: plannedMinutes,
    mode,
  })
  task.resume_note = resumeNote
  task.updated_at = new Date().toISOString()
  if (outcome === 'completed') completeTask(s, taskId)
}
export function planSummary(s: Workspace, date: string) {
  const plan = s.plans.find((p) => p.date === date)
  const commitments = s.commitments
    .filter((c) => c.plan_id === plan?.id && (c.status === 'planned' || c.status === 'completed'))
    .sort((a, b) => a.position - b.position)
  const pending = commitments.filter(
    (c) =>
      c.status === 'planned' &&
      s.tasks.some((t) => t.id === c.task_id && t.status !== 'done' && t.status !== 'archived'),
  )
  const spent = s.sessions
    .filter((x) => localDate(new Date(x.started_at), s.preferences.timezone) === date)
    .reduce((sum, x) => sum + x.duration_seconds / 60, 0)
  const remainingCapacity = Math.max(0, (plan?.available_minutes ?? 180) - spent)
  // Progress reduces an estimate once. Completed commitments do not count as remaining work.
  const remainingFor = (c: Commitment) =>
    Math.max(
      0,
      (c.planned_minutes ?? 0) -
        s.sessions
          .filter(
            (x) =>
              x.task_id === c.task_id &&
              localDate(new Date(x.started_at), s.preferences.timezone) === date,
          )
          .reduce((sum, x) => sum + x.duration_seconds / 60, 0),
    )
  const remainingWork = pending.reduce((sum, c) => sum + remainingFor(c), 0)
  return {
    plan,
    commitments,
    pending,
    spent,
    remainingCapacity,
    remainingWork,
    remainingFor,
    unknownEstimates: pending.filter((c) => c.planned_minutes === null).length,
    overCapacity: remainingWork > remainingCapacity,
  }
}
export type SuggestionMode = 'plan' | 'quick' | 'study' | 'low' | 'surprise'
export interface SuggestionContext {
  availableMinutes?: number
  energy?: Energy
  variation?: number
}
export function suggestTasks(
  s: Workspace,
  date: string,
  mode: SuggestionMode,
  now = new Date(),
  context: SuggestionContext = {},
) {
  const summary = planSummary(s, date)
  const available = Math.max(
    0,
    Math.min(summary.remainingCapacity, context.availableMinutes ?? summary.remainingCapacity),
  )
  const energy = context.energy ?? summary.plan?.energy ?? 'steady'
  const committedIds = new Set(summary.pending.map((c) => c.task_id))
  const remaining = (t: Task) => {
    const commitment = summary.pending.find((c) => c.task_id === t.id)
    return commitment
      ? commitment.planned_minutes === null
        ? null
        : Math.ceil(summary.remainingFor(commitment))
      : t.estimate_minutes
  }
  const activeGoals = new Set(s.goals.filter((g) => g.status === 'active').map((g) => g.id))
  const activeProjects = new Set(
    s.projects
      .filter((p) => p.status === 'active' && (!p.goal_id || activeGoals.has(p.goal_id)))
      .map((p) => p.id),
  )
  const candidates = s.tasks.filter(
    (t) =>
      t.status === 'active' &&
      !t.blocker.trim() &&
      (!t.goal_id || activeGoals.has(t.goal_id)) &&
      (!t.project_id || activeProjects.has(t.project_id)),
  )
  const eligible = candidates.filter((t) =>
    mode === 'plan'
      ? committedIds.has(t.id)
      : mode === 'quick'
        ? remaining(t) !== null && remaining(t)! > 0 && remaining(t)! <= 20
        : mode === 'low'
          ? t.energy === 'low'
          : mode === 'study'
            ? !!t.resource_id
            : true,
  )
  const score = (t: Task) =>
    (t.id === summary.plan?.anchor_task_id ? 100 : 0) +
    (t.is_emergency ? 90 : 0) +
    (t.due_at && new Date(t.due_at).getTime() < now.getTime() + 86400000 ? 70 : 0) +
    (committedIds.has(t.id) ? 30 : 0) +
    (t.energy === energy ? 10 : 0) +
    (remaining(t) !== null && remaining(t)! > 0 && remaining(t)! <= available ? 15 : 0)
  const ranked = eligible.sort(
    (a, b) =>
      score(b) - score(a) ||
      (summary.pending.find((c) => c.task_id === a.id)?.position ?? Infinity) -
        (summary.pending.find((c) => c.task_id === b.id)?.position ?? Infinity) ||
      a.created_at.localeCompare(b.created_at) ||
      a.id.localeCompare(b.id),
  )
  const offset =
    mode === 'surprise' && ranked.length
      ? Math.abs(Math.floor(context.variation ?? 0)) % ranked.length
      : 0
  return [...ranked.slice(offset), ...ranked.slice(0, offset)]
    .slice(0, mode === 'surprise' ? 1 : 3)
    .map((task) => {
      const reason =
        task.id === summary.plan?.anchor_task_id
          ? 'The one thing you chose to move forward today.'
          : task.is_emergency
            ? 'An interruption you chose to make room for.'
            : task.due_at && new Date(task.due_at).getTime() < now.getTime() + 86400000
              ? 'Its deadline is approaching.'
              : mode === 'quick'
                ? 'Your remaining portion is 20 minutes or less.'
                : mode === 'low'
                  ? 'You marked this as a lighter action.'
                  : mode === 'study'
                    ? 'Connected to a resource you chose.'
                    : committedIds.has(task.id)
                      ? 'Already part of your plan for today.'
                      : 'An available action you can choose to make room for.'
      return {
        task,
        reason,
        remainingMinutes: remaining(task),
        committed: committedIds.has(task.id),
        energyMatches: task.energy === energy,
        fits:
          remaining(task) === null || remaining(task) === 0 ? null : remaining(task)! <= available,
      }
    })
}
export function dayDefaults(): { available_minutes: number; energy: Energy } {
  return { available_minutes: 180, energy: 'steady' }
}
