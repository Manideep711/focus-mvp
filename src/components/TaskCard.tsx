import {
  Check,
  Play,
  Clock3,
  Flag,
  MoreHorizontal,
  ArrowUp,
  ArrowDown,
  PencilLine,
} from 'lucide-react'
import type { Commitment, Task } from '../domain/types'
import { useWorkspace } from '../state/WorkspaceContext'
import { completeTask, ensurePlan } from '../domain/workspace'
import { minutesLabel } from '../domain/dates'
import { SpotlightCard } from './aceternity/spotlight-card'
import { Button } from './primitives/button'
import { Tooltip } from './primitives/tooltip'
export function TaskCard({
  task,
  commitment,
  onFocus,
  onEdit,
  onRecord,
  onReplan,
  onMove,
}: {
  task: Task
  commitment?: Commitment
  onFocus(task: Task): void
  onEdit(task: Task): void
  onRecord(task: Task): void
  onReplan(c: Commitment): void
  onMove?(direction: -1 | 1): void
}) {
  const { state, today, change, saving } = useWorkspace()
  const goal = state.goals.find((g) => g.id === task.goal_id)
  const plan = state.plans.find((p) => p.date === today)
  const anchor = plan?.anchor_task_id === task.id
  const done = commitment?.status === 'completed' || task.status === 'done'
  const estimate = commitment ? commitment.planned_minutes : task.estimate_minutes
  return (
    <SpotlightCard className={`task-card ${anchor ? 'anchor' : ''} ${done ? 'done' : ''}`}>
      <div className="task-main">
        <button
          className="task-check"
          disabled={saving || done}
          aria-label={`Complete ${task.title}`}
          onClick={() => void change((s) => completeTask(s, task.id), 'Action completed')}
        >
          {done && <Check size={13} />}
        </button>
        <div className="task-content">
          <h3 className="task-title">{task.title}</h3>
          <div className="task-meta">
            {goal && <span>{goal.title}</span>}
            {goal && <span>·</span>}
            <Clock3 size={12} />
            <span>{estimate ? minutesLabel(estimate) : 'No estimate'}</span>
            {commitment?.scheduled_time && <span>· {commitment.scheduled_time}</span>}
            {anchor && (
              <span className="tag">
                <Flag size={10} /> One thing
              </span>
            )}
            {task.is_emergency && <span className="tag warm">Unexpected</span>}
            {task.status === 'waiting' && <span className="tag warm">Waiting on</span>}
          </div>
          {task.resume_note && !done && (
            <p className="resume-note">Pick up here: {task.resume_note}</p>
          )}
          {task.status === 'waiting' && task.blocker && (
            <p className="task-description">
              {task.blocker}
              {task.follow_up_date ? ` · Check in ${task.follow_up_date}` : ''}
            </p>
          )}
        </div>
        <Tooltip label="Edit this action">
          <button
            className="icon-button task-edit"
            aria-label={`Edit ${task.title}`}
            onClick={() => onEdit(task)}
          >
            <PencilLine size={15} />
          </button>
        </Tooltip>
      </div>
      {!done && (
        <div className="task-controls">
          {task.status !== 'waiting' && task.status !== 'archived' && (
            <Button variant="outline" size="sm" onClick={() => onFocus(task)}>
              <Play size={12} fill="currentColor" /> Focus
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => onRecord(task)}>
            Log progress
          </Button>
          <span className="spacer" />
          {commitment && (
            <>
              <button
                className="icon-button"
                disabled={saving}
                title={anchor ? 'Remove daily priority' : 'Make this my one thing'}
                aria-label={anchor ? 'Remove daily priority' : `Prioritize ${task.title}`}
                onClick={() =>
                  void change(
                    (s) => {
                      ensurePlan(s, today).anchor_task_id = anchor ? null : task.id
                    },
                    anchor ? 'Priority cleared' : 'Your one thing is set',
                  )
                }
              >
                <Flag size={14} fill={anchor ? 'currentColor' : 'none'} />
              </button>
              {onMove && (
                <>
                  <button
                    className="icon-button"
                    disabled={saving}
                    aria-label={`Move ${task.title} up`}
                    onClick={() => onMove(-1)}
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    className="icon-button"
                    disabled={saving}
                    aria-label={`Move ${task.title} down`}
                    onClick={() => onMove(1)}
                  >
                    <ArrowDown size={14} />
                  </button>
                </>
              )}
              <button
                className="icon-button"
                aria-label={`Replan ${task.title}`}
                onClick={() => onReplan(commitment)}
              >
                <MoreHorizontal size={18} />
              </button>
            </>
          )}
        </div>
      )}
    </SpotlightCard>
  )
}
