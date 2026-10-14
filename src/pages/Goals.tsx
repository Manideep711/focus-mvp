import { useState } from 'react'
import {
  Plus,
  ArrowLeft,
  ArrowUpRight,
  Target,
  BookOpen,
  Folder,
  Check,
  ArrowUp,
  ArrowDown,
  PencilLine,
} from 'lucide-react'
import { PageHeading, SectionHeading, Empty, TextLink } from '../components/ui'
import { TaskCard } from '../components/TaskCard'
import { TaskDialog } from '../components/TaskDialog'
import { useWorkspace } from '../state/WorkspaceContext'
import { logEvent, commitTask } from '../domain/workspace'
import type { Goal, GoalStatus, Project, Resource, Phase } from '../domain/types'
import type { TaskHandlers } from './Today'

import {
  statuses,
  GoalDialog,
  ProjectDialog,
  ResourceDialog,
  PhaseDialog,
  StructureDialog,
} from '../components/GoalDialogs'
export function Goals({ handlers }: { handlers: TaskHandlers }) {
  const { state, today, change, saving } = useWorkspace()
  const [view, setView] = useState<'goals' | 'projects' | 'resources'>('goals')
  const [filter, setFilter] = useState<GoalStatus | 'all'>('all')
  const [selected, setSelected] = useState<string | null>(null)
  const [goalModal, setGoalModal] = useState<Goal | 'new' | null>(null)
  const [projectModal, setProjectModal] = useState<Project | 'new' | null>(null)
  const [resourceModal, setResourceModal] = useState<Resource | 'new' | null>(null)
  const [taskModal, setTaskModal] = useState(false)
  const [phaseModal, setPhaseModal] = useState<Phase | 'new' | null>(null)
  const [structure, setStructure] = useState(false)
  const goal = state.goals.find((g) => g.id === selected)
  const activeCount = state.goals.filter((g) => g.status === 'active').length
  const phaseRows = goal
    ? state.phases.filter((p) => p.goal_id === goal.id).sort((a, b) => a.position - b.position)
    : []
  const resources = state.resources.filter((r) => !goal || r.goal_id === goal.id)
  const projects = state.projects.filter((p) => !goal || p.goal_id === goal.id)
  const resourceCard = (r: Resource) => (
    <article className="resource-card" key={r.id}>
      <div className="flex justify-between gap-3 items-start">
        <div>
          <h3>{r.title}</h3>
          <p className="small muted mt-1">
            {r.type}
            {r.target_date ? ` · Intention: ${r.target_date}` : ''}
          </p>
        </div>
        <button
          className="icon-button"
          aria-label={`Edit resource ${r.title}`}
          onClick={() => setResourceModal(r)}
        >
          <PencilLine size={14} />
        </button>
      </div>
      {r.url && (
        <a
          href={r.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 mt-2"
        >
          Open resource <ArrowUpRight size={12} />
        </a>
      )}
      <div className="resource-progress">
        <span className="small muted">
          {r.progress}
          {r.total_units ? ` of ${r.total_units}` : ''} {r.unit_label}
        </span>
        <button className="text-link" onClick={() => setResourceModal(r)}>
          Update progress
        </button>
      </div>
      {r.total_units && (
        <div className="capacity-bar !my-2">
          <span style={{ width: `${(r.progress / r.total_units) * 100}%` }} />
        </div>
      )}
      {r.notes && <p className="small muted mt-3 whitespace-pre-wrap">{r.notes}</p>}
    </article>
  )
  const projectCard = (p: Project) => (
    <article className="resource-card" key={p.id}>
      <div className="flex items-center justify-between">
        <h3>{p.title}</h3>
        <button
          className="icon-button"
          aria-label={`Edit project ${p.title}`}
          onClick={() => setProjectModal(p)}
        >
          <PencilLine size={14} />
        </button>
      </div>
      <p className="small muted mt-2">
        {p.status} ·{' '}
        {state.tasks.filter((t) => t.project_id === p.id && t.status !== 'archived').length}{' '}
        connected actions
      </p>
      {p.notes && <p className="small muted mt-2 whitespace-pre-wrap">{p.notes}</p>}
    </article>
  )
  return (
    <>
      {goal ? (
        <>
          <button className="back-button" onClick={() => setSelected(null)}>
            <ArrowLeft size={14} /> All goals
          </button>
          <PageHeading
            eyebrow={`${goal.status} goal`}
            title={goal.title}
            description={
              goal.why || 'An outcome you care about. Give it attention at your own pace.'
            }
          >
            <button className="button secondary" onClick={() => setGoalModal(goal)}>
              Edit goal
            </button>
          </PageHeading>
          {goal.status === 'paused' && (
            <div className="notice-panel">
              This goal is taking a little space.
              {goal.resume_date
                ? ` Reconsider it around ${goal.resume_date}.`
                : ' Return whenever you’re ready.'}
              <button
                className="text-link ml-3"
                disabled={saving}
                onClick={() =>
                  void change((s) => {
                    s.goals.find((g) => g.id === goal.id)!.status = 'active'
                    logEvent(s, null, null, 'goal', `Reactivated ${goal.title}`)
                  }, 'Goal reactivated')
                }
              >
                Give it attention again
              </button>
            </div>
          )}
          <div className="goal-detail">
            <div>
              <SectionHeading title="Concrete next actions">
                <TextLink onClick={() => setTaskModal(true)}>
                  <Plus size={13} /> Add action
                </TextLink>
              </SectionHeading>
              <div className="task-list">
                {state.tasks.filter((t) => t.goal_id === goal.id && t.status !== 'archived')
                  .length ? (
                  state.tasks
                    .filter((t) => t.goal_id === goal.id && t.status !== 'archived')
                    .map((t) => (
                      <div key={t.id}>
                        <TaskCard task={t} {...handlers} />
                        {t.status === 'active' && (
                          <button
                            className="text-link ml-2"
                            disabled={saving}
                            onClick={() =>
                              void change((s) => commitTask(s, t.id, today), 'Chosen for Today')
                            }
                          >
                            Choose for Today
                          </button>
                        )}
                      </div>
                    ))
                ) : (
                  <Empty
                    title="What would move this forward?"
                    body="One useful next action is enough. There’s no need to plan the entire journey."
                  >
                    <button className="button small" onClick={() => setTaskModal(true)}>
                      Define a next action
                    </button>
                  </Empty>
                )}
              </div>
              <div className="section-space">
                <SectionHeading title="A little structure" meta="Optional">
                  <TextLink onClick={() => setPhaseModal('new')}>
                    <Plus size={13} /> Add a stage
                  </TextLink>
                </SectionHeading>
                {phaseRows.length ? (
                  phaseRows.map((phase, i) => (
                    <div className="phase-row" key={phase.id}>
                      <button
                        className="task-check"
                        aria-label={`${phase.completed ? 'Reopen' : 'Complete'} stage ${phase.title}`}
                        disabled={saving}
                        onClick={() =>
                          void change((s) => {
                            s.phases.find((p) => p.id === phase.id)!.completed = !phase.completed
                          }, 'Stage updated')
                        }
                      >
                        {phase.completed && <Check size={12} />}
                      </button>
                      <span className={`flex-1 ${phase.completed ? 'line-through muted' : ''}`}>
                        {phase.title}
                      </span>
                      <button
                        className="icon-button"
                        disabled={saving || i === 0}
                        aria-label={`Move stage ${phase.title} up`}
                        onClick={() =>
                          void change((s) => {
                            const a = s.phases.find((p) => p.id === phase.id)!
                            const b = s.phases.find((p) => p.id === phaseRows[i - 1].id)!
                            ;[a.position, b.position] = [b.position, a.position]
                          }, 'Stage order updated')
                        }
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        className="icon-button"
                        disabled={saving || i === phaseRows.length - 1}
                        aria-label={`Move stage ${phase.title} down`}
                        onClick={() =>
                          void change((s) => {
                            const a = s.phases.find((p) => p.id === phase.id)!
                            const b = s.phases.find((p) => p.id === phaseRows[i + 1].id)!
                            ;[a.position, b.position] = [b.position, a.position]
                          }, 'Stage order updated')
                        }
                      >
                        <ArrowDown size={13} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Edit stage ${phase.title}`}
                        onClick={() => setPhaseModal(phase)}
                      >
                        <PencilLine size={13} />
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="muted small">
                    Organize it yourself, use the stages in your resource, or request a broad
                    suggestion.
                  </p>
                )}
                <button className="text-link mt-3" onClick={() => setStructure(true)}>
                  Let AI suggest a structure
                </button>
              </div>
              <div className="section-space">
                <SectionHeading title="Projects">
                  <TextLink onClick={() => setProjectModal('new')}>
                    <Plus size={13} /> Add project
                  </TextLink>
                </SectionHeading>
                {projects.length ? (
                  projects.map(projectCard)
                ) : (
                  <p className="muted small">
                    A project can help when this outcome involves a larger piece of work.
                  </p>
                )}
              </div>
              {goal.notes && (
                <div className="section-space">
                  <SectionHeading title="Notes" />
                  <p className="muted whitespace-pre-wrap text-sm">{goal.notes}</p>
                </div>
              )}
              <div className="section-space">
                <SectionHeading title="History" />
                {state.events
                  .filter(
                    (e) =>
                      e.note.includes(goal.title) ||
                      (e.task_id &&
                        state.tasks.some((t) => t.id === e.task_id && t.goal_id === goal.id)),
                  )
                  .slice(-6)
                  .reverse()
                  .map((e) => (
                    <p className="muted small py-2 border-b border-[#333831]" key={e.id}>
                      {e.note}{' '}
                      <span className="block text-[10px] mt-1">
                        {new Date(e.created_at).toLocaleDateString()}
                      </span>
                    </p>
                  ))}
              </div>
            </div>
            <aside>
              <div className="side-panel">
                <h3 className="flex gap-2 items-center">
                  <Target size={15} /> Why it matters
                </h3>
                <p>
                  {goal.why ||
                    'Add a reason when it’s useful. It can help you decide what deserves attention.'}
                </p>
                {goal.target_date && <p className="mt-3">Target: {goal.target_date}</p>}
                <div className="divider !my-4" />
                <p>Completing a resource doesn’t automatically complete this goal.</p>
              </div>
              <SectionHeading title="Chosen resources">
                <button
                  className="icon-button"
                  aria-label="Add resource"
                  onClick={() => setResourceModal('new')}
                >
                  <Plus size={15} />
                </button>
              </SectionHeading>
              {resources.length ? (
                resources.map(resourceCard)
              ) : (
                <div className="side-panel">
                  <p>A course, a book, documentation, or a method you chose.</p>
                  <TextLink onClick={() => setResourceModal('new')}>Connect a resource</TextLink>
                </div>
              )}
            </aside>
          </div>
        </>
      ) : (
        <>
          <PageHeading
            eyebrow="What you care about over time"
            title="Give the important things space."
            description="Active means you’re choosing to give it attention. Everything else can wait."
          >
            <button
              className="button secondary"
              onClick={() =>
                view === 'goals'
                  ? setGoalModal('new')
                  : view === 'projects'
                    ? setProjectModal('new')
                    : setResourceModal('new')
              }
            >
              <Plus size={15} />
              {view === 'goals' ? 'New goal' : view === 'projects' ? 'New project' : 'New resource'}
            </button>
          </PageHeading>
          <div className="filter-row">
            {(['goals', 'projects', 'resources'] as const).map((v) => (
              <button
                key={v}
                className={`choice-chip ${view === v ? 'selected' : ''}`}
                onClick={() => setView(v)}
              >
                {v[0].toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          {view === 'goals' ? (
            <>
              {activeCount > 3 && (
                <div className="warning">
                  You’re giving attention to {activeCount} goals. If that feels crowded, some can
                  stay important while taking a pause.
                </div>
              )}
              <div className="filter-row">
                <button
                  className={`choice-chip ${filter === 'all' ? 'selected' : ''}`}
                  onClick={() => setFilter('all')}
                >
                  All current
                </button>
                {statuses.map((v) => (
                  <button
                    key={v}
                    className={`choice-chip ${filter === v ? 'selected' : ''}`}
                    onClick={() => setFilter(v)}
                  >
                    {v[0].toUpperCase() + v.slice(1)}
                  </button>
                ))}
              </div>
              <div className="cards-grid">
                {state.goals
                  .filter((g) => (filter === 'all' ? g.status !== 'archived' : g.status === filter))
                  .map((g) => (
                    <article key={g.id} className="goal-card">
                      <div className="flex items-center justify-between">
                        <span className={`tag ${g.status === 'paused' ? 'warm' : ''}`}>
                          {g.status}
                        </span>
                        <Target size={16} className="muted" />
                      </div>
                      <h3>{g.title}</h3>
                      <p>{g.why || 'A little room for something that matters.'}</p>
                      <div className="goal-card-footer">
                        <span className="small muted">
                          {
                            state.tasks.filter((t) => t.goal_id === g.id && t.status === 'active')
                              .length
                          }{' '}
                          next actions
                        </span>
                        <button className="text-link" onClick={() => setSelected(g.id)}>
                          Open goal <ArrowUpRight size={14} />
                        </button>
                      </div>
                    </article>
                  ))}
              </div>
              {!state.goals.some((g) =>
                filter === 'all' ? g.status !== 'archived' : g.status === filter,
              ) && (
                <Empty
                  title="What do you want to move toward?"
                  body="An outcome, a change, something you want to learn. Start with a title; the structure can follow."
                >
                  <button className="button small" onClick={() => setGoalModal('new')}>
                    <Plus size={14} /> Create a goal
                  </button>
                </Empty>
              )}
            </>
          ) : view === 'projects' ? (
            <>
              {projects.map(projectCard)}
              {!projects.length && (
                <Empty
                  title="A home for larger pieces of work"
                  body="Projects can contribute to a goal or stand on their own."
                >
                  <button className="button small" onClick={() => setProjectModal('new')}>
                    <Folder size={14} /> Add a project
                  </button>
                </Empty>
              )}
            </>
          ) : (
            <>
              {resources.map(resourceCard)}
              {!resources.length && (
                <Empty
                  title="Use what you’ve already chosen"
                  body="Connect a course, book, documentation, or another resource. Progress is context for planning."
                >
                  <button className="button small" onClick={() => setResourceModal('new')}>
                    <BookOpen size={14} /> Add a resource
                  </button>
                </Empty>
              )}
            </>
          )}
        </>
      )}
      {goalModal && (
        <GoalDialog
          goal={goalModal === 'new' ? undefined : goalModal}
          onClose={() => setGoalModal(null)}
        />
      )}
      {projectModal && (
        <ProjectDialog
          project={projectModal === 'new' ? undefined : projectModal}
          goalId={goal?.id}
          onClose={() => setProjectModal(null)}
        />
      )}
      {resourceModal && (
        <ResourceDialog
          resource={resourceModal === 'new' ? undefined : resourceModal}
          goalId={goal?.id}
          onClose={() => setResourceModal(null)}
        />
      )}
      {taskModal && <TaskDialog goalId={goal?.id} onClose={() => setTaskModal(false)} />}
      {phaseModal && goal && (
        <PhaseDialog
          goal={goal}
          phase={phaseModal === 'new' ? undefined : phaseModal}
          onClose={() => setPhaseModal(null)}
        />
      )}
      {structure && goal && <StructureDialog goal={goal} onClose={() => setStructure(false)} />}
    </>
  )
}
