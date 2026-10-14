import { describe, it, expect } from 'vitest'
import {
  emptyWorkspace,
  newTask,
  commitTask,
  planSummary,
  recordWork,
  suggestTasks,
  replan,
} from '../src/domain/workspace'
import { localDate, nextDate, baseRecord } from '../src/domain/dates'

describe('attention and planning rules', () => {
  it('suggests the remaining daily portion rather than the whole task', () => {
    const s = emptyWorkspace()
    const date = localDate(new Date(), s.preferences.timezone)
    const task = newTask('Continue the course', { estimate_minutes: 120 })
    s.tasks.push(task)
    commitTask(s, task.id, date, 30)
    recordWork(s, task.id, 'progress', 900, '', '', new Date().toISOString(), null, 'manual')
    const before = JSON.stringify(s)
    const result = suggestTasks(s, date, 'quick', new Date(), { availableMinutes: 15 })[0]
    expect(result.remainingMinutes).toBe(15)
    expect(result.fits).toBe(true)
    expect(result.committed).toBe(true)
    expect(JSON.stringify(s)).toBe(before)
  })
  it('does not promise a fit when the planned portion is used or the day has no room', () => {
    const s = emptyWorkspace()
    const date = localDate(new Date(), s.preferences.timezone)
    const task = newTask('Keep writing', { estimate_minutes: 15 })
    s.tasks.push(task)
    commitTask(s, task.id, date)
    s.plans[0].available_minutes = 15
    recordWork(s, task.id, 'progress', 900, '', '', new Date().toISOString(), null, 'manual')
    expect(suggestTasks(s, date, 'plan')[0].fits).toBeNull()
    expect(suggestTasks(s, date, 'quick')).toEqual([])
    const another = newTask('Call', { estimate_minutes: 5 })
    s.tasks.push(another)
    expect(suggestTasks(s, date, 'quick')[0].fits).toBe(false)
  })
  it('respects plan order and rotates surprise choices without changing commitments', () => {
    const s = emptyWorkspace()
    const a = newTask('First', { estimate_minutes: 10 })
    const b = newTask('Second', { estimate_minutes: 10 })
    s.tasks.push(a, b)
    commitTask(s, b.id, '2026-10-14')
    commitTask(s, a.id, '2026-10-14')
    expect(suggestTasks(s, '2026-10-14', 'plan')[0].task.id).toBe(b.id)
    expect(suggestTasks(s, '2026-10-14', 'surprise', new Date(), { variation: 1 })[0].task.id).toBe(
      a.id,
    )
    expect(s.commitments).toHaveLength(2)
  })
  it('excludes blocked actions and work under completed projects', () => {
    const s = emptyWorkspace()
    const project = {
      ...baseRecord(),
      title: 'Closed',
      goal_id: null,
      notes: '',
      status: 'completed' as const,
      source_inbox_id: null,
    }
    s.projects.push(project)
    s.tasks.push(
      newTask('Blocked', { blocker: 'Need access' }),
      newTask('Closed project', { project_id: project.id }),
      newTask('Ready'),
    )
    expect(suggestTasks(s, '2026-10-14', 'surprise')[0].task.title).toBe('Ready')
  })
  it('stores a task separately from commitments and prevents duplicate commitments', () => {
    const s = emptyWorkspace()
    const task = newTask('Write a proposal', { estimate_minutes: 120 })
    s.tasks.push(task)
    commitTask(s, task.id, '2026-10-14', 30)
    commitTask(s, task.id, '2026-10-14', 30)
    expect(s.tasks).toHaveLength(1)
    expect(s.commitments).toHaveLength(1)
    expect(s.tasks[0].estimate_minutes).toBe(120)
    expect(s.commitments[0].planned_minutes).toBe(30)
  })
  it('records partial progress without completing a task or double-counting time', () => {
    const s = emptyWorkspace()
    const date = localDate(new Date(), s.preferences.timezone)
    const t = newTask('Read', { estimate_minutes: 60 })
    s.tasks.push(t)
    commitTask(s, t.id, date)
    s.plans[0].available_minutes = 90
    recordWork(
      s,
      t.id,
      'progress',
      1200,
      'Read a section',
      'Next chapter',
      new Date().toISOString(),
      25,
      'timer',
    )
    const summary = planSummary(s, date)
    expect(t.status).toBe('active')
    expect(summary.remainingCapacity).toBe(70)
    expect(summary.remainingWork).toBe(40)
    expect(t.resume_note).toBe('Next chapter')
  })
  it('preserves historical plans when a task is completed today', () => {
    const s = emptyWorkspace()
    const today = localDate(new Date(), s.preferences.timezone)
    const t = newTask('Call')
    s.tasks.push(t)
    commitTask(s, t.id, '2020-01-01')
    commitTask(s, t.id, today)
    recordWork(s, t.id, 'completed', 300, '', '', new Date().toISOString(), null, 'manual')
    expect(s.commitments[0].status).toBe('planned')
    expect(s.commitments[1].status).toBe('completed')
  })
  it('preserves context when moving a commitment to tomorrow', () => {
    const s = emptyWorkspace()
    const t = newTask('Draft', { resume_note: 'Start with introduction' })
    s.tasks.push(t)
    commitTask(s, t.id, '2026-12-31', 25)
    replan(s, s.commitments[0], 'tomorrow', 'An emergency interrupted me')
    expect(s.commitments[0].status).toBe('moved')
    expect(s.commitments[0].reason).toContain('emergency')
    expect(s.plans[1].date).toBe('2027-01-01')
    expect(s.tasks[0].resume_note).toBe('Start with introduction')
  })
  it('excludes paused goals, waiting tasks, and completed work from suggestions', () => {
    const s = emptyWorkspace()
    const goal = {
      ...baseRecord(),
      title: 'Learn',
      why: '',
      status: 'paused' as const,
      target_date: null,
      resume_date: null,
      notes: '',
      source_inbox_id: null,
    }
    s.goals.push(goal)
    s.tasks.push(
      newTask('Paused', { goal_id: goal.id, estimate_minutes: 10 }),
      newTask('Blocked', { status: 'waiting', estimate_minutes: 10 }),
      newTask('Done', { status: 'done', estimate_minutes: 10 }),
      newTask('Small', { estimate_minutes: 10 }),
    )
    expect(suggestTasks(s, '2026-10-14', 'quick').map((x) => x.task.title)).toEqual(['Small'])
  })
  it('handles local dates and rollover without UTC day drift', () => {
    expect(localDate(new Date('2026-10-14T20:00:00Z'), 'Asia/Kolkata')).toBe('2026-10-15')
    expect(localDate(new Date('2026-10-14T01:00:00Z'), 'America/Los_Angeles')).toBe('2026-10-13')
    expect(nextDate('2028-02-28')).toBe('2028-02-29')
  })
})
