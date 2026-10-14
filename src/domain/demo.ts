import { emptyWorkspace, newTask, commitTask } from './workspace'
import { baseRecord, localDate } from './dates'
export function exampleWorkspace() {
  const s = emptyWorkspace()
  const today = localDate(new Date(), s.preferences.timezone)
  const learning = {
    ...baseRecord(),
    title: 'Build a backend I understand',
    why: 'Feel confident turning an idea into something that works.',
    status: 'active' as const,
    target_date: null,
    resume_date: null,
    notes: 'Use my existing course. Learn by building, one small piece at a time.',
    source_inbox_id: null,
  }
  const writing = {
    ...baseRecord(),
    title: 'Make space for creative work',
    why: 'Good ideas deserve time outside my head.',
    status: 'active' as const,
    target_date: null,
    resume_date: null,
    notes: '',
    source_inbox_id: null,
  }
  s.goals.push(learning, writing)
  const course = {
    ...baseRecord(),
    title: 'Spring Boot course',
    type: 'course' as const,
    url: '',
    progress: 14,
    total_units: 40,
    unit_label: 'videos',
    target_date: null,
    goal_id: learning.id,
    project_id: null,
    notes: 'An example resource. Replace this with something you chose.',
    source_inbox_id: null,
  }
  s.resources.push(course)
  const study = newTask('Work through the next course lesson', {
    estimate_minutes: 45,
    goal_id: learning.id,
    resource_id: course.id,
    description: 'Watch one lesson, then run its example in the project.',
    resume_note: 'Start with video 15. The example project is ready.',
    energy: 'steady',
  })
  const draft = newTask('Outline the idea for my next article', {
    estimate_minutes: 30,
    goal_id: writing.id,
    energy: 'high',
  })
  const walk = newTask('Take a walk without my phone', {
    estimate_minutes: 20,
    energy: 'low',
    description: 'A little room to think, outside.',
  })
  const small = newTask('Reply to the two open messages', { estimate_minutes: 10, energy: 'low' })
  s.tasks.push(study, draft, walk, small)
  ;[study, draft, walk].forEach((t) => commitTask(s, t.id, today))
  s.plans[0].anchor_task_id = study.id
  s.plans[0].available_minutes = 150
  s.inbox.push({
    ...baseRecord(),
    text: 'I have an idea for a small tool that helps me organize the books I want to read. Not sure if I want to build it yet.',
    kind: 'idea',
    status: 'unprocessed',
    interpretation: '',
  })
  return s
}
