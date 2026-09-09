import { forwardRef } from 'react';
import { cn } from '../../lib/utils.js';

export const Select = forwardRef(function Select({ className, children, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        'w-full rounded-md border border-border-strong bg-paper px-2.5 py-1.5 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-ui-accent',
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
});
