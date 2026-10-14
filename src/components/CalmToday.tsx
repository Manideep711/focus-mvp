import { useState } from 'react'
import { ArrowRight, Leaf, Plus } from 'lucide-react'
import { useWorkspace } from '../state/WorkspaceContext'
import { suggestTasks, planSummary } from '../domain/workspace'
import { dateLabel } from '../domain/dates'
import { Button } from './primitives/button'
import { DayDeck } from './DayDeck'
import { SuggestionsDialog } from './PlanningDialogs'
import type { TaskHandlers } from '../pages/Today'
import { ActionContext } from './ActionContext'

export function CalmToday({
  handlers,
  onAdd,
  onCapture,
  onEmergency,
  onSeeDay,
  onOverwhelmed,
  onReview,
}: {
  handlers: TaskHandlers
  onAdd(): void
  onCapture(): void
  onEmergency(): void
  onSeeDay(): void
  onOverwhelmed(): void
  onReview(): void
}) {
  const { state, today } = useWorkspace()
  const [deck, setDeck] = useState(false)
  const [alternatives, setAlternatives] = useState(false)
  const [why, setWhy] = useState(false)
  const next = suggestTasks(state, today, 'plan')[0]
  const movedForward = planSummary(state, today).commitments.some((c) => c.status === 'completed')
  return (
    <div className="calm-today">
      <div className="calm-heading">
        <span className="eyebrow">{dateLabel(today)}</span>
        <h1>
          {next
            ? 'Just the next step.'
            : movedForward
              ? 'A little room to breathe.'
              : 'A little space to begin.'}
        </h1>
        <p>
          {next
            ? 'You can give one thing your attention.'
            : 'You don’t have to sort out everything to start.'}
        </p>
      </div>
      <section className="calm-action" aria-label="Your next action">
        <span className="calm-symbol" aria-hidden="true">
          <Leaf size={25} strokeWidth={1.4} />
        </span>
        {next ? (
          <>
            <span className="eyebrow">Chosen by you · for today</span>
            <h2>{next.task.title}</h2>
            <ActionContext
              className="calm-step"
              text={
                next.task.resume_note ||
                next.task.description ||
                'Open what you need. Begin with one small part.'
              }
            />
            <Button onClick={() => handlers.onFocus(next.task)}>
              Start here <ArrowRight size={16} />
            </Button>
            <div className="calm-card-links">
              <button className="text-link" onClick={() => setAlternatives(true)}>
                Other options
              </button>
              <button className="text-link" aria-expanded={why} onClick={() => setWhy(!why)}>
                Why this?
              </button>
            </div>
            {why && (
              <p className="small muted">
                {next.reason} This is a suggestion; you can choose something else.
              </p>
            )}
          </>
        ) : (
          <>
            <h2>
              {movedForward
                ? 'You’ve moved something forward.'
                : 'What would you like to make room for?'}
            </h2>
            <p className="calm-step">
              {movedForward
                ? 'You can stop here, or make room for another small action.'
                : 'Choose one action. You can leave the rest for later.'}
            </p>
            <Button onClick={() => setDeck(true)}>
              Choose my day <ArrowRight size={16} />
            </Button>
            <button className="text-link calm-add" onClick={onAdd}>
              <Plus size={14} /> Add my own action
            </button>
          </>
        )}
      </section>
      <div className="calm-utilities">
        <Button variant="outline" onClick={onCapture}>
          <Plus size={15} /> Something on your mind?
        </Button>
        <button className="text-link" onClick={onSeeDay}>
          See my day <ArrowRight size={14} />
        </button>
      </div>
      <details className="calm-changes">
        <summary>Has something changed?</summary>
        <div className="calm-change-actions">
          <Button variant="ghost" onClick={() => setDeck(true)}>
            Choose a few actions
          </Button>
          <Button variant="ghost" onClick={onEmergency}>
            Something urgent came up
          </Button>
          <Button variant="ghost" onClick={onOverwhelmed}>
            I’m overwhelmed
          </Button>
          <Button variant="ghost" onClick={onReview}>
            Review or replan
          </Button>
        </div>
      </details>
      <p className="calm-footnote">Your ideas are safe. You don’t have to act on all of them.</p>
      {deck && <DayDeck onClose={() => setDeck(false)} onAdd={onAdd} />}
      {alternatives && (
        <SuggestionsDialog onClose={() => setAlternatives(false)} onFocus={handlers.onFocus} />
      )}
    </div>
  )
}
