import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useClients, useCreateClient } from '../api/clients.js';
import { useExecutives, useCreateExecutive } from '../api/executives.js';
import { useServiceLines } from '../api/serviceLines.js';
import { useCreateQuotation, useAdjustQuotation, useQuotation } from '../api/quotations.js';
import { Card } from '../components/ui/card.jsx';
import { Button } from '../components/ui/button.jsx';
import { Input, Textarea } from '../components/ui/input.jsx';
import { Select } from '../components/ui/select.jsx';
import { DetalleLineList } from '../components/forms/DetalleLineList.jsx';

const COUNTRIES = ['Guatemala', 'El Salvador', 'Honduras', 'Nicaragua', 'Costa Rica', 'Panamá'];

export function NuevaCotizacionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isAdjusting = Boolean(id);
  const { data: source } = useQuotation(id);
  const { data: clients = [] } = useClients();
  const { data: executives = [] } = useExecutives();
  const { data: serviceLines = [] } = useServiceLines();
  const createClient = useCreateClient();
  const createExecutive = useCreateExecutive();
  const createQuotation = useCreateQuotation();
  const adjustQuotation = useAdjustQuotation();

  const [clientId, setClientId] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [newClientCode, setNewClientCode] = useState('');
  const [newClientCountry, setNewClientCountry] = useState(COUNTRIES[0]);
  const [newClientContact, setNewClientContact] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [pais, setPais] = useState(COUNTRIES[0]);
  const [lineaServicio, setLineaServicio] = useState('');
  const [executiveId, setExecutiveId] = useState('');
  const [newExecName, setNewExecName] = useState('');
  const [proyecto, setProyecto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [detalle, setDetalle] = useState(['']);
  const [moneda, setMoneda] = useState('GTQ');
  const [monto, setMonto] = useState('');
  const [impPct, setImpPct] = useState('12');
  const [validezDias, setValidezDias] = useState('30');
  const [error, setError] = useState('');
  const [populatedForId, setPopulatedForId] = useState(null);

  // Adjusting state during render (guarded by comparing to the last-processed
  // source id, not to any of the fields it sets) is React's documented
  // pattern for "reset/populate state when a prop changes" — it avoids the
  // extra render an effect would cause, and — critically — re-runs only when
  // a *different* source quotation loads, never when the user edits clientId
  // or any other field by hand afterwards.
  if (isAdjusting && source && populatedForId !== source.id) {
    setClientId(String(source.clientId || ''));
    setPais(source.pais);
    setLineaServicio(source.lineaServicio);
    setExecutiveId(String(source.executiveId || ''));
    setProyecto(source.proyecto);
    setDescripcion(source.descripcion || '');
    setDetalle(source.detalle);
    setMoneda(source.moneda);
    setMonto(String(source.monto));
    setImpPct(source.monto ? String(Math.round((source.impuestos / source.monto) * 1000) / 10) : '12');
    setValidezDias(String(source.validezDias));
    setPopulatedForId(source.id);
  }

  async function createNewClient() {
    if (!newClientName.trim()) { setError('Ingresa el nombre del cliente nuevo.'); return null; }
    try {
      return await createClient.mutateAsync({
        name: newClientName,
        code: newClientCode,
        country: newClientCountry,
        contactName: newClientContact,
        contactEmail: newClientEmail,
        contactPhone: newClientPhone
      });
    } catch (err) { setError(err.message); return null; }
  }

  async function onSaveNewClient() {
    setError('');
    const created = await createNewClient();
    if (!created) return;
    setClientId(String(created.id));
    setNewClientName(''); setNewClientCode(''); setNewClientCountry(COUNTRIES[0]);
    setNewClientContact(''); setNewClientEmail(''); setNewClientPhone('');
  }

  async function createNewExecutive() {
    if (!newExecName.trim()) { setError('Ingresa el nombre del ejecutivo nuevo.'); return null; }
    try {
      return await createExecutive.mutateAsync({ name: newExecName });
    } catch (err) { setError(err.message); return null; }
  }

  async function onSaveNewExecutive() {
    setError('');
    const created = await createNewExecutive();
    if (!created) return;
    setExecutiveId(String(created.id));
    setNewExecName('');
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');

    let finalClientId = clientId;
    if (clientId === '__new__') {
      const created = await createNewClient();
      if (!created) return;
      finalClientId = String(created.id);
    } else if (!clientId) {
      setError('Selecciona o crea un cliente.'); return;
    }

    let finalExecutiveId = executiveId;
    if (executiveId === '__new__') {
      const created = await createNewExecutive();
      if (!created) return;
      finalExecutiveId = String(created.id);
    } else if (!executiveId) {
      setError('Selecciona o crea un ejecutivo.'); return;
    }

    if (!proyecto.trim()) { setError('Ingresa el nombre del proyecto.'); return; }
    const cleanDetalle = detalle.map((d) => d.trim()).filter(Boolean);
    if (!cleanDetalle.length) { setError('Agrega al menos una línea de detalle.'); return; }
    const montoNum = parseFloat(monto);
    if (!monto || Number.isNaN(montoNum) || montoNum <= 0) { setError('Ingresa un monto válido.'); return; }

    const impuestos = Math.round(((montoNum * (parseFloat(impPct) || 0)) / 100) * 100) / 100;
    const payload = {
      clientId: finalClientId, pais, lineaServicio: effectiveLinea, executiveId: finalExecutiveId,
      proyecto: proyecto.trim(), descripcion, detalle: cleanDetalle,
      monto: montoNum, impuestos, moneda, validezDias: parseInt(validezDias, 10) || 30
    };

    try {
      const result = isAdjusting
        ? await adjustQuotation.mutateAsync({ id, ...payload })
        : await createQuotation.mutateAsync(payload);
      navigate(`/cotizacion/${result.id}`);
    } catch (err) { setError(err.message); }
  }

  if (isAdjusting && !source) return null;

  const effectiveLinea = lineaServicio || serviceLines[0]?.name || '';

  return (
    <div>
      <h1 className="mb-4 text-lg font-medium">{isAdjusting ? `Ajustar cotización ${source?.correlativoGeneral || ''}` : 'Nueva cotización'}</h1>
      <Card>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="f_cliente" className="mb-1 block text-xs font-medium text-text-secondary">Cliente</label>
              <Select id="f_cliente" value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">Selecciona un cliente…</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                <option value="__new__">+ Nuevo cliente</option>
              </Select>
            </div>
            <div>
              <label htmlFor="f_pais" className="mb-1 block text-xs font-medium text-text-secondary">País</label>
              <Select id="f_pais" value={pais} onChange={(e) => setPais(e.target.value)}>
                {COUNTRIES.map((p) => <option key={p}>{p}</option>)}
              </Select>
            </div>
          </div>
          {clientId === '__new__' && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label htmlFor="f_nc_name" className="mb-1 block text-xs font-medium text-text-secondary">Nombre del cliente nuevo</label>
                  <Input id="f_nc_name" placeholder="Ej. Tengo Tienda" value={newClientName} onChange={(e) => setNewClientName(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="f_nc_code" className="mb-1 block text-xs font-medium text-text-secondary">Código (fijo, no cambia luego)</label>
                  <Input id="f_nc_code" placeholder="Ej. TIENDA" value={newClientCode} onChange={(e) => setNewClientCode(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="f_nc_country" className="mb-1 block text-xs font-medium text-text-secondary">País</label>
                  <Select id="f_nc_country" value={newClientCountry} onChange={(e) => setNewClientCountry(e.target.value)}>
                    {COUNTRIES.map((p) => <option key={p}>{p}</option>)}
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label htmlFor="f_nc_contact" className="mb-1 block text-xs font-medium text-text-secondary">Contacto (opcional)</label>
                  <Input id="f_nc_contact" placeholder="Nombre de quien recibe la propuesta" value={newClientContact} onChange={(e) => setNewClientContact(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="f_nc_email" className="mb-1 block text-xs font-medium text-text-secondary">Correo (opcional)</label>
                  <Input id="f_nc_email" type="email" placeholder="correo@cliente.com" value={newClientEmail} onChange={(e) => setNewClientEmail(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="f_nc_phone" className="mb-1 block text-xs font-medium text-text-secondary">Teléfono (opcional)</label>
                  <Input id="f_nc_phone" placeholder="0000-0000" value={newClientPhone} onChange={(e) => setNewClientPhone(e.target.value)} />
                </div>
              </div>
              <Button type="button" size="small" className="self-start" disabled={createClient.isPending} onClick={onSaveNewClient}>
                {createClient.isPending ? 'Guardando…' : 'Guardar cliente'}
              </Button>
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="f_linea" className="mb-1 block text-xs font-medium text-text-secondary">Línea de servicio</label>
              <Select id="f_linea" value={effectiveLinea} onChange={(e) => setLineaServicio(e.target.value)}>
                {serviceLines.map((s) => <option key={s.id}>{s.name}</option>)}
              </Select>
            </div>
            <div>
              <label htmlFor="f_ejecutivo" className="mb-1 block text-xs font-medium text-text-secondary">Ejecutivo comercial</label>
              <Select id="f_ejecutivo" value={executiveId} onChange={(e) => setExecutiveId(e.target.value)}>
                <option value="">Selecciona…</option>
                {executives.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                <option value="__new__">+ Nuevo ejecutivo</option>
              </Select>
            </div>
          </div>
          {executiveId === '__new__' && (
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Input aria-label="Nombre del ejecutivo nuevo" placeholder="Nombre completo" value={newExecName} onChange={(e) => setNewExecName(e.target.value)} />
              </div>
              <Button type="button" size="small" disabled={createExecutive.isPending} onClick={onSaveNewExecutive}>
                {createExecutive.isPending ? 'Guardando…' : 'Guardar ejecutivo'}
              </Button>
            </div>
          )}

          <div>
            <label htmlFor="f_proyecto" className="mb-1 block text-xs font-medium text-text-secondary">Proyecto</label>
            <Input id="f_proyecto" value={proyecto} onChange={(e) => setProyecto(e.target.value)} />
          </div>
          <div>
            <label htmlFor="f_desc" className="mb-1 block text-xs font-medium text-text-secondary">Descripción del proyecto</label>
            <Textarea id="f_desc" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">Detalle de servicios</label>
            <DetalleLineList value={detalle} onChange={setDetalle} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="f_moneda" className="mb-1 block text-xs font-medium text-text-secondary">Moneda</label>
              <Select id="f_moneda" value={moneda} onChange={(e) => setMoneda(e.target.value)}>
                <option value="GTQ">Quetzales (Q)</option>
                <option value="USD">Dólares ($)</option>
              </Select>
            </div>
            <div>
              <label htmlFor="f_monto" className="mb-1 block text-xs font-medium text-text-secondary">Monto (antes de impuestos)</label>
              <Input id="f_monto" type="number" min="0" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} />
            </div>
            <div>
              <label htmlFor="f_imp" className="mb-1 block text-xs font-medium text-text-secondary">Impuestos (%)</label>
              <Input id="f_imp" type="number" min="0" step="0.1" value={impPct} onChange={(e) => setImpPct(e.target.value)} />
            </div>
          </div>
          <div className="max-w-[120px]">
            <label htmlFor="f_validez" className="mb-1 block text-xs font-medium text-text-secondary">Validez (días)</label>
            <Input id="f_validez" type="number" min="1" value={validezDias} onChange={(e) => setValidezDias(e.target.value)} />
          </div>

          {error && <p className="text-xs text-danger">{error}</p>}
          <Button type="submit" variant="primary" className="self-start">
            {isAdjusting ? 'Guardar ajuste' : 'Generar cotización'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
