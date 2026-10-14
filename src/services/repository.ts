import type { Workspace } from '../domain/types'
import { emptyWorkspace } from '../domain/workspace'
import { workspaceSchema } from '../domain/validation'
import { supabase } from './supabase'
export const LOCAL_KEY = 'focus.workspace.v1'
export interface Repository {
  load(): Promise<Workspace>
  save(state: Workspace, expectedRevision: number): Promise<number>
  mode: 'local' | 'cloud'
}
export const localRepository: Repository = {
  mode: 'local',
  async load() {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (!raw) return emptyWorkspace()
    let decoded: unknown
    try {
      decoded = JSON.parse(raw)
    } catch {
      throw new Error(
        'This local workspace could not be read. Your stored data has been preserved. Export it before resetting.',
      )
    }
    const parsed = workspaceSchema.safeParse(decoded)
    if (!parsed.success)
      throw new Error(
        'This local workspace could not be read. Your stored data has been preserved. Export it before resetting.',
      )
    return parsed.data
  },
  async save(state, expectedRevision) {
    const save = () => {
      const raw = localStorage.getItem(LOCAL_KEY)
      const revision = raw ? workspaceSchema.parse(JSON.parse(raw)).revision : 0
      if (revision !== expectedRevision)
        throw new Error(
          'This workspace changed in another tab. Reload to see those changes before editing.',
        )
      const next = workspaceSchema.parse({ ...state, revision: revision + 1 })
      localStorage.setItem(LOCAL_KEY, JSON.stringify(next))
      return next.revision
    }
    // Serialize read/check/write across same-origin tabs on browsers with Web Locks.
    return navigator.locks ? navigator.locks.request(LOCAL_KEY, save) : save()
  },
}
export const cloudRepository: Repository = {
  mode: 'cloud',
  async load() {
    if (!supabase) throw new Error('Supabase is not configured.')
    const { data, error } = await supabase.rpc('load_workspace')
    if (error) throw new Error(`Could not load your workspace: ${error.message}`)
    return data === null ? emptyWorkspace() : workspaceSchema.parse(data)
  },
  async save(state, expectedRevision) {
    if (!supabase) throw new Error('Supabase is not configured.')
    const { data, error } = await supabase.rpc('save_workspace', {
      workspace: workspaceSchema.parse(state),
      expected_revision: expectedRevision,
    })
    if (error)
      throw new Error(
        error.message.includes('revision conflict')
          ? 'Your workspace changed on another device. Reload before editing.'
          : `Could not save: ${error.message}`,
      )
    return Number(data)
  },
}
export function downloadJSON(value: unknown, filename: string) {
  const url = URL.createObjectURL(
    new Blob([typeof value === 'string' ? value : JSON.stringify(value, null, 2)], {
      type: 'application/json',
    }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
