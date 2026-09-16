import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useClients } from '../api/clients.js';
import { useClientDashboard } from '../api/dashboard.js';
import { useQuotations } from '../api/quotations.js';
import { Card } from '../components/ui/card.jsx';
import { Select } from '../components/ui/select.jsx';
import { Button } from '../components/ui/button.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { KpiCard, DollarIcon, CheckCircleIcon, XCircleIcon, TargetIcon } from '../components/kpi/KpiCard.jsx';
import { DoughnutChart } from '../components/charts/DoughnutChart.jsx';
import { fmtMoney, fmtDate } from '../lib/utils.js';

export function FichaClientePage() {
  const { data: clients = [] } = useClients();
  const [clientId, setClientId] = useState('');
  const { data } = useClientDashboard(clientId, 'todo');
  const { data: quotations = [] } = useQuotations({ clientId: clientId || undefined }, { enabled: Boolean(clientId) });

  const clientName = clients.find((c) => String(c.id) === String(clientId))?.name;

  return (
    <div>
      <h1 className="mb-4 text-lg font-medium">Ficha de cliente</h1>
      <div className="mb-4 max-w-xs">
        <label htmlFor="f_fichaCliente" className="mb-1 block text-xs font-medium text-text-secondary">Cliente</label>
        <Select id="f_fichaCliente" value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">Selecciona un cliente…</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </div>
      {!clientId && <p className="text-sm text-text-secondary">Selecciona un cliente para ver su histórico.</p>}
      {clientId && data && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard label="Cotizado histórico" value={fmtMoney(data.kpis.montoPeriodo)} icon={<DollarIcon />} color="indigo" />
            <KpiCard label="Aprobado" value={fmtMoney(data.kpis.montoAprobado)} icon={<CheckCircleIcon />} color="green" />
            <KpiCard label="Perdido" value={fmtMoney(data.kpis.montoPerdido)} icon={<XCircleIcon />} color="red" />
            <KpiCard label="Tasa de aprobación" value={data.kpis.tasa !== null ? `${data.kpis.tasa}%` : '—'} icon={<TargetIcon />} color="orange" />
          </div>
          <Card className="mb-4">
            <h2 className="mb-3 text-sm font-semibold">Líneas de servicio</h2>
            {data.lineas.length ? <DoughnutChart data={data.lineas} /> : <p className="text-sm text-text-secondary">Sin cotizaciones registradas.</p>}
          </Card>
          <Card>
            <h2 className="mb-3 text-sm font-semibold">Cotizaciones de {clientName}</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-text-secondary">
                  <th className="pb-2">Correlativo</th><th>Fecha</th><th>Proyecto</th>
                  <th>Línea</th><th>Total</th><th>Estatus</th><th></th>
                </tr>
              </thead>
              <tbody>
                {quotations.map((q) => (
                  <tr key={q.id} className="border-t border-border">
                    <td className="py-1.5">{q.correlativoGeneral}{q.version > 1 ? ` v${q.version}` : ''}</td>
                    <td>{fmtDate(q.fecha)}</td>
                    <td>{q.proyecto}</td>
                    <td>{q.lineaServicio}</td>
                    <td>{fmtMoney(q.monto + q.impuestos, q.moneda)}</td>
                    <td><Badge status={q.estatus}>{q.estatus}</Badge></td>
                    <td className="whitespace-nowrap">
                      <Link to={`/cotizacion/${q.id}`}><Button size="small">Ver</Button></Link>
                    </td>
                  </tr>
                ))}
                {!quotations.length && (
                  <tr><td colSpan={7} className="py-6 text-center text-text-secondary">Este cliente no tiene cotizaciones todavía.</td></tr>
                )}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
