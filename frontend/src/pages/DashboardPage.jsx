import { useState } from 'react';
import { useDashboard } from '../api/dashboard.js';
import { KpiCard } from '../components/kpi/KpiCard.jsx';
import { TrendChart } from '../components/charts/TrendChart.jsx';
import { HorizontalBarChart } from '../components/charts/HorizontalBarChart.jsx';
import { DoughnutChart } from '../components/charts/DoughnutChart.jsx';
import { Card } from '../components/ui/card.jsx';
import { Select } from '../components/ui/select.jsx';
import { fmtMoney } from '../lib/utils.js';

const PERIODS = [
  ['mes', 'Mensual'], ['trimestre', 'Trimestral'], ['semestre', 'Semestral'], ['año', 'Anual'], ['todo', 'Todo']
];

export function DashboardPage() {
  const [period, setPeriod] = useState('mes');
  const { data } = useDashboard(period);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-medium">Dashboard</h1>
        <Select aria-label="Periodo" className="w-auto" value={period} onChange={(e) => setPeriod(e.target.value)}>
          {PERIODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
      </div>
      {data && (
        <>
          <div className="mb-4 grid grid-cols-3 gap-3 md:grid-cols-6">
            <KpiCard label="Cotizado" value={fmtMoney(data.kpis.montoPeriodo)} />
            <KpiCard label="Aprobado (a facturar)" value={fmtMoney(data.kpis.montoAprobado)} />
            <KpiCard label="Perdido (denegado)" value={fmtMoney(data.kpis.montoPerdido)} />
            <KpiCard label="Cierre de cotización" value={data.kpis.avgAprob !== null ? `${data.kpis.avgAprob} días` : '—'} />
            <KpiCard label="Cierre de proyecto" value={data.kpis.avgCierre !== null ? `${data.kpis.avgCierre} días` : '—'} />
            <KpiCard label="Tasa de aprobación" value={data.kpis.tasa !== null ? `${data.kpis.tasa}%` : '—'} />
          </div>
          <Card className="mb-4">
            <h2 className="mb-3 text-sm font-semibold">Tendencia — últimos 6 meses</h2>
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
