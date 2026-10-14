import { describe, expect, it } from 'vitest'
import { planningDeck } from '../src/domain/attention'
import { emptyWorkspace, newTask, commitTask } from '../src/domain/workspace'
import { baseRecord } from '../src/domain/dates'

describe('a finite planning deck', () => {
  it('includes eligible later actions without activating them and limits the batch', () => {
    const s = emptyWorkspace()
    for (let i = 0; i < 9; i++) s.tasks.push(newTask(`Action ${i}`, { status: 'later' }))
    const before = JSON.stringify(s)
    expect(planningDeck(s, '2026-10-14')).toHaveLength(5)
    expect(JSON.stringify(s)).toBe(before)
  })
  it('does not offer already chosen, finished, blocked, waiting, archived, or emergency work', () => {
    const s = emptyWorkspace()
    const chosen = newTask('Chosen')
    s.tasks.push(
      chosen,
      newTask('Done', { status: 'done' }),
      newTask('Blocked', { blocker: 'Need access' }),
      newTask('Waiting', { status: 'waiting' }),
      newTask('Archived', { status: 'archived' }),
      newTask('Emergency', { is_emergency: true }),
      newTask('Available'),
    )
    commitTask(s, chosen.id, '2026-10-14')
    expect(planningDeck(s, '2026-10-14').map((t) => t.title)).toEqual(['Available'])
  })
  it('respects paused goals and the goal of a linked project', () => {
    const s = emptyWorkspace()
    const goal = {
      ...baseRecord(),
      title: 'Pause',
      why: '',
      status: 'paused' as const,
      target_date: null,
      resume_date: null,
      notes: '',
      source_inbox_id: null,
    }
    const project = {
      ...baseRecord(),
      title: 'Project',
      goal_id: goal.id,
      notes: '',
      status: 'active' as const,
      source_inbox_id: null,
    }
    s.goals.push(goal)
    s.projects.push(project)
    s.tasks.push(
      newTask('Goal action', { goal_id: goal.id }),
      newTask('Project action', { project_id: project.id }),
    )
    expect(planningDeck(s, '2026-10-14')).toEqual([])
  })
  it('surfaces deadlines first without altering their date', () => {
    const s = emptyWorkspace()
    s.tasks.push(newTask('Someday'), newTask('Due soon', { due_at: '2026-10-14T16:00:00+05:30' }))
    expect(planningDeck(s, '2026-10-14')[0].title).toBe('Due soon')
    expect(s.tasks[1].due_at).toBe('2026-10-14T16:00:00+05:30')
  })
})
