import { useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { ArrowLeft, ArrowRight, Undo2 } from 'lucide-react'
import { Modal, Field } from './ui'
import { Button } from './primitives/button'
import { useWorkspace } from '../state/WorkspaceContext'
import { planningDeck } from '../domain/attention'
import { commitTask, planSummary, logEvent } from '../domain/workspace'
import { minutesLabel } from '../domain/dates'
import { ActionContext } from './ActionContext'

export function DayDeck({ onClose, onAdd }: { onClose(): void; onAdd(): void }) {
  const { state, today, change, saving } = useWorkspace()
  const [cards] = useState(() => planningDeck(state, today))
  const [decisions, setDecisions] = useState<('today' | 'later')[]>([])
  const [done, setDone] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const [portion, setPortion] = useState('')
  const busy = useRef(false)
  const reduced = useReducedMotion()
  const card = cards[decisions.length]
  const summary = planSummary(state, today)
  const portionValid =
    !portion ||
    (Number.isInteger(Number(portion)) && Number(portion) >= 1 && Number(portion) <= 1440)
  const mightCrowdDay =
    card &&
    summary.remainingWork + (portion ? Number(portion) : (card.estimate_minutes ?? 0)) >
      summary.remainingCapacity
  const chosen = decisions.filter((d) => d === 'today').length
  async function decide(choice: 'today' | 'later') {
    if (!card || busy.current || saving || (choice === 'today' && !portionValid)) return
    busy.current = true
    try {
      if (
        choice === 'today' &&
        !(await change(
          (s) => commitTask(s, card.id, today, portion ? Number(portion) : undefined),
          'Chosen for Today',
          false,
        ))
      )
        return
      setDecisions((d) => [...d, choice])
      setPortion('')
      setAnnouncement(
        choice === 'today' ? 'Chosen for Today.' : 'Left for later. Nothing was rescheduled.',
      )
    } finally {
      busy.current = false
    }
  }
  async function undo() {
    if (!decisions.length || busy.current || saving) return
    busy.current = true
    try {
      const previous = cards[decisions.length - 1]
      if (
        decisions.at(-1) === 'today' &&
        !(await change(
          (s) => {
            const plan = s.plans.find((p) => p.date === today)
            const commitment = s.commitments.find(
              (c) => c.plan_id === plan?.id && c.task_id === previous.id,
            )
            if (commitment?.status === 'planned') {
              commitment.status = 'removed'
              commitment.updated_at = new Date().toISOString()
              commitment.reason = 'Changed my mind while choosing the day'
              logEvent(
                s,
                previous.id,
                commitment.plan_id,
                'commitment',
                `Undid choosing ${previous.title} for Today`,
              )
            }
            const original = s.tasks.find((t) => t.id === previous.id)
            if (
              original &&
              !s.commitments.some((c) => c.task_id === previous.id && c.status === 'planned')
            )
              original.status = previous.status
          },
          'Choice undone',
          false,
        ))
      )
        return
      setDecisions((d) => d.slice(0, -1))
      setDone(false)
      setPortion('')
      setAnnouncement('Choice undone.')
    } finally {
      busy.current = false
    }
  }
  return (
    <Modal
      title="Choose a little room for today"
      subtitle="One action at a time. You can stop whenever you have enough."
      onClose={onClose}
    >
      {card && !done ? (
        <>
          <motion.div
            key={card.id}
            className="day-deck-card"
            drag={saving ? false : 'x'}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.6}
            onDragEnd={(_, info) => {
              if (info.offset.x > 80) void decide('today')
              else if (info.offset.x < -80) void decide('later')
            }}
            initial={reduced ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
          >
            <span className="eyebrow">A possibility, not an obligation</span>
            <h3>{card.title}</h3>
            {(card.resume_note || card.description) && (
              <ActionContext
                className="deck-next-step"
                text={card.resume_note || card.description}
              />
            )}
            {card.estimate_minutes !== null && (
              <span className="small muted">
                About {minutesLabel(card.estimate_minutes)} · a smaller portion is okay
              </span>
            )}
          </motion.div>
          {mightCrowdDay && (
            <p className="deck-hint">
              This may make today feel full. You can choose a smaller portion or leave it for later.
            </p>
          )}
          <details key={`portion-${card.id}`} className="deck-portion">
            <summary>Choose a smaller portion · optional</summary>
            <Field
              label="Minutes to give this today"
              hint="This changes today’s commitment, not the whole task estimate."
            >
              <input
                type="number"
                min={1}
                max={1440}
                value={portion}
                onChange={(e) => setPortion(e.target.value)}
                placeholder="For example, 15"
              />
            </Field>
            {!portionValid && <p className="inline-error">Choose a whole number from 1 to 1440.</p>}
          </details>
          <div className="deck-decisions">
            <Button variant="outline" disabled={saving} onClick={() => void decide('later')}>
              <ArrowLeft size={16} /> Later
            </Button>
            <Button disabled={saving || !portionValid} onClick={() => void decide('today')}>
              Today <ArrowRight size={16} />
            </Button>
          </div>
          <p className="deck-hint">
            Swipe left for later, right for today—or use the buttons. Later leaves the action where
            it is.
          </p>
          {chosen > 0 && (
            <Button variant="ghost" className="deck-enough" onClick={() => setDone(true)}>
              Enough for now
            </Button>
          )}
        </>
      ) : (
        <div className="deck-summary">
          <h3>{chosen ? 'That can be enough.' : 'You can leave some space.'}</h3>
          <p>
            {chosen
              ? 'Your choices are saved. Close this and start with one action.'
              : 'No need to choose something just to fill a plan. Add a small action if that helps.'}
          </p>
          <Button onClick={onClose}>{chosen ? 'Ready to start' : 'Return to Today'}</Button>
          {card && done && (
            <Button variant="ghost" onClick={() => setDone(false)}>
              Keep choosing
            </Button>
          )}
        </div>
      )}
      <div className="deck-footer">
        <Button
          variant="ghost"
          size="sm"
          disabled={!decisions.length || saving}
          onClick={() => void undo()}
        >
          <Undo2 size={14} /> Undo last choice
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onClose()
            onAdd()
          }}
        >
          Add my own action
        </Button>
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
    </Modal>
  )
}
