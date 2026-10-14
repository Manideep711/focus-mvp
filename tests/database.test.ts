import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { emptyWorkspace, newTask, commitTask } from '../src/domain/workspace'
import { workspaceSchema } from '../src/domain/validation'
import { baseRecord } from '../src/domain/dates'

const userA = '00000000-0000-4000-8000-000000000001'
const userB = '00000000-0000-4000-8000-000000000002'
let db: PGlite
async function asUser(id: string) {
  await db.exec(`reset role; set role authenticated; set request.jwt.claim.sub = '${id}'`)
}
async function save(state: unknown, revision = 0) {
  return db.query<{ revision: number }>(
    'select public.save_workspace($1::jsonb,$2::bigint) as revision',
    [JSON.stringify(state), revision],
  )
}
beforeAll(async () => {
  db = new PGlite()
  await db.exec(
    `create schema auth; create role anon; create role authenticated; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth,public to authenticated,anon; grant execute on function auth.uid() to authenticated,anon; insert into auth.users values('${userA}'),('${userB}');`,
  )
  await db.exec(
    readFileSync(
      new URL('../supabase/migrations/20261014120826_focus_workspace.sql', import.meta.url),
      'utf8',
    ),
  )
}, 30000)
beforeEach(async () => {
  await db.exec(
    'reset role; truncate public.profiles,public.inbox,public.goals,public.projects,public.resources,public.phases,public.tasks,public.plans,public.commitments,public.sessions,public.reviews,public.events,public.ai_usage cascade',
  )
  await asUser(userA)
})
afterAll(async () => {
  await db?.close()
})
describe('database ownership and atomic persistence', () => {
  it('round-trips a relational workspace with timezone and nullable estimates', async () => {
    const s = emptyWorkspace()
    s.preferences.timezone = 'Asia/Kolkata'
    const t = newTask('My private action')
    s.tasks.push(t)
    commitTask(s, t.id, '2026-10-14')
    const response = await save(s)
    expect(Number(response.rows[0].revision)).toBe(1)
    const result = await db.query<{ workspace: unknown }>(
      'select public.load_workspace() as workspace',
    )
    const loaded = workspaceSchema.parse(result.rows[0].workspace)
    expect(loaded.tasks[0].title).toBe(t.title)
    expect(loaded.commitments[0].task_id).toBe(t.id)
    expect(loaded.preferences.timezone).toBe('Asia/Kolkata')
  })
  it('does not expose, overwrite, or reassign another user’s data', async () => {
    const s = emptyWorkspace()
    const t = newTask('A’s private action')
    s.tasks.push(t)
    await save(s)
    await asUser(userB)
    expect((await db.query('select * from public.tasks')).rows).toHaveLength(0)
    const attack = emptyWorkspace()
    attack.tasks.push({ ...t, title: 'Overwritten' })
    await expect(save(attack)).rejects.toThrow(/row-level security/)
    await asUser(userA)
    await expect(
      db.query('update public.tasks set user_id = $1 where id = $2', [userB, t.id]),
    ).rejects.toThrow(/row-level security/)
    expect(
      (await db.query<{ title: string }>('select title from public.tasks')).rows[0].title,
    ).toBe(t.title)
  })
  it('rejects cross-owner relationships even when the caller knows a goal UUID', async () => {
    const a = emptyWorkspace()
    const goal = {
      ...baseRecord(),
      title: 'Private goal',
      why: '',
      status: 'active',
      target_date: null,
      resume_date: null,
      notes: '',
      source_inbox_id: null,
    }
    a.goals.push(goal as never)
    await save(a)
    await asUser(userB)
    const b = emptyWorkspace()
    b.tasks.push(newTask('Bad link', { goal_id: goal.id }))
    await expect(save(b)).rejects.toThrow(/foreign key/)
    expect((await db.query('select * from public.tasks')).rows).toHaveLength(0)
    expect((await db.query('select * from public.profiles')).rows).toHaveLength(0)
  })
  it('rejects stale saves and keeps the last successful revision intact', async () => {
    const s = emptyWorkspace()
    s.tasks.push(newTask('Keep me'))
    await save(s)
    const stale = emptyWorkspace()
    await expect(save(stale, 0)).rejects.toThrow(/revision conflict/)
    expect((await db.query('select * from public.tasks')).rows).toHaveLength(1)
  })
  it('rejects anonymous access and unbounded progress', async () => {
    await db.exec("reset role; set role anon; set request.jwt.claim.sub = ''")
    await expect(db.query('select * from public.tasks')).rejects.toThrow(/permission denied/)
    await expect(save(emptyWorkspace())).rejects.toThrow(/permission denied/)
    await asUser(userA)
    const s = emptyWorkspace()
    s.resources.push({
      ...baseRecord(),
      title: 'Course',
      type: 'course',
      url: '',
      progress: 50,
      total_units: 40,
      unit_label: 'videos',
      target_date: null,
      goal_id: null,
      project_id: null,
      notes: '',
      source_inbox_id: null,
    })
    await expect(save(s)).rejects.toThrow(/check constraint/)
  })
  it('enforces an atomic AI quota that the browser cannot reset', async () => {
    for (let i = 0; i < 20; i++)
      expect(
        (await db.query<{ allowed: boolean }>('select public.consume_ai_quota() as allowed'))
          .rows[0].allowed,
      ).toBe(true)
    expect(
      (await db.query<{ allowed: boolean }>('select public.consume_ai_quota() as allowed')).rows[0]
        .allowed,
    ).toBe(false)
    await expect(db.exec('delete from public.ai_usage')).rejects.toThrow(/permission denied/)
    await asUser(userB)
    expect(
      (await db.query<{ allowed: boolean }>('select public.consume_ai_quota() as allowed')).rows[0]
        .allowed,
    ).toBe(true)
  })
})
