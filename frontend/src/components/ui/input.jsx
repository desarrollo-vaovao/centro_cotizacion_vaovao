import { forwardRef } from 'react';
import { cn } from '../../lib/utils.js';

export const Input = forwardRef(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        'w-full rounded-md border border-border-strong bg-paper px-2.5 py-1.5 text-sm text-ink placeholder:text-text-secondary focus:outline-none focus:ring-1 focus:ring-ui-accent',
        className
      )}
      {...props}
    />
  );
});

export const Textarea = forwardRef(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        'w-full min-h-[56px] resize-y rounded-md border border-border-strong bg-paper px-2.5 py-1.5 text-sm text-ink placeholder:text-text-secondary focus:outline-none focus:ring-1 focus:ring-ui-accent',
        className
      )}
      {...props}
    />
  );
});
