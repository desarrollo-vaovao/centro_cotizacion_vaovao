import { useState } from 'react';
import { useClients, useCreateClient } from '../api/clients.js';
import { useExecutives, useCreateExecutive } from '../api/executives.js';
import { useServiceLines, useCreateServiceLine, useUpdateServiceLine, useDeleteServiceLine } from '../api/serviceLines.js';
import { useLogos, useSaveLogos, useDeleteLogo } from '../api/settings.js';
import { Card } from '../components/ui/card.jsx';
import { Button } from '../components/ui/button.jsx';
import { Input } from '../components/ui/input.jsx';
import { Select } from '../components/ui/select.jsx';

const COUNTRIES = ['Guatemala', 'El Salvador', 'Honduras', 'Nicaragua', 'Costa Rica', 'Panamá'];
const MAX_LOGO_BYTES = 1.5 * 1024 * 1024;

function ClientsPanel() {
  const { data: clients = [] } = useClients();
  const createClient = useCreateClient();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [error, setError] = useState('');

  async function onAdd() {
    setError('');
    try {
      await createClient.mutateAsync({ name, code: code || undefined, country });
      setName(''); setCode('');
    } catch (err) { setError(err.message); }
  }

  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold">Clientes</h2>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-text-secondary"><th className="pb-2">Código</th><th>Nombre</th><th>País</th></tr></thead>
        <tbody>
          {clients.map((c) => (
            <tr key={c.id} className="border-t border-border">
              <td className="py-1.5">{c.code}</td><td>{c.name}</td><td>{c.country}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Input aria-label="Nombre del cliente" placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
        <Input aria-label="Código del cliente" placeholder="Código (auto)" value={code} onChange={(e) => setCode(e.target.value)} />
        <Select aria-label="País del cliente" value={country} onChange={(e) => setCountry(e.target.value)}>
          {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
        </Select>
      </div>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      <Button className="mt-2" onClick={onAdd}>+ Agregar cliente</Button>
    </Card>
  );
}

function ExecutivesPanel() {
  const { data: executives = [] } = useExecutives();
  const createExecutive = useCreateExecutive();
  const [name, setName] = useState('');

  async function onAdd() {
    if (!name.trim()) return;
    await createExecutive.mutateAsync({ name });
    setName('');
  }

  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold">Ejecutivos</h2>
      <ul className="text-sm">
        {executives.map((e) => <li key={e.id} className="border-t border-border py-1.5 first:border-t-0">{e.name}</li>)}
      </ul>
      <div className="mt-3">
        <label htmlFor="ne_name" className="mb-1 block text-xs text-text-secondary">Nombre del ejecutivo</label>
        <Input id="ne_name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <Button className="mt-2" onClick={onAdd}>+ Agregar ejecutivo</Button>
    </Card>
  );
}

function ServiceLinesPanel() {
  const { data: serviceLines = [] } = useServiceLines();
  const createLine = useCreateServiceLine();
  const updateLine = useUpdateServiceLine();
  const deleteLine = useDeleteServiceLine();
  const [newName, setNewName] = useState('');

  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold">Líneas de servicio</h2>
      <div className="flex flex-col gap-2">
        {serviceLines.map((line) => (
          <div key={line.id} className="flex gap-2">
            <Input
              defaultValue={line.name}
              onBlur={(e) => { if (e.target.value.trim() && e.target.value !== line.name) updateLine.mutate({ id: line.id, name: e.target.value }); }}
            />
            <Button variant="danger" size="small" onClick={() => deleteLine.mutate(line.id)}>×</Button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <Input placeholder="Nueva línea de servicio" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <Button
          onClick={async () => { if (!newName.trim()) return; await createLine.mutateAsync({ name: newName }); setNewName(''); }}
        >
          + Agregar
        </Button>
      </div>
    </Card>
  );
}

function LogosPanel() {
  const { data: logos } = useLogos();
  const saveLogos = useSaveLogos();
  const deleteLogo = useDeleteLogo();
  const [error, setError] = useState('');

  function onFileChange(key, file) {
    setError('');
    if (!file) return;
    if (file.size > MAX_LOGO_BYTES) { setError('La imagen es muy pesada (máx. ~1.5MB).'); return; }
    const reader = new FileReader();
    reader.onload = () => saveLogos.mutate({ [key]: reader.result });
    reader.readAsDataURL(file);
  }

  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold">Logos</h2>
      {[['logoAgencia', 'agencia', 'Logo de la agencia'], ['logoVelarc', 'velarc', 'Logo VELARC']].map(([field, key, label]) => (
        <div key={key} className="mb-3 flex items-center gap-3">
          <span className="w-40 text-xs text-text-secondary">{label}</span>
          {logos && logos[field] ? <img src={logos[field]} alt={label} className="h-11 w-24 object-contain" /> : <span className="text-xs text-text-secondary">Sin logo</span>}
          <input type="file" accept="image/*" aria-label={`Subir ${label}`} onChange={(e) => onFileChange(field, e.target.files[0])} />
          {logos && logos[field] && <Button size="small" variant="danger" onClick={() => deleteLogo.mutate(key)}>Quitar</Button>}
        </div>
      ))}
      {error && <p className="text-xs text-danger">{error}</p>}
    </Card>
  );
}

export function CatalogoPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-medium">Configuración</h1>
      <div className="grid grid-cols-2 gap-4">
        <ClientsPanel />
        <ExecutivesPanel />
      </div>
      <ServiceLinesPanel />
      <LogosPanel />
    </div>
  );
}
