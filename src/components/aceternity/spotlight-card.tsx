import { useState, type ComponentProps } from 'react'
import { cn } from '../../lib/utils'

/** Lightweight Aceternity card-spotlight pattern, using CSS rather than a canvas effect. */
export function SpotlightCard({
  className,
  children,
  onPointerMove,
  onPointerLeave,
  ...props
}: ComponentProps<'article'>) {
  const [spot, setSpot] = useState({ x: 50, y: 50, active: false })
  return (
    <article
      className={cn('spotlight-card', className)}
      onPointerMove={(e) => {
        if (e.pointerType !== 'touch') {
          const rect = e.currentTarget.getBoundingClientRect()
          setSpot({
            x: ((e.clientX - rect.left) / rect.width) * 100,
            y: ((e.clientY - rect.top) / rect.height) * 100,
            active: true,
          })
        }
        onPointerMove?.(e)
      }}
      onPointerLeave={(e) => {
        setSpot((s) => ({ ...s, active: false }))
        onPointerLeave?.(e)
      }}
      {...props}
    >
      <span
        className="card-spotlight"
        aria-hidden="true"
        style={{
          background: `radial-gradient(350px circle at ${spot.x}% ${spot.y}%, rgba(193, 206, 166, .065), transparent 70%)`,
          opacity: spot.active ? 1 : 0,
        }}
      />
      {children}
    </article>
  )
}
