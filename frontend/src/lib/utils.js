import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function fmtMoney(n, currency = 'GTQ') {
  const value = Number(n) || 0;
  const symbol = currency === 'USD' ? '$' : 'Q';
  return symbol + value.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' });
}
