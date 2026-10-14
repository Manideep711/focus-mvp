import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { askAI, type AIResult, type AIPurpose } from '../services/ai'

export function AIAssist({
  purpose,
  text,
  onResult,
}: {
  purpose: AIPurpose
  text: string
  onResult(result: AIResult): void
}) {
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return (
    <div className="notice-panel">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles size={14} />
        <strong>Optional AI assistance</strong>
      </div>
      {!consent ? (
        <>
          <p className="small">
            Only the text below will be sent to the configured AI provider. You’ll review and edit
            any suggestions.
          </p>
          <button type="button" className="text-link" onClick={() => setConsent(true)}>
            Review what will be shared
          </button>
        </>
      ) : (
        <>
          <pre className="text-xs whitespace-pre-wrap overflow-auto max-h-40 my-3 text-[#c5cdbb]">
            {text}
          </pre>
          <button
            type="button"
            className="button small secondary"
            disabled={busy || !text.trim()}
            onClick={async () => {
              setBusy(true)
              setError('')
              try {
                onResult(await askAI(purpose, text))
              } catch (e) {
                setError(e instanceof Error ? e.message : 'AI is unavailable. Continue manually.')
              } finally {
                setBusy(false)
              }
            }}
          >
            <Sparkles size={13} />
            {busy ? 'Considering…' : 'Send and get suggestions'}
          </button>
          <button type="button" className="button small subtle" onClick={() => setConsent(false)}>
            Keep this private
          </button>
        </>
      )}
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
