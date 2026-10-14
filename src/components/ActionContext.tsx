export function ActionContext({ text, className }: { text: string; className?: string }) {
  if (text.length <= 220) return <p className={className}>{text}</p>
  return (
    <div>
      <p className={className}>{text.slice(0, 220).trimEnd()}…</p>
      <details className="action-context-details">
        <summary>Full context</summary>
        <p>{text}</p>
      </details>
    </div>
  )
}
