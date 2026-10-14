import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from '../../lib/utils'

// shadcn/Radix composition, with Focus's existing shared Button API and visual tokens.
export const buttonVariants = cva('button', {
  variants: {
    variant: {
      default: '',
      outline: 'secondary',
      secondary: 'secondary',
      ghost: 'subtle',
      destructive: 'danger',
      link: 'button-link',
    },
    size: { default: '', sm: 'small', lg: 'button-large', icon: 'button-icon' },
  },
  defaultVariants: { variant: 'default', size: 'default' },
})
export function Button({
  className,
  variant,
  size,
  asChild = false,
  type = 'button',
  ...props
}: ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      data-slot="button"
      type={asChild ? undefined : type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
}
