import { useCallback, useEffect, useState } from 'react'
import { z } from 'zod'
import type { ActiveTimer } from '../domain/types'
const timerSchema = z.object({
  task_id: z.string().uuid(),
  started_at: z.string().datetime(),
  target_minutes: z.number().int().min(1).max(1440),
  accumulated_ms: z.number().nonnegative(),
  running_since: z.number().nullable(),
  expired: z.boolean(),
  notes: z.string(),
})
export function elapsedMilliseconds(timer: ActiveTimer, now = Date.now()) {
  return Math.min(
    timer.target_minutes * 60000,
    Math.max(
      0,
      timer.accumulated_ms +
        (timer.running_since === null ? 0 : Math.max(0, now - timer.running_since)),
    ),
  )
}
export function pauseTimer(timer: ActiveTimer, now = Date.now()): ActiveTimer {
  const accumulated_ms = elapsedMilliseconds(timer, now)
  return {
    ...timer,
    accumulated_ms,
    running_since: null,
    expired: accumulated_ms >= timer.target_minutes * 60000,
  }
}
export function useFocusTimer(scope: string) {
  const key = `focus.timer.${scope}`
  const [timer, setTimer] = useState<ActiveTimer | null>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? timerSchema.parse(JSON.parse(raw)) : null
    } catch {
      return null
    }
  })
  const [now, setNow] = useState(Date.now())
  const [storageError, setStorageError] = useState('')
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [])
  useEffect(() => {
    if (
      timer?.running_since !== null &&
      timer &&
      elapsedMilliseconds(timer, now) >= timer.target_minutes * 60000
    )
      setTimer(pauseTimer(timer, now))
  }, [timer, now])
  useEffect(() => {
    try {
      if (timer) localStorage.setItem(key, JSON.stringify(timer))
      else localStorage.removeItem(key)
      setStorageError('')
    } catch {
      setStorageError(
        'This session could not be saved on this device. Keep Focus open until you record the outcome.',
      )
    }
  }, [timer, key])
  const start = useCallback((task_id: string, target_minutes: number) => {
    setTimer({
      task_id,
      target_minutes,
      accumulated_ms: 0,
      running_since: Date.now(),
      started_at: new Date().toISOString(),
      expired: false,
      notes: '',
    })
  }, [])
  const pause = useCallback(() => {
    setTimer((current) => (current ? pauseTimer(current) : null))
  }, [])
  const resume = useCallback(
    () =>
      setTimer((current) =>
        current && !current.expired && current.running_since === null
          ? { ...current, running_since: Date.now() }
          : current,
      ),
    [],
  )
  const elapsed = timer ? elapsedMilliseconds(timer, now) : 0
  return {
    timer,
    elapsed,
    storageError,
    start,
    pause,
    resume,
    clear: () => setTimer(null),
    setNotes: (notes: string) => setTimer((t) => (t ? { ...t, notes } : t)),
    extend: () =>
      setTimer((t) =>
        t
          ? {
              ...t,
              target_minutes: Math.min(1440, t.target_minutes + 15),
              expired: false,
              running_since: Date.now(),
            }
          : t,
      ),
  }
}
export type TimerController = ReturnType<typeof useFocusTimer>
