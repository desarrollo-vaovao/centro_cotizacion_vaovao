import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuotations, useUpdateQuotation } from '../api/quotations.js';
import { useClients } from '../api/clients.js';
import { useExecutives } from '../api/executives.js';
import { Card } from '../components/ui/card.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { Select } from '../components/ui/select.jsx';
import { Button } from '../components/ui/button.jsx';
import { fmtMoney, fmtDate } from '../lib/utils.js';

const STATUSES = ['Enviada', 'En Proceso - Cliente', 'Aprobada', 'Denegada'];

export function HistorialPage() {
  const [filterClient, setFilterClient] = useState('');
  const [filterExecutive, setFilterExecutive] = useState('');
  const [filterEstatus, setFilterEstatus] = useState('');
  const { data: clients = [] } = useClients();
  const { data: executives = [] } = useExecutives();
  const { data: quotations = [] } = useQuotations({
    clientId: filterClient || undefined,
    executiveId: filterExecutive || undefined,
    estatus: filterEstatus || undefined
  });
  const updateQuotation = useUpdateQuotation();

  const clientName = (id) => clients.find((c) => c.id === id)?.name || '—';
  const executiveName = (id) => executives.find((e) => e.id === id)?.name || '—';

  return (
    <div>
      <h1 className="mb-4 text-lg font-medium">Historial de cotizaciones</h1>
      <div className="mb-3 flex gap-2">
        <Select aria-label="Filtrar por cliente" className="w-auto" value={filterClient} onChange={(e) => setFilterClient(e.target.value)}>
          <option value="">Todos los clientes</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Select aria-label="Filtrar por ejecutivo" className="w-auto" value={filterExecutive} onChange={(e) => setFilterExecutive(e.target.value)}>
          <option value="">Todos los ejecutivos</option>
          {executives.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </Select>
        <Select aria-label="Filtrar por estatus" className="w-auto" value={filterEstatus} onChange={(e) => setFilterEstatus(e.target.value)}>
          <option value="">Todos los estatus</option>
          {STATUSES.concat(['Sustituida']).map((s) => <option key={s}>{s}</option>)}
        </Select>
      </div>
      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-text-secondary">
              <th className="pb-2">Correlativo</th><th>Fecha</th><th>Cliente</th><th>Proyecto</th>
              <th>Ejecutivo</th><th>Línea</th><th>Total</th><th>Estatus</th><th></th>
            </tr>
          </thead>
          <tbody>
            {quotations.map((q) => {
              const superseded = q.estatus === 'Sustituida';
              return (
                <tr key={q.id} className={`border-t border-border ${superseded ? 'text-text-secondary' : ''}`}>
                  <td className="py-1.5">{q.correlativoGeneral}{q.version > 1 ? ` v${q.version}` : ''}</td>
                  <td>{fmtDate(q.fecha)}</td>
                  <td>{q.clientId ? clientName(q.clientId) : (q.clienteNombreLibre || '—')}</td>
                  <td>{q.proyecto}</td>
                  <td>{executiveName(q.executiveId)}</td>
                  <td>{q.lineaServicio}</td>
                  <td>{fmtMoney(q.monto + q.impuestos, q.moneda)}</td>
                  <td>
                    {superseded ? (
                      <Badge status="Sustituida">Sustituida</Badge>
                    ) : (
                      <Select
                        aria-label={`Estatus de ${q.correlativoGeneral}`}
                        className="w-auto"
                        value={q.estatus}
                        onChange={(e) => updateQuotation.mutate({ id: q.id, estatus: e.target.value })}
                      >
                        {STATUSES.map((s) => <option key={s}>{s}</option>)}
                      </Select>
                    )}
                  </td>
                  <td className="whitespace-nowrap">
                    <Link to={`/cotizacion/${q.id}`}><Button size="small">Ver</Button></Link>
                    {q.estatus === 'Enviada' && (
                      <Link to={`/ajustar/${q.id}`} className="ml-1.5"><Button size="small">Ajustar</Button></Link>
                    )}
                  </td>
                </tr>
              );
            })}
            {!quotations.length && (
              <tr><td colSpan={9} className="py-6 text-center text-text-secondary">No hay cotizaciones con estos filtros.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
