import { useState } from 'react'
import { Check, Clock3, Sprout, ArrowRight, BookOpen, CalendarDays } from 'lucide-react'
import { PageHeading, SectionHeading, Empty, Modal, Field, TextLink } from '../components/ui'
import { ReplanDialog } from '../components/PlanningDialogs'
import { AIAssist } from '../components/AIAssist'
import { useWorkspace } from '../state/WorkspaceContext'
import { baseRecord, dateLabel, localDate, minutesLabel } from '../domain/dates'
import { ensurePlan, planSummary } from '../domain/workspace'
import type { Commitment } from '../domain/types'
import type { AIResult } from '../services/ai'

export function Progress({ onReview, onWeekly }: { onReview(): void; onWeekly(): void }) {
  const { state } = useWorkspace()
  const [view, setView] = useState<'work' | 'reviews' | 'changes'>('work')
  const sessions = [...state.sessions].sort((a, b) => b.started_at.localeCompare(a.started_at))
  const completed = state.tasks
    .filter(
      (t) =>
        t.status === 'done' &&
        !state.sessions.some((x) => x.task_id === t.id && x.outcome === 'completed'),
    )
    .map((t) => ({ id: t.id, title: t.title, at: t.completed_at ?? t.updated_at }))
  const work = [
    ...sessions.map((x) => ({
      id: x.id,
      title: state.tasks.find((t) => t.id === x.task_id)?.title ?? 'Recorded work',
      at: x.started_at,
      detail: `${x.outcome === 'completed' ? 'Completed' : x.outcome === 'progress' ? 'Made progress' : 'Stopped'} · ${minutesLabel(x.duration_seconds / 60)}${x.mode === 'manual' ? ' · Logged manually' : ' · Focus session'}`,
      notes: x.notes,
      resume: x.resume_note,
      icon: x.outcome === 'completed' ? Check : Clock3,
    })),
    ...completed.map((t) => ({
      ...t,
      detail: 'Completed action',
      notes: '',
      resume: '',
      icon: Check,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at))
  return (
    <>
      <PageHeading
        eyebrow="What actually happened"
        title="Small steps leave a trail."
        description="Work, reflection, and changes in direction. No scores. No streaks."
      >
        <button className="button secondary" onClick={onReview}>
          Review a day
        </button>
      </PageHeading>
      <div className="flex justify-between items-center mb-6">
        <div className="filter-row !mb-0">
          {(['work', 'reviews', 'changes'] as const).map((v) => (
            <button
              className={`choice-chip ${view === v ? 'selected' : ''}`}
              key={v}
              onClick={() => setView(v)}
            >
              {v === 'work'
                ? 'Work that happened'
                : v === 'reviews'
                  ? 'Reflections'
                  : 'Changes in plans'}
            </button>
          ))}
        </div>
        <TextLink onClick={onWeekly}>
          Weekly reset <ArrowRight size={13} />
        </TextLink>
      </div>
      {view === 'work' ? (
        <>
          {work.length ? (
            <div className="timeline">
              {work.map((x) => (
                <article className="timeline-item" key={x.id}>
                  <div className="timeline-icon">
                    <x.icon size={16} />
                  </div>
                  <div>
                    <h3>{x.title}</h3>
                    <p>{x.detail}</p>
                    {x.notes && <p>{x.notes}</p>}
                    {x.resume && <p className="resume-note">Pick up here: {x.resume}</p>}
                  </div>
                  <time className="timeline-time">
                    {new Date(x.at).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                    <br />
                    {new Date(x.at).toLocaleTimeString(undefined, {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </time>
                </article>
              ))}
            </div>
          ) : (
            <Empty
              title="Your work will find a home here"
              body="Complete an action, record a little progress, or try a focus session. There’s no minimum amount that counts."
            />
          )}
          {state.goals.some((g) => g.status === 'completed') && (
            <div className="section-space">
              <SectionHeading title="Outcomes you reached" />
              {state.goals
                .filter((g) => g.status === 'completed')
                .map((g) => (
                  <div className="timeline-item" key={g.id}>
                    <div className="timeline-icon">
                      <Sprout size={16} />
                    </div>
                    <div>
                      <h3>{g.title}</h3>
                      <p>{g.why || 'An outcome you chose to mark complete.'}</p>
                    </div>
                  </div>
                ))}
            </div>
          )}
          {state.resources.some((r) => r.progress > 0) && (
            <div className="section-space">
              <SectionHeading title="Resources you’re working through" />
              {state.resources
                .filter((r) => r.progress > 0)
                .map((r) => (
                  <div className="timeline-item" key={r.id}>
                    <div className="timeline-icon">
                      <BookOpen size={16} />
                    </div>
                    <div>
                      <h3>{r.title}</h3>
                      <p>
                        {r.progress}
                        {r.total_units ? ` of ${r.total_units}` : ''} {r.unit_label}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </>
      ) : view === 'reviews' ? (
        state.reviews.length ? (
          [...state.reviews]
            .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
            .map((r) => (
              <article className="inbox-card" key={r.id}>
                <div className="eyebrow">
                  {r.kind === 'weekly' ? 'Weekly reset' : 'Daily reflection'} ·{' '}
                  {state.plans.find((p) => p.id === r.plan_id)?.date}
                </div>
                <p>{r.reflection || 'Made space to notice what happened.'}</p>
              </article>
            ))
        ) : (
          <Empty
            title="A little reflection goes a long way"
            body="Notice what worked and what got in the way. Bring that context into your next day."
          >
            <button className="button small" onClick={onReview}>
              Review your day
            </button>
          </Empty>
        )
      ) : state.events.length ? (
        [...state.events].reverse().map((e) => (
          <article className="timeline-item" key={e.id}>
            <div className="timeline-icon">
              <CalendarDays size={15} />
            </div>
            <div>
              <h3 className="!text-sm">{e.note}</h3>
              <p>{new Date(e.created_at).toLocaleString()}</p>
            </div>
          </article>
        ))
      ) : (
        <Empty
          title="Room to change direction"
          body="Your decisions to commit, reschedule, re-estimate, or pause work will be recorded here."
        />
      )}
    </>
  )
}
export function ReviewDialog({ onClose, weekly = false }: { onClose(): void; weekly?: boolean }) {
  const { state, today, change, saving } = useWorkspace()
  const dates = [...new Set([today, ...state.plans.map((p) => p.date).filter((d) => d <= today)])]
    .sort()
    .reverse()
  const [date, setDate] = useState(today)
  const [reflection, setReflection] = useState(
    state.reviews.find(
      (r) =>
        r.plan_id === state.plans.find((p) => p.date === today)?.id &&
        r.kind === (weekly ? 'weekly' : 'daily'),
    )?.reflection ?? '',
  )
  const [replanning, setReplanning] = useState<Commitment | null>(null)
  const [result, setResult] = useState<AIResult | null>(null)
  const summary = planSummary(state, date)
  const pending = summary.pending.filter(
    (c) => state.tasks.find((t) => t.id === c.task_id)?.status === 'active',
  )
  const happened = state.sessions.filter(
    (x) => localDate(new Date(x.started_at), state.preferences.timezone) === date,
  )
  const completed = summary.commitments.filter((c) => c.status === 'completed')
  return (
    <>
      <Modal
        title={weekly ? 'A little reset for your attention.' : 'Notice. Learn. Make room.'}
        subtitle={
          weekly
            ? 'Which goals still matter? Which can pause? What’s one useful next action?'
            : 'The plan was a suggestion. This is what actually happened.'
        }
        onClose={onClose}
        wide
      >
        <Field label="Day to review">
          <select
            value={date}
            onChange={(e) => {
              const d = e.target.value
              setDate(d)
              setReflection(
                state.reviews.find(
                  (r) =>
                    r.plan_id === state.plans.find((p) => p.date === d)?.id &&
                    r.kind === (weekly ? 'weekly' : 'daily'),
                )?.reflection ?? '',
              )
              setResult(null)
            }}
          >
            {dates.map((d) => (
              <option key={d} value={d}>
                {dateLabel(d)}
              </option>
            ))}
          </select>
        </Field>
        {weekly ? (
          <>
            <SectionHeading title="Where your attention is going" />
            {state.goals
              .filter((g) => ['active', 'paused'].includes(g.status))
              .map((g) => (
                <div className="review-row" key={g.id}>
                  <div className="flex justify-between gap-4">
                    <h3>{g.title}</h3>
                    <span className="tag">{g.status}</span>
                  </div>
                  <p className="small muted mt-2">
                    {g.why || 'Does this still deserve attention right now?'}
                  </p>
                  <div className="split-actions">
                    <button
                      className="button small secondary"
                      disabled={saving}
                      onClick={() =>
                        void change((s) => {
                          s.goals.find((x) => x.id === g.id)!.status =
                            g.status === 'active' ? 'paused' : 'active'
                          s.events.push({
                            ...baseRecord(),
                            task_id: null,
                            plan_id: null,
                            kind: 'goal',
                            note: `${g.title}: ${g.status === 'active' ? 'paused' : 'reactivated'} in weekly reset`,
                          })
                        }, 'Attention adjusted')
                      }
                    >
                      {g.status === 'active' ? 'Take a pause' : 'Give it attention'}
                    </button>
                  </div>
                </div>
              ))}
            {!state.goals.length && (
              <p className="muted small mb-4">
                There are no goals to reconsider yet. You can still reflect on your week.
              </p>
            )}
          </>
        ) : (
          <>
            <div className="notice-panel">
              {completed.length} completed {completed.length === 1 ? 'commitment' : 'commitments'} ·{' '}
              {happened.length} recorded work {happened.length === 1 ? 'session' : 'sessions'} ·{' '}
              {minutesLabel(summary.spent)} of work recorded
            </div>
            {happened.map((x) => (
              <div className="review-row" key={x.id}>
                <h3>{state.tasks.find((t) => t.id === x.task_id)?.title}</h3>
                <p className="small muted mt-1">
                  {x.outcome} · {minutesLabel(x.duration_seconds / 60)}
                </p>
                {x.notes && <p className="small muted mt-2">{x.notes}</p>}
              </div>
            ))}
            {summary.commitments.length > 0 && (
              <div className="section-space">
                <SectionHeading title="What you planned" />
                {summary.commitments.map((c) => (
                  <p key={c.id} className="small muted py-2">
                    {c.status === 'completed' ? '✓ ' : '○ '}
                    {state.tasks.find((t) => t.id === c.task_id)?.title} ·{' '}
                    {c.planned_minutes ? minutesLabel(c.planned_minutes) : 'No estimate'}
                  </p>
                ))}
              </div>
            )}
            {pending.length > 0 && (
              <div className="section-space">
                <SectionHeading title="Carry the context forward" />
                {pending.map((c) => (
                  <div className="review-row" key={c.id}>
                    <div className="flex justify-between items-start gap-3">
                      <h3>{state.tasks.find((t) => t.id === c.task_id)?.title}</h3>
                      <button className="text-link" onClick={() => setReplanning(c)}>
                        Decide what’s next <ArrowRight size={13} />
                      </button>
                    </div>
                    <p className="small muted mt-2">
                      {state.tasks.find((t) => t.id === c.task_id)?.resume_note ||
                        'Unfinished doesn’t mean unimportant. You can move it, make it smaller, or let it go.'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        <form
          className="mt-6"
          onSubmit={async (e) => {
            e.preventDefault()
            if (
              await change((s) => {
                const plan = ensurePlan(s, date)
                const kind = weekly ? 'weekly' : 'daily'
                const existing = s.reviews.find((r) => r.plan_id === plan.id && r.kind === kind)
                if (existing) {
                  existing.reflection = reflection
                  existing.updated_at = new Date().toISOString()
                } else s.reviews.push({ ...baseRecord(), plan_id: plan.id, reflection, kind })
                if (weekly) s.preferences.weekly_note = reflection
              }, 'Reflection saved')
            )
              onClose()
          }}
        >
          <Field
            label={
              weekly
                ? 'What deserves attention next week?'
                : 'What would you like tomorrow to know?'
            }
          >
            <textarea
              maxLength={20000}
              rows={4}
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              placeholder="What worked, what changed, or what you learned. A sentence is enough."
            />
          </Field>
          <div className="form-actions">
            <button type="button" className="button secondary" onClick={onClose}>
              Return to my day
            </button>
            <button className="button" disabled={saving}>
              Save reflection
            </button>
          </div>
        </form>
        <div className="mt-6">
          <AIAssist
            purpose="reflect"
            text={`Reflection: ${reflection}\nWork recorded: ${happened.map((x) => `${state.tasks.find((t) => t.id === x.task_id)?.title}: ${x.outcome}`).join('; ')}\nUnfinished: ${pending.map((c) => state.tasks.find((t) => t.id === c.task_id)?.title).join('; ')}`}
            onResult={setResult}
          />
          {result && (
            <>
              <p className="small muted">{result.summary}</p>
              {result.suggestions.map((x, i) => (
                <div className="suggestion-card" key={i}>
                  <h3>{x.title}</h3>
                  <p>{x.detail}</p>
                  <button
                    className="text-link"
                    onClick={() =>
                      setReflection(`${reflection}${reflection ? '\n' : ''}${x.detail || x.title}`)
                    }
                  >
                    Add to my reflection and edit
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      </Modal>
      {replanning && <ReplanDialog commitment={replanning} onClose={() => setReplanning(null)} />}
    </>
  )
}
