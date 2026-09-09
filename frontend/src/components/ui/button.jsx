import { forwardRef } from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils.js';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md border font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none',
  {
    variants: {
      variant: {
        default: 'bg-paper border-border-strong text-ink hover:bg-muted',
        primary: 'bg-gradient-to-br from-[#9678de] to-ui-accent border-ui-accent text-white hover:opacity-90',
        danger: 'bg-paper border-danger text-danger hover:bg-danger/5'
      },
      size: {
        default: 'px-3.5 py-2 text-sm',
        small: 'px-2.5 py-1 text-xs'
      }
    },
    defaultVariants: { variant: 'default', size: 'default' }
  }
);

export const Button = forwardRef(function Button({ className, variant, size, ...props }, ref) {
  return <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});
