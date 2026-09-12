import { cn } from '../../lib/utils.js';

export const STATUS_CLASSES = {
  Enviada: 'bg-info/10 text-info border-info/30',
  'En Proceso - Cliente': 'bg-accent/10 text-[#8a5a10] border-accent/30',
  Aprobada: 'bg-success/10 text-success border-success/30',
  Denegada: 'bg-danger/10 text-danger border-danger/30',
  Sustituida: 'bg-border text-text-secondary border-border'
};

export function Badge({ status, className, children }) {
  return (
    <span className={cn('inline-block rounded-full border px-2 py-0.5 text-xs font-semibold', STATUS_CLASSES[status] || 'bg-border text-text-secondary', className)}>
      {children}
    </span>
  );
}
