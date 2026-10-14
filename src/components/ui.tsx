import { useRef, type ReactNode } from 'react'
import { X, ArrowUpRight, Leaf } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from './primitives/dialog'
import { Button } from './primitives/button'
import { BlurFade } from './magicui/blur-fade'

export function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  onClose(): void
  wide?: boolean
}) {
  const previousFocus = useRef(document.activeElement as HTMLElement | null)
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent
        className={wide ? 'wide' : ''}
        {...(!subtitle ? { 'aria-describedby': undefined } : {})}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          if (previousFocus.current?.isConnected) previousFocus.current.focus()
        }}
      >
        <div className="modal-body">
          <div className="modal-heading">
            <div>
              <DialogTitle asChild>
                <h2>{title}</h2>
              </DialogTitle>
              {subtitle && <DialogDescription className="muted mt-2">{subtitle}</DialogDescription>}
            </div>
            <DialogClose asChild>
              <button type="button" className="icon-button dialog-close" aria-label="Close dialog">
                <X size={20} />
              </button>
            </DialogClose>
          </div>
          {children}
        </div>
      </DialogContent>
    </Dialog>
  )
}
export function Empty({
  title,
  body,
  children,
}: {
  title: string
  body: string
  children?: ReactNode
}) {
  return (
    <div className="empty-state">
      <div className="empty-symbol">
        <Leaf size={27} strokeWidth={1.3} />
      </div>
      <h3>{title}</h3>
      <p>{body}</p>
      {children}
    </div>
  )
}
export function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string
  title: string
  description: string
  children?: ReactNode
}) {
  return (
    <BlurFade>
      <header className="page-heading">
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h1>{title}</h1>
          <p className="muted">{description}</p>
        </div>
        {children}
      </header>
    </BlurFade>
  )
}
export function SectionHeading({
  title,
  meta,
  children,
}: {
  title: string
  meta?: string
  children?: ReactNode
}) {
  return (
    <div className="section-heading">
      <h2>
        {title}
        {meta && <span className="section-meta">{meta}</span>}
      </h2>
      {children}
    </div>
  )
}
export function TextLink({ children, onClick }: { children: ReactNode; onClick(): void }) {
  return (
    <button className="text-link" onClick={onClick}>
      {children}
      <ArrowUpRight size={15} />
    </button>
  )
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: ReactNode
  hint?: string
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  )
}
export function ConfirmDelete({
  title,
  body,
  onDelete,
  onClose,
}: {
  title: string
  body: string
  onDelete(): Promise<boolean>
  onClose(): void
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="muted">{body}</p>
      <div className="form-actions">
        <Button variant="outline" onClick={onClose}>
          Keep it
        </Button>
        <Button
          variant="destructive"
          onClick={async () => {
            if (await onDelete()) onClose()
          }}
        >
          Delete permanently
        </Button>
      </div>
    </Modal>
  )
}
