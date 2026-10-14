import type { ComponentProps } from 'react'
import { cn } from '../../lib/utils'
export function Card({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="card" className={cn('surface-card', className)} {...props} />
}
export function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="card-header" className={cn('surface-card-header', className)} {...props} />
}
export function CardTitle({ className, ...props }: ComponentProps<'h3'>) {
  return <h3 data-slot="card-title" className={cn('surface-card-title', className)} {...props} />
}
export function CardDescription({ className, ...props }: ComponentProps<'p'>) {
  return <p data-slot="card-description" className={cn('muted', className)} {...props} />
}
export function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div data-slot="card-content" className={cn('surface-card-content', className)} {...props} />
  )
}
