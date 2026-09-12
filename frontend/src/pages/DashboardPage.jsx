import { useState } from 'react';
import { useDashboard } from '../api/dashboard.js';
import { KpiCard, DollarIcon, CheckCircleIcon, XCircleIcon, ClockIcon, FlagIcon, TargetIcon } from '../components/kpi/KpiCard.jsx';
import { TrendChart } from '../components/charts/TrendChart.jsx';
import { HorizontalBarChart } from '../components/charts/HorizontalBarChart.jsx';
import { DoughnutChart } from '../components/charts/DoughnutChart.jsx';
import { Card } from '../components/ui/card.jsx';
import { Select } from '../components/ui/select.jsx';
import { Input } from '../components/ui/input.jsx';
import { fmtMoney } from '../lib/utils.js';

const PERIODS = [
  ['semana', 'Semanal'], ['mes', 'Mensual'], ['trimestre', 'Trimestral'], ['semestre', 'Semestral'], ['año', 'Anual'], ['todo', 'Todo']
];

function todayIso() { return new Date().toISOString().slice(0, 10); }

export function DashboardPage() {
  const [period, setPeriod] = useState('mes');
  const [refDate, setRefDate] = useState(todayIso);
  // The trend chart has no filter of its own — it follows the period/refDate
  // picked above (semestre/año/todo fall back to monthly buckets server-side).
  const { data } = useDashboard(period, refDate);

  return (
    <div>
      <div className="mb-4 flex items-end justify-between">
        <h1 className="text-lg font-medium">Dashboard</h1>
        <div className="flex items-end gap-2">
          {period !== 'todo' && (
            <div>
              <label htmlFor="dash_refdate" className="mb-1 block text-xs text-text-secondary">
                {period === 'semana' ? 'Semana de' : period === 'mes' ? 'Mes de' : 'Fecha de referencia'}
              </label>
              <Input id="dash_refdate" type="date" className="w-auto" value={refDate} onChange={(e) => setRefDate(e.target.value)} />
            </div>
          )}
          <Select aria-label="Periodo" className="w-auto" value={period} onChange={(e) => setPeriod(e.target.value)}>
            {PERIODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
        </div>
      </div>
      {data && (
        <>
          <div className="mb-4 grid grid-cols-3 gap-3 md:grid-cols-6">
            <KpiCard label="Cotizado" value={fmtMoney(data.kpis.montoPeriodo)} icon={<DollarIcon />} color="indigo" />
            <KpiCard label="Aprobado (a facturar)" value={fmtMoney(data.kpis.montoAprobado)} icon={<CheckCircleIcon />} color="green" />
            <KpiCard label="Perdido (denegado)" value={fmtMoney(data.kpis.montoPerdido)} icon={<XCircleIcon />} color="red" />
            <KpiCard label="Cierre de cotización" value={data.kpis.avgAprob !== null ? `${data.kpis.avgAprob} días` : '—'} icon={<ClockIcon />} color="amber" />
            <KpiCard label="Cierre de proyecto" value={data.kpis.avgCierre !== null ? `${data.kpis.avgCierre} días` : '—'} icon={<FlagIcon />} color="purple" />
            <KpiCard label="Tasa de aprobación" value={data.kpis.tasa !== null ? `${data.kpis.tasa}%` : '—'} icon={<TargetIcon />} color="orange" />
          </div>
          <Card className="mb-4">
            <h2 className="mb-3 text-sm font-semibold">Tendencia</h2>
            <TrendChart data={data.tendencia} />
          </Card>
          <div className="mb-4 grid grid-cols-3 gap-3">
            <Card>
              <h2 className="mb-3 text-sm font-semibold">Cotizado por cliente</h2>
              {data.clientes.length ? <HorizontalBarChart data={data.clientes.map(([n, v]) => [n, v.monto])} /> : <p className="text-sm text-text-secondary">Sin cotizaciones en este periodo.</p>}
            </Card>
            <Card>
              <h2 className="mb-3 text-sm font-semibold">Líneas de servicio</h2>
              {data.lineas.length ? <DoughnutChart data={data.lineas} /> : <p className="text-sm text-text-secondary">Sin cotizaciones en este periodo.</p>}
            </Card>
            <Card>
              <h2 className="mb-3 text-sm font-semibold">Ranking de ejecutivos</h2>
              {data.ejecutivos.map(([name, stats]) => (
                <div key={name} className="flex items-center justify-between border-t border-border py-2 text-sm first:border-t-0">
                  <span>{name}</span>
                  <span className="text-text-secondary">{fmtMoney(stats.monto)} · {stats.count} cotiz.</span>
                </div>
              ))}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
