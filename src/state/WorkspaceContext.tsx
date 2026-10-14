import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Workspace } from '../domain/types'
import { localDate } from '../domain/dates'
import { emptyWorkspace } from '../domain/workspace'
import type { Repository } from '../services/repository'
import { LOCAL_KEY } from '../services/repository'

interface Store {
  state: Workspace
  today: string
  saving: boolean
  loading: boolean
  loadFailed: boolean
  error: string
  notice: string
  mode: Repository['mode']
  storageScope: string
  change(fn: (draft: Workspace) => void, message?: string, undoable?: boolean): Promise<boolean>
  undo(): Promise<void>
  canUndo: boolean
  reload(): Promise<void>
  dismiss(): void
}
const Context = createContext<Store | null>(null)
export function WorkspaceProvider({
  repository,
  storageScope,
  children,
}: {
  repository: Repository
  storageScope: string
  children: ReactNode
}) {
  const [state, setState] = useState(emptyWorkspace)
  const current = useRef(state)
  const busy = useRef(false)
  const previous = useRef<Workspace | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [canUndo, setCanUndo] = useState(false)
  const [clock, setClock] = useState(new Date())
  async function reload() {
    if (busy.current) return
    setLoading(true)
    setError('')
    try {
      const next = await repository.load()
      current.current = next
      setState(next)
      previous.current = null
      setCanUndo(false)
      setLoadFailed(false)
    } catch (e) {
      setLoadFailed(true)
      setError(e instanceof Error ? e.message : 'Could not load your workspace.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void reload()
  }, [repository]) // provider is remounted when the account changes
  useEffect(() => {
    const id = window.setInterval(() => setClock(new Date()), 15000)
    return () => clearInterval(id)
  }, [])
  useEffect(() => {
    const listener = (event: StorageEvent) => {
      if (repository.mode === 'local' && event.key === LOCAL_KEY)
        setError('This workspace changed in another tab. Reload to continue safely.')
    }
    window.addEventListener('storage', listener)
    return () => window.removeEventListener('storage', listener)
  }, [repository])
  async function change(fn: (draft: Workspace) => void, message = 'Saved', undoable = true) {
    if (busy.current || loading) return false
    busy.current = true
    setSaving(true)
    setError('')
    setNotice('')
    const before = current.current
    const next = structuredClone(before)
    try {
      fn(next)
      next.revision = await repository.save(next, before.revision)
      previous.current = undoable ? before : null
      setCanUndo(undoable)
      current.current = next
      setState(next)
      setNotice(message)
      return true
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not save. Your previous data is still intact.',
      )
      return false
    } finally {
      busy.current = false
      setSaving(false)
    }
  }
  async function undo() {
    const snapshot = previous.current
    if (!snapshot) return
    await change(
      (draft) => Object.assign(draft, { ...snapshot, revision: draft.revision }),
      'Change undone',
      false,
    )
  }
  return (
    <Context.Provider
      value={{
        state,
        today: localDate(clock, state.preferences.timezone),
        saving,
        loading,
        loadFailed,
        error,
        notice,
        mode: repository.mode,
        storageScope,
        change,
        undo,
        canUndo,
        reload,
        dismiss() {
          setError('')
          setNotice('')
        },
      }}
    >
      {children}
    </Context.Provider>
  )
}
export function useWorkspace() {
  const context = useContext(Context)
  if (!context) throw new Error('WorkspaceProvider missing')
  return context
}
