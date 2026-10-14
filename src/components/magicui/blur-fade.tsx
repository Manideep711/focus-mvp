import { motion, useReducedMotion } from 'motion/react'
import type { ComponentProps } from 'react'
import { cn } from '../../lib/utils'

/** Magic UI Blur Fade pattern, tuned for a short, calm entrance with reduced-motion support. */
export function BlurFade({
  children,
  className,
  delay = 0,
  ...props
}: ComponentProps<typeof motion.div> & { delay?: number }) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      className={cn(className)}
      initial={reduced ? false : { opacity: 0, y: 5, filter: 'blur(2px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{
        duration: reduced ? 0 : 0.3,
        delay: reduced ? 0 : delay,
        ease: [0.22, 1, 0.36, 1],
      }}
      {...props}
    >
      {children}
    </motion.div>
  )
}
