import { cn } from '../../lib/utils.js';

const STATUS_CLASSES = {
  Enviada: 'bg-info/10 text-info',
  'En Proceso - Cliente': 'bg-accent/10 text-[#8a5a10]',
  Aprobada: 'bg-success/10 text-success',
  Denegada: 'bg-danger/10 text-danger',
  Sustituida: 'bg-border text-text-secondary'
};

export function Badge({ status, className, children }) {
  return (
    <span className={cn('inline-block rounded-full px-2 py-0.5 text-xs font-semibold', STATUS_CLASSES[status] || 'bg-border text-text-secondary', className)}>
      {children}
    </span>
  );
}
