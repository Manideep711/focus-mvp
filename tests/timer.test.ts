import { describe, it, expect } from 'vitest'
import { elapsedMilliseconds, pauseTimer } from '../src/state/useFocusTimer'
import type { ActiveTimer } from '../src/domain/types'
const timer: ActiveTimer = {
  task_id: '00000000-0000-4000-8000-000000000001',
  started_at: '2026-10-14T10:00:00Z',
  target_minutes: 25,
  accumulated_ms: 60000,
  running_since: 100000,
  expired: false,
  notes: '',
}
describe('session timing', () => {
  it('counts actual wall time across background tabs', () => {
    expect(elapsedMilliseconds(timer, 160000)).toBe(120000)
  })
  it('does not count paused time', () => {
    const paused = pauseTimer(timer, 160000)
    expect(elapsedMilliseconds(paused, 900000)).toBe(120000)
  })
  it('caps expired sessions instead of claiming unattended time', () => {
    const paused = pauseTimer(timer, 100000 + 2 * 3600000)
    expect(paused.accumulated_ms).toBe(25 * 60000)
    expect(paused.expired).toBe(true)
    expect(paused.running_since).toBeNull()
  })
  it('does not produce negative time when the system clock moves backward', () => {
    expect(elapsedMilliseconds(timer, 1)).toBe(60000)
  })
})
