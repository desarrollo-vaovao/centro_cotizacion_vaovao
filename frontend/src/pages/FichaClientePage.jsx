import { useState } from 'react';
import { useClients } from '../api/clients.js';
import { useClientDashboard } from '../api/dashboard.js';
import { Card } from '../components/ui/card.jsx';
import { Select } from '../components/ui/select.jsx';
import { fmtMoney } from '../lib/utils.js';

export function FichaClientePage() {
  const { data: clients = [] } = useClients();
  const [clientId, setClientId] = useState('');
  const { data } = useClientDashboard(clientId, 'todo');

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
        <div className="grid grid-cols-4 gap-3">
          <Card><p className="text-xs text-text-secondary">Cotizado histórico</p><p className="text-lg font-semibold">{fmtMoney(data.kpis.montoPeriodo)}</p></Card>
          <Card><p className="text-xs text-text-secondary">Aprobado</p><p className="text-lg font-semibold">{fmtMoney(data.kpis.montoAprobado)}</p></Card>
          <Card><p className="text-xs text-text-secondary">Perdido</p><p className="text-lg font-semibold">{fmtMoney(data.kpis.montoPerdido)}</p></Card>
          <Card><p className="text-xs text-text-secondary">Tasa de aprobación</p><p className="text-lg font-semibold">{data.kpis.tasa !== null ? `${data.kpis.tasa}%` : '—'}</p></Card>
        </div>
      )}
    </div>
  );
}
