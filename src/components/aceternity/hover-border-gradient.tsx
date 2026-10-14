import type { ComponentProps, ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '../../lib/utils'

/** Aceternity hover-border-gradient pattern; a quiet highlight instead of a looping beam. */
export function HoverBorderGradient({
  children,
  className,
  ...props
}: Omit<ComponentProps<typeof motion.button>, 'children'> & { children: ReactNode }) {
  const reduced = useReducedMotion()
  return (
    <motion.button
      type="button"
      whileHover={reduced ? undefined : { y: -1 }}
      whileTap={reduced ? undefined : { scale: 0.99 }}
      className={cn('hover-border-button', className)}
      {...props}
    >
      <span className="hover-border-light" aria-hidden="true" />
      <span className="hover-border-content">{children}</span>
    </motion.button>
  )
}
