import { Card } from '../ui/card.jsx';
import { cn } from '../../lib/utils.js';

const ICON_PROPS = {
  width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true
};

export function DollarIcon() {
  return (
    <svg {...ICON_PROPS}>
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

export function CheckCircleIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

export function XCircleIcon() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

export function ClockIcon() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

export function FlagIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  );
}

export function TargetIcon() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

const COLOR_CLASSES = {
  indigo: 'bg-ui-accent/10 text-ui-accent',
  green: 'bg-success/10 text-success',
  red: 'bg-danger/10 text-danger',
  amber: 'bg-accent/10 text-[#8a5a10]',
  purple: 'bg-ui-accent/10 text-ui-accent',
  orange: 'bg-accent/10 text-accent'
};

function DeltaArrow({ direction }) {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      {direction === 'up' ? <path d="M12 4l8 10H4z" /> : <path d="M12 20L4 10h16z" />}
    </svg>
  );
}

// `invert` flips which direction reads as "good" — for a días metric, a
// lower number (negative delta) is the improvement, not a higher one.
function DeltaBadge({ delta, unit = '%', invert = false }) {
  if (delta === null || delta === undefined) return null;
  const isUp = delta > 0;
  const isDown = delta < 0;
  const good = invert ? isDown : isUp;
  const bad = invert ? isUp : isDown;
  const colorClass = good ? 'text-success' : bad ? 'text-danger' : 'text-text-secondary';
  const sign = delta > 0 ? '+' : '';
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-xs font-medium', colorClass)} title="vs. periodo anterior">
      {isUp && <DeltaArrow direction="up" />}
      {isDown && <DeltaArrow direction="down" />}
      {sign}{delta}{unit}
    </span>
  );
}

export function KpiCard({ label, value, icon, color = 'indigo', delta, deltaUnit, invert }) {
  return (
    <Card className="flex items-center gap-3">
      {icon && (
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', COLOR_CLASSES[color])}>
          {icon}
        </div>
      )}
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-xs text-text-secondary">{label}</span>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-lg font-semibold">{value}</span>
          <DeltaBadge delta={delta} unit={deltaUnit} invert={invert} />
        </div>
      </div>
    </Card>
  );
}
