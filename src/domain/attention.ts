import type { Workspace } from './types'
import { planSummary } from './workspace'

// Small, finite batches; choosing Later never changes a task or assigns a date.
export function planningDeck(s: Workspace, date: string) {
  const plan = planSummary(s, date)
  const chosen = new Set(
    plan.commitments
      .filter((c) => c.status === 'planned' || c.status === 'completed')
      .map((c) => c.task_id),
  )
  const goals = new Set(s.goals.filter((g) => g.status === 'active').map((g) => g.id))
  const projects = new Set(
    s.projects
      .filter((p) => p.status === 'active' && (!p.goal_id || goals.has(p.goal_id)))
      .map((p) => p.id),
  )
  return s.tasks
    .filter(
      (t) =>
        (t.status === 'active' || t.status === 'later') &&
        !t.blocker.trim() &&
        !t.is_emergency &&
        !chosen.has(t.id) &&
        (!t.goal_id || goals.has(t.goal_id)) &&
        (!t.project_id || projects.has(t.project_id)),
    )
    .sort(
      (a, b) =>
        (a.due_at ? new Date(a.due_at).getTime() : Infinity) -
          (b.due_at ? new Date(b.due_at).getTime() : Infinity) ||
        Number(!!b.resume_note) - Number(!!a.resume_note) ||
        a.created_at.localeCompare(b.created_at) ||
        a.id.localeCompare(b.id),
    )
    .slice(0, 5)
}
