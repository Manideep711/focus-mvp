import { useState } from 'react'
import { Plus, ArrowRight, Sun, Leaf, Clock3, Zap, BookOpen } from 'lucide-react'
import { PageHeading, SectionHeading, Empty, TextLink, Modal, Field } from '../components/ui'
import { TaskCard } from '../components/TaskCard'
import { ChooseTaskDialog, SuggestionsDialog } from '../components/PlanningDialogs'
import { useWorkspace } from '../state/WorkspaceContext'
import { ensurePlan, planSummary } from '../domain/workspace'
import { dateLabel, minutesLabel } from '../domain/dates'
import type { Commitment, Task, Energy } from '../domain/types'
import { Button } from '../components/primitives/button'
import { Card } from '../components/primitives/card'
import { HoverBorderGradient } from '../components/aceternity/hover-border-gradient'
import { BlurFade } from '../components/magicui/blur-fade'
import { CalmToday } from '../components/CalmToday'
import { DayDeck } from '../components/DayDeck'

export interface TaskHandlers {
  onFocus(t: Task): void
  onEdit(t: Task): void
  onRecord(t: Task): void
  onReplan(c: Commitment): void
}
export function Today({
  handlers,
  onAdd,
  onCapture,
  onEmergency,
  onReview,
  onOverwhelmed,
}: {
  handlers: TaskHandlers
  onAdd(): void
  onCapture(): void
  onEmergency(): void
  onReview(): void
  onOverwhelmed(): void
}) {
  const { state, today, change, saving } = useWorkspace()
  const [choose, setChoose] = useState(false)
  const [suggest, setSuggest] = useState(false)
  const [capacity, setCapacity] = useState(false)
  const [minutes, setMinutes] = useState('180')
  const [fullDay, setFullDay] = useState(
    () => sessionStorage.getItem('focus.today.view') === 'full',
  )
  const [deck, setDeck] = useState(false)
  function setView(full: boolean) {
    setFullDay(full)
    sessionStorage.setItem('focus.today.view', full ? 'full' : 'calm')
  }
  const summary = planSummary(state, today)
  const pending = summary.pending.filter(
    (c) => !state.tasks.find((t) => t.id === c.task_id)?.is_emergency,
  )
  const emergencies = summary.pending.filter(
    (c) => state.tasks.find((t) => t.id === c.task_id)?.is_emergency,
  )
  const completed = summary.commitments.filter((c) => c.status === 'completed')
  const older = state.commitments.filter(
    (c) =>
      c.status === 'planned' &&
      state.plans.some((p) => p.id === c.plan_id && p.date < today) &&
      state.tasks.some((t) => t.id === c.task_id && t.status === 'active'),
  )
  const paused = state.goals.filter(
    (g) => g.status === 'paused' && g.resume_date && g.resume_date <= today,
  )
  const waiting = state.tasks.filter(
    (t) => t.status === 'waiting' && t.follow_up_date && t.follow_up_date <= today,
  )
  const inboxCount = state.inbox.filter((i) => i.status === 'unprocessed').length
  const card = (c: Commitment) => {
    const task = state.tasks.find((t) => t.id === c.task_id)
    if (!task) return null
    return (
      <TaskCard
        key={c.id}
        task={task}
        commitment={c}
        {...handlers}
        onMove={(direction) =>
          void change((s) => {
            const items = s.commitments
              .filter((x) => x.plan_id === c.plan_id && x.status === 'planned')
              .sort((a, b) => a.position - b.position)
            const i = items.findIndex((x) => x.id === c.id)
            const next = i + direction
            if (next >= 0 && next < items.length) [items[i], items[next]] = [items[next], items[i]]
            items.forEach((item, index) => {
              item.position = index
            })
          }, 'Order updated')
        }
      />
    )
  }
  if (!fullDay)
    return (
      <CalmToday
        handlers={handlers}
        onAdd={onAdd}
        onCapture={onCapture}
        onEmergency={onEmergency}
        onReview={onReview}
        onOverwhelmed={onOverwhelmed}
        onSeeDay={() => setView(true)}
      />
    )
  return (
    <>
      <PageHeading
        eyebrow={dateLabel(today)}
        title={
          state.preferences.name
            ? `A little clarity, ${state.preferences.name.split(' ')[0]}.`
            : 'Make room for what matters.'
        }
        description="A few meaningful commitments. One thing at a time."
      >
        <Button variant="ghost" onClick={() => setView(false)}>
          One thing at a time
        </Button>
        <Button variant="outline" onClick={onAdd}>
          <Plus size={15} /> Add an action
        </Button>
      </PageHeading>
      {older.length > 0 && (
        <div className="notice-panel">
          {older.length} unfinished {older.length === 1 ? 'commitment is' : 'commitments are'}{' '}
          waiting for a decision from an earlier day.{' '}
          <button className="text-link" onClick={onReview}>
            Carry the context forward <ArrowRight size={13} />
          </button>
        </div>
      )}
      {(paused.length > 0 || waiting.length > 0) && (
        <div className="notice-panel">
          {paused.map((g) => (
            <p key={g.id}>
              You planned to reconsider “{g.title}” around now. Reactivate it from Goals when you’re
              ready.
            </p>
          ))}
          {waiting.map((t) => (
            <button key={t.id} className="text-link" onClick={() => handlers.onEdit(t)}>
              Check in on {t.title}
            </button>
          ))}
        </div>
      )}
      <div className="today-grid">
        <div>
          <BlurFade delay={0.06}>
            <Card className="hero-card">
              <div className="hero-art" aria-hidden="true">
                <div className="hero-ring outer" />
                <div className="hero-ring middle" />
                <div className="hero-ring inner" />
                <div className="hero-center">
                  <Leaf size={23} strokeWidth={1.25} />
                </div>
                <span className="hero-ring-dot" />
              </div>
              <div className="hero-content">
                <div className="hero-label">
                  <span /> Your attention, thoughtfully placed
                </div>
                <h2>Find your next right step.</h2>
                <p>
                  You don’t need to do everything.
                  <br />
                  Just choose what fits this moment.
                </p>
                <HoverBorderGradient onClick={() => setSuggest(true)}>
                  What should I do now? <ArrowRight size={16} />
                </HoverBorderGradient>
              </div>
            </Card>
          </BlurFade>
          {summary.overCapacity && (
            <div className="warning">
              Your remaining estimates add up to {minutesLabel(summary.remainingWork)}, with{' '}
              {minutesLabel(summary.remainingCapacity)} available. You can keep this plan, choose a
              smaller portion, or move something.
            </div>
          )}
          <SectionHeading title="Your commitments" meta={`${pending.length} chosen`}>
            <TextLink onClick={() => setDeck(true)}>Choose one at a time</TextLink>
            <TextLink onClick={() => setChoose(true)}>Choose from your actions</TextLink>
          </SectionHeading>
          <div className="task-list">
            {pending.length ? (
              pending.map(card)
            ) : (
              <Empty
                title="A little space to begin"
                body="What would make today meaningful? Choose one action. You can add more as the day unfolds."
              >
                <Button size="sm" onClick={onAdd}>
                  <Plus size={14} /> Choose your first action
                </Button>
              </Empty>
            )}
          </div>
          {emergencies.length > 0 && (
            <div className="section-space">
              <SectionHeading title="The unexpected" meta="Make room, gently" />
              <div className="task-list">{emergencies.map(card)}</div>
            </div>
          )}
          {completed.length > 0 && (
            <div className="section-space">
              <SectionHeading title="Moved forward" meta={`${completed.length} completed`} />
              <div className="task-list">{completed.map(card)}</div>
            </div>
          )}
          <button className="capture-prompt" onClick={onCapture}>
            <span>
              <Plus size={14} className="inline mr-2" /> Something on your mind? Leave it in your
              Inbox.
            </span>
            <span className="keyboard-hint">N</span>
          </button>
          <div className="footer-note">
            <Leaf size={13} /> Plans are suggestions. Reality wins.
          </div>
        </div>
        <aside className="today-aside">
          <div className="side-panel">
            <div className="flex items-center justify-between">
              <h3 className="!mb-0">Room in your day</h3>
              <Sun size={16} className="muted" />
            </div>
            <div className="capacity-value">{minutesLabel(summary.remainingCapacity)}</div>
            <div className="capacity-caption">
              remaining of {minutesLabel(summary.plan?.available_minutes ?? 180)} available
            </div>
            <div className="capacity-bar">
              <span
                style={{
                  width: `${Math.min(100, (summary.remainingWork / Math.max(1, summary.remainingCapacity)) * 100)}%`,
                }}
              />
            </div>
            <p>
              {minutesLabel(summary.remainingWork)} still planned
              {summary.unknownEstimates ? ` · ${summary.unknownEstimates} without an estimate` : ''}
            </p>
            <TextLink
              onClick={() => {
                setMinutes(String(summary.plan?.available_minutes ?? 180))
                setCapacity(true)
              }}
            >
              Adjust available time
            </TextLink>
            <div className="divider !my-4" />
            <p>How’s your energy?</p>
            <div className="energy-options">
              {(['low', 'steady', 'high'] as Energy[]).map((e) => (
                <button
                  key={e}
                  disabled={saving}
                  className={(summary.plan?.energy ?? 'steady') === e ? 'selected' : ''}
                  onClick={() =>
                    void change((s) => {
                      ensurePlan(s, today).energy = e
                    }, 'Energy updated')
                  }
                >
                  {e === 'low' ? 'Low' : e === 'steady' ? 'Steady' : 'High'}
                </button>
              ))}
            </div>
          </div>
          <div className="side-panel">
            <h3 className="flex items-center gap-2">
              <Zap size={15} /> Something came up?
            </h3>
            <p>Make room for urgent work without losing the rest of your day.</p>
            <TextLink onClick={onEmergency}>Capture an interruption</TextLink>
          </div>
          <div className="side-panel">
            <h3 className="flex items-center gap-2">
              <BookOpen size={15} /> A moment to reflect
            </h3>
            <p>Notice what happened. Let tomorrow benefit from today.</p>
            <TextLink onClick={onReview}>Review your day</TextLink>
          </div>
          <div className="quiet-note">
            <Clock3 size={15} />
            <div>
              {inboxCount
                ? `${inboxCount} thoughts safely captured. They don’t all need to become tasks.`
                : 'Leave some breathing room. A full plan isn’t the same as a good day.'}
            </div>
          </div>
          <button className="button subtle small" onClick={onOverwhelmed}>
            <Leaf size={14} /> I’m overwhelmed
          </button>
        </aside>
      </div>
      {choose && <ChooseTaskDialog onClose={() => setChoose(false)} />}
      {deck && <DayDeck onClose={() => setDeck(false)} onAdd={onAdd} />}
      {suggest && (
        <SuggestionsDialog onClose={() => setSuggest(false)} onFocus={handlers.onFocus} />
      )}
      {capacity && (
        <Modal
          title="How much room do you have?"
          subtitle="Only count the time you can realistically give to your commitments."
          onClose={() => setCapacity(false)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              if (
                await change((s) => {
                  ensurePlan(s, today).available_minutes = Number(minutes)
                }, 'Available time updated')
              )
                setCapacity(false)
            }}
          >
            <Field label="Available minutes today">
              <input
                autoFocus
                type="number"
                required
                min={0}
                max={1440}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
              />
            </Field>
            <div className="form-actions">
              <button className="button" disabled={saving}>
                Save available time
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
