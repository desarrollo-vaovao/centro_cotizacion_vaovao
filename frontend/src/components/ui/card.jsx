import { cn } from '../../lib/utils.js';

export function Card({ className, children }) {
  return <div className={cn('rounded-xl border border-border bg-paper p-4 shadow-sm', className)}>{children}</div>;
}
