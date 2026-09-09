import { Card } from '../ui/card.jsx';

export function KpiCard({ label, value }) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-xs text-text-secondary">{label}</span>
      <span className="text-lg font-semibold">{value}</span>
    </Card>
  );
}
