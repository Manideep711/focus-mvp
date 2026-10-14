import { useEffect, useState } from 'react'
import { Plus, Archive, Trash2, ArrowRight, Inbox as InboxIcon, Check } from 'lucide-react'
import { PageHeading, SectionHeading, Modal, Field, Empty, ConfirmDelete } from '../components/ui'
import { AIAssist } from '../components/AIAssist'
import { TaskCard } from '../components/TaskCard'
import { useWorkspace } from '../state/WorkspaceContext'
import { baseRecord } from '../domain/dates'
import { newTask, commitTask } from '../domain/workspace'
import type { InboxItem, TaskStatus } from '../domain/types'
import type { TaskHandlers } from './Today'
import type { AIResult } from '../services/ai'
import { useDictation } from '../state/useDictation'
import { appendDictation } from '../services/speech'
import { VoiceCapture } from '../components/VoiceCapture'

export function CaptureDialog({
  onClose,
  clearHead = false,
}: {
  onClose(): void
  clearHead?: boolean
}) {
  const { change, saving, storageScope } = useWorkspace()
  const key = `focus.draft.${storageScope}`
  const [text, setText] = useState(() => {
    try {
      return localStorage.getItem(key) ?? ''
    } catch {
      return ''
    }
  })
  const [draftError, setDraftError] = useState('')
  const [language, setLanguage] = useState('en-IN')
  const voice = useDictation((transcript) =>
    setText((current) => appendDictation(current, transcript)),
  )
  useEffect(() => {
    if (text.length >= 20000 && voice.active && voice.status !== 'stopping') voice.stop()
  }, [text.length, voice.status])
  useEffect(() => {
    try {
      if (text) localStorage.setItem(key, text)
      else localStorage.removeItem(key)
      setDraftError('')
    } catch {
      setDraftError(
        'Draft could not be saved on this device. Keep this window open until you capture it.',
      )
    }
  }, [text, key])
  async function capture() {
    if (!text.trim() || voice.active) return
    if (
      await change((s) => {
        s.inbox.push({
          ...baseRecord(),
          text: text.trim(),
          status: 'unprocessed',
          kind: 'thought',
          interpretation: '',
        })
      }, 'Safely captured. No need to organize it now.')
    ) {
      localStorage.removeItem(key)
      onClose()
    }
  }
  return (
    <Modal
      title={clearHead ? 'Let it all out.' : 'A place for what’s on your mind.'}
      subtitle="Messy is welcome. Capturing something doesn’t commit you to doing it."
      onClose={onClose}
      wide
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void capture()
        }}
      >
        <VoiceCapture
          voice={voice}
          language={language}
          onLanguage={setLanguage}
          disabled={saving || text.length >= 20000}
        />
        <Field
          label={
            clearHead ? 'What’s taking up space in your head?' : 'Your thought, idea, or brain dump'
          }
        >
          <textarea
            autoFocus
            required
            maxLength={20000}
            rows={clearHead ? 12 : 7}
            value={text}
            readOnly={voice.active}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault()
                void capture()
              }
            }}
            placeholder="Things to do, things to figure out, things you don’t want to forget…"
          />
        </Field>
        <p className="small muted">
          {draftError || 'Draft saved on this device as you write.'} · Ctrl / ⌘ + Enter to capture
        </p>
        {text.length >= 20000 && (
          <p className="inline-error">
            This capture has reached 20,000 characters. Review and save it before adding more.
          </p>
        )}
        <div className="form-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Keep draft and close
          </button>
          <button className="button" disabled={saving || voice.active || !text.trim()}>
            <Plus size={15} /> Capture
          </button>
        </div>
      </form>
    </Modal>
  )
}
export function Inbox({
  handlers,
  onCapture,
  onClearHead,
  onAdd,
}: {
  handlers: TaskHandlers
  onCapture(): void
  onClearHead(): void
  onAdd(): void
}) {
  const { state, change, saving } = useWorkspace()
  const [view, setView] = useState<'unprocessed' | 'organized' | 'archived' | 'actions'>(
    'unprocessed',
  )
  const [organizing, setOrganizing] = useState<InboxItem | null>(null)
  const [deleting, setDeleting] = useState<InboxItem | null>(null)
  const [taskStatus, setTaskStatus] = useState<TaskStatus>('active')
  const [search, setSearch] = useState('')
  const items = state.inbox
    .filter((i) => i.status === view && i.text.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
  const tasks = state.tasks.filter(
    (t) => t.status === taskStatus && t.title.toLowerCase().includes(search.toLowerCase()),
  )
  return (
    <>
      <PageHeading
        eyebrow="A little less in your head"
        title="Let your mind breathe."
        description="Capture everything. Decide what deserves attention later."
      >
        <button className="button secondary" onClick={onClearHead}>
          Clear my head
        </button>
      </PageHeading>
      <button className="capture-prompt !mt-0 !mb-7 !py-5" onClick={onCapture}>
        <span>
          <Plus size={16} className="inline mr-3" /> What’s on your mind?
        </span>
        <span className="keyboard-hint">N</span>
      </button>
      <div className="filter-row">
        {(['unprocessed', 'organized', 'archived', 'actions'] as const).map((v) => (
          <button
            className={`choice-chip ${view === v ? 'selected' : ''}`}
            key={v}
            onClick={() => setView(v)}
          >
            {v === 'unprocessed'
              ? 'To consider'
              : v === 'actions'
                ? 'All actions'
                : v[0].toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>
      <Field label="Find something">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={view === 'actions' ? 'Search your actions' : 'Search your thoughts'}
        />
      </Field>
      {view === 'actions' ? (
        <>
          <div className="flex items-center justify-between mb-4">
            <select
              className="!w-auto"
              aria-label="Action state"
              value={taskStatus}
              onChange={(e) => setTaskStatus(e.target.value as TaskStatus)}
            >
              <option value="active">Available</option>
              <option value="waiting">Waiting on</option>
              <option value="later">Later</option>
              <option value="done">Completed</option>
              <option value="archived">Archived</option>
            </select>
            <button className="text-link" onClick={onAdd}>
              <Plus size={14} /> New action
            </button>
          </div>
          <div className="task-list">
            {tasks.length ? (
              tasks.map((t) => <TaskCard key={t.id} task={t} {...handlers} />)
            ) : (
              <Empty
                title="Nothing here right now"
                body="Actions are things you’ve chosen to do. Thoughts can stay thoughts."
              />
            )}
          </div>
        </>
      ) : items.length ? (
        items.map((item) => (
          <article key={item.id} className="inbox-card">
            <div className="eyebrow !mb-3">
              {item.kind === 'thought' ? 'Captured thought' : item.kind} ·{' '}
              {new Date(item.created_at).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              })}
            </div>
            <p>{item.text}</p>
            {item.interpretation && <p className="resume-note">{item.interpretation}</p>}
            <div className="inbox-footer">
              <button className="text-link" onClick={() => setOrganizing(item)}>
                {item.status === 'unprocessed' ? 'Consider this thought' : 'Edit or organize'}{' '}
                <ArrowRight size={14} />
              </button>
              <div className="flex gap-2">
                <button
                  className="icon-button"
                  disabled={saving}
                  aria-label={item.status === 'archived' ? 'Restore thought' : 'Archive thought'}
                  onClick={() =>
                    void change(
                      (s) => {
                        s.inbox.find((i) => i.id === item.id)!.status =
                          item.status === 'archived' ? 'unprocessed' : 'archived'
                      },
                      item.status === 'archived' ? 'Thought restored' : 'Thought archived',
                    )
                  }
                >
                  <Archive size={15} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Delete thought"
                  onClick={() => setDeleting(item)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          </article>
        ))
      ) : (
        <Empty
          title={view === 'unprocessed' ? 'Nothing you need to hold onto.' : 'A little room here.'}
          body={
            view === 'unprocessed'
              ? 'A thought, a worry, an idea. Put it here when it appears. You can make sense of it later.'
              : 'Your thoughts will appear here when you organize or archive them.'
          }
        >
          {view === 'unprocessed' && (
            <button className="button small" onClick={onCapture}>
              <InboxIcon size={14} /> Capture a thought
            </button>
          )}
        </Empty>
      )}
      {organizing && <OrganizeDialog item={organizing} onClose={() => setOrganizing(null)} />}
      {deleting && (
        <ConfirmDelete
          title="Let this thought go?"
          body="This permanently deletes the original capture. Any goals, actions, or resources created from it will remain."
          onClose={() => setDeleting(null)}
          onDelete={() =>
            change(
              (s) => {
                s.inbox = s.inbox.filter((i) => i.id !== deleting.id)
                ;[...s.tasks, ...s.goals, ...s.projects, ...s.resources].forEach((row) => {
                  if (row.source_inbox_id === deleting.id) row.source_inbox_id = null
                })
              },
              'Thought deleted',
              false,
            )
          }
        />
      )}
    </>
  )
}
function OrganizeDialog({ item, onClose }: { item: InboxItem; onClose(): void }) {
  const { state, today, change, saving } = useWorkspace()
  const [text, setText] = useState(item.text)
  const [kind, setKind] = useState('note')
  const [title, setTitle] = useState(item.text.split('\n')[0].slice(0, 150))
  const [goal, setGoal] = useState('')
  const [url, setUrl] = useState('')
  const [chooseToday, setChooseToday] = useState(false)
  const [result, setResult] = useState<AIResult | null>(null)
  const [answer, setAnswer] = useState('')
  return (
    <Modal
      title="What would you like this to become?"
      subtitle="It’s fine to keep a thought as a thought. Organization is your choice."
      onClose={onClose}
      wide
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          if (!text.trim()) return
          const ok = await change(
            (s) => {
              const original = s.inbox.find((i) => i.id === item.id)!
              original.text = text.trim()
              original.status = 'organized'
              original.kind = kind === 'idea' ? 'idea' : 'note'
              original.updated_at = new Date().toISOString()
              original.interpretation = result?.summary ?? ''
              if (kind === 'task') {
                const t = newTask(title, {
                  description: text,
                  goal_id: goal || null,
                  source_inbox_id: item.id,
                })
                s.tasks.push(t)
                if (chooseToday) commitTask(s, t.id, today)
              }
              if (kind === 'goal')
                s.goals.push({
                  ...baseRecord(),
                  title: title.trim(),
                  why: '',
                  status: 'idea',
                  target_date: null,
                  resume_date: null,
                  notes: text,
                  source_inbox_id: item.id,
                })
              if (kind === 'project')
                s.projects.push({
                  ...baseRecord(),
                  title: title.trim(),
                  goal_id: goal || null,
                  notes: text,
                  status: 'active',
                  source_inbox_id: item.id,
                })
              if (kind === 'resource')
                s.resources.push({
                  ...baseRecord(),
                  title: title.trim(),
                  type: 'other',
                  url,
                  progress: 0,
                  total_units: null,
                  unit_label: 'units',
                  target_date: null,
                  goal_id: goal || null,
                  project_id: null,
                  notes: text,
                  source_inbox_id: item.id,
                })
            },
            kind === 'note' || kind === 'idea'
              ? 'Thought kept safely'
              : `${kind[0].toUpperCase() + kind.slice(1)} created. Original thought preserved.`,
          )
          if (ok) onClose()
        }}
      >
        <Field label="Original thought">
          <textarea
            required
            maxLength={20000}
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </Field>
        <AIAssist
          purpose="interpret"
          text={`${text}${answer ? `\nClarification: ${answer}` : ''}`}
          onResult={setResult}
        />
        {result && (
          <div className="mb-5">
            <SectionHeading title="A suggestion to review" />
            <p className="muted small">{result.summary}</p>
            {result.clarifying_question && (
              <Field label={result.clarifying_question}>
                <input
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  maxLength={500}
                  placeholder="Answer, then request an updated interpretation above"
                />
              </Field>
            )}
            {result.suggestions.map((suggestion, index) => (
              <div key={index} className="suggestion-card">
                <strong>
                  {suggestion.kind}: {suggestion.title}
                </strong>
                <p>{suggestion.detail}</p>
                <p>{suggestion.reason}</p>
                <button
                  type="button"
                  className="button small secondary"
                  onClick={() => {
                    setKind(
                      ['idea', 'goal', 'project', 'task', 'resource'].includes(suggestion.kind)
                        ? suggestion.kind
                        : 'note',
                    )
                    setTitle(suggestion.title)
                  }}
                >
                  <Check size={13} /> Use this interpretation
                </button>
              </div>
            ))}
            <button type="button" className="text-link" onClick={() => setResult(null)}>
              Reject suggestions
            </button>
          </div>
        )}
        <Field label="I’ll organize it as">
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="note">A note · nothing to do</option>
            <option value="idea">An idea · worth keeping</option>
            <option value="goal">A goal · an outcome I care about</option>
            <option value="project">A project · a piece of work</option>
            <option value="task">An action · something concrete to do</option>
            <option value="resource">A resource · something to use</option>
          </select>
        </Field>
        {!['note', 'idea'].includes(kind) && (
          <Field label="Title · edit freely">
            <input
              required
              maxLength={500}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
        )}
        {['project', 'task', 'resource'].includes(kind) && (
          <Field label="Connect to a goal · optional">
            <select value={goal} onChange={(e) => setGoal(e.target.value)}>
              <option value="">Keep it independent</option>
              {state.goals.map((g) => (
                <option value={g.id} key={g.id}>
                  {g.title}
                </option>
              ))}
            </select>
          </Field>
        )}
        {kind === 'resource' && (
          <Field label="Resource URL · optional">
            <input
              type="url"
              pattern="https?://.*"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
            />
          </Field>
        )}
        {kind === 'task' && (
          <label className="check-label">
            <input
              type="checkbox"
              checked={chooseToday}
              onChange={(e) => setChooseToday(e.target.checked)}
            />{' '}
            Choose this for Today
          </label>
        )}
        <div className="form-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Decide later
          </button>
          <button className="button" disabled={saving}>
            Confirm my choice
          </button>
        </div>
      </form>
    </Modal>
  )
}
