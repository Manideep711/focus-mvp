import { z } from 'zod'
const id = z.string().uuid()
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const stamp = z.string().datetime({ offset: true })
const short = z.string().max(500)
const text = z.string().max(20000)
const energy = z.enum(['low', 'steady', 'high'])
const base = { id, created_at: stamp, updated_at: stamp }
const nullableId = id.nullable()
export const taskSchema = z.object({
  ...base,
  title: short.min(1),
  description: text,
  status: z.enum(['active', 'waiting', 'later', 'done', 'archived']),
  estimate_minutes: z.number().int().min(1).max(1440).nullable(),
  energy,
  goal_id: nullableId,
  project_id: nullableId,
  resource_id: nullableId,
  source_inbox_id: nullableId,
  is_emergency: z.boolean(),
  due_at: stamp.nullable(),
  resume_note: text,
  blocker: text,
  follow_up_date: date.nullable(),
  completed_at: stamp.nullable(),
})
export const workspaceSchema = z.object({
  schema_version: z.literal(1),
  revision: z.number().int().nonnegative(),
  preferences: z.object({
    name: z.string().max(80),
    timezone: z.string().refine((v) => {
      try {
        new Intl.DateTimeFormat('en', { timeZone: v })
        return true
      } catch {
        return false
      }
    }, 'Choose a valid IANA timezone.'),
    weekly_note: text,
  }),
  tasks: z.array(taskSchema),
  goals: z.array(
    z.object({
      ...base,
      title: short.min(1),
      why: text,
      status: z.enum(['idea', 'active', 'later', 'paused', 'completed', 'archived']),
      target_date: date.nullable(),
      resume_date: date.nullable(),
      notes: text,
      source_inbox_id: nullableId,
    }),
  ),
  projects: z.array(
    z.object({
      ...base,
      title: short.min(1),
      goal_id: nullableId,
      notes: text,
      status: z.enum(['active', 'completed', 'archived']),
      source_inbox_id: nullableId,
    }),
  ),
  resources: z.array(
    z
      .object({
        ...base,
        title: short.min(1),
        type: z.enum(['course', 'book', 'documentation', 'video', 'other']),
        url: z
          .string()
          .max(2000)
          .refine((v) => !v || /^https?:\/\//i.test(v), 'Use an http or https URL.'),
        progress: z.number().int().nonnegative(),
        total_units: z.number().int().positive().nullable(),
        unit_label: z.string().max(80),
        target_date: date.nullable(),
        goal_id: nullableId,
        project_id: nullableId,
        notes: text,
        source_inbox_id: nullableId,
      })
      .refine(
        (r) => r.total_units === null || r.progress <= r.total_units,
        'Progress cannot exceed total units.',
      ),
  ),
  phases: z.array(
    z.object({
      ...base,
      title: short.min(1),
      goal_id: id,
      position: z.number().int().nonnegative(),
      completed: z.boolean(),
    }),
  ),
  inbox: z.array(
    z.object({
      ...base,
      text: text.min(1),
      status: z.enum(['unprocessed', 'organized', 'archived']),
      kind: z.enum(['thought', 'idea', 'note']),
      interpretation: text,
    }),
  ),
  plans: z.array(
    z.object({
      ...base,
      date,
      available_minutes: z.number().int().min(0).max(1440),
      energy,
      anchor_task_id: nullableId,
    }),
  ),
  commitments: z.array(
    z.object({
      ...base,
      task_id: id,
      plan_id: id,
      position: z.number().int().nonnegative(),
      planned_minutes: z.number().int().min(1).max(1440).nullable(),
      scheduled_time: z
        .string()
        .regex(/^\d{2}:\d{2}$/)
        .nullable(),
      status: z.enum(['planned', 'completed', 'moved', 'removed']),
      reason: text,
    }),
  ),
  sessions: z.array(
    z.object({
      ...base,
      task_id: id,
      started_at: stamp,
      ended_at: stamp,
      duration_seconds: z.number().int().min(0).max(604800),
      planned_minutes: z.number().int().min(1).max(1440).nullable(),
      outcome: z.enum(['completed', 'progress', 'stopped']),
      notes: text,
      resume_note: text,
      mode: z.enum(['timer', 'manual']),
    }),
  ),
  reviews: z.array(
    z.object({ ...base, plan_id: id, reflection: text, kind: z.enum(['daily', 'weekly']) }),
  ),
  events: z.array(
    z.object({ ...base, task_id: nullableId, plan_id: nullableId, kind: short, note: text }),
  ),
})
