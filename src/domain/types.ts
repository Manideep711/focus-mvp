export type TaskStatus = 'active' | 'waiting' | 'later' | 'done' | 'archived'
export type GoalStatus = 'idea' | 'active' | 'later' | 'paused' | 'completed' | 'archived'
export type Energy = 'low' | 'steady' | 'high'
export type Outcome = 'completed' | 'progress' | 'stopped'
export interface RecordBase {
  id: string
  created_at: string
  updated_at: string
}
export interface Task extends RecordBase {
  title: string
  description: string
  status: TaskStatus
  estimate_minutes: number | null
  energy: Energy
  goal_id: string | null
  project_id: string | null
  resource_id: string | null
  source_inbox_id: string | null
  is_emergency: boolean
  due_at: string | null
  resume_note: string
  blocker: string
  follow_up_date: string | null
  completed_at: string | null
}
export interface Goal extends RecordBase {
  title: string
  why: string
  status: GoalStatus
  target_date: string | null
  resume_date: string | null
  notes: string
  source_inbox_id: string | null
}
export interface Project extends RecordBase {
  title: string
  goal_id: string | null
  notes: string
  status: 'active' | 'completed' | 'archived'
  source_inbox_id: string | null
}
export interface Resource extends RecordBase {
  title: string
  type: 'course' | 'book' | 'documentation' | 'video' | 'other'
  url: string
  progress: number
  total_units: number | null
  unit_label: string
  target_date: string | null
  goal_id: string | null
  project_id: string | null
  notes: string
  source_inbox_id: string | null
}
export interface Phase extends RecordBase {
  title: string
  goal_id: string
  position: number
  completed: boolean
}
export interface InboxItem extends RecordBase {
  text: string
  status: 'unprocessed' | 'organized' | 'archived'
  kind: 'thought' | 'idea' | 'note'
  interpretation: string
}
export interface DailyPlan extends RecordBase {
  date: string
  available_minutes: number
  energy: Energy
  anchor_task_id: string | null
}
export interface Commitment extends RecordBase {
  task_id: string
  plan_id: string
  position: number
  planned_minutes: number | null
  scheduled_time: string | null
  status: 'planned' | 'completed' | 'moved' | 'removed'
  reason: string
}
export interface FocusSession extends RecordBase {
  task_id: string
  started_at: string
  ended_at: string
  duration_seconds: number
  planned_minutes: number | null
  outcome: Outcome
  notes: string
  resume_note: string
  mode: 'timer' | 'manual'
}
export interface DailyReview extends RecordBase {
  plan_id: string
  reflection: string
  kind: 'daily' | 'weekly'
}
export interface PlanEvent extends RecordBase {
  task_id: string | null
  plan_id: string | null
  kind: string
  note: string
}
export interface Preferences {
  name: string
  timezone: string
  weekly_note: string
}
export interface Workspace {
  schema_version: 1
  revision: number
  preferences: Preferences
  tasks: Task[]
  goals: Goal[]
  projects: Project[]
  resources: Resource[]
  phases: Phase[]
  inbox: InboxItem[]
  plans: DailyPlan[]
  commitments: Commitment[]
  sessions: FocusSession[]
  reviews: DailyReview[]
  events: PlanEvent[]
}
export interface ActiveTimer {
  task_id: string
  started_at: string
  target_minutes: number
  accumulated_ms: number
  running_since: number | null
  expired: boolean
  notes: string
}
