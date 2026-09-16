import { useState } from 'react';
import { useClients, useCreateClient, useDeleteClient } from '../api/clients.js';
import { useExecutives, useCreateExecutive, useDeleteExecutive, useResetExecutivePassword } from '../api/executives.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useServiceLines, useCreateServiceLine, useUpdateServiceLine, useDeleteServiceLine } from '../api/serviceLines.js';
import { useLogos, useSaveLogos, useDeleteLogo } from '../api/settings.js';
import { Card } from '../components/ui/card.jsx';
import { Button } from '../components/ui/button.jsx';
import { Input } from '../components/ui/input.jsx';
import { Select } from '../components/ui/select.jsx';

const COUNTRIES = ['Guatemala', 'El Salvador', 'Honduras', 'Nicaragua', 'Costa Rica', 'Panamá'];
const MAX_LOGO_BYTES = 1.5 * 1024 * 1024;

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

function ClientsPanel() {
  const { data: clients = [] } = useClients();
  const createClient = useCreateClient();
  const deleteClient = useDeleteClient();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [error, setError] = useState('');

  async function onAdd() {
    setError('');
    try {
      await createClient.mutateAsync({
        name,
        code: code || undefined,
        country,
        contactName,
        contactEmail,
        contactPhone
      });
      setName(''); setCode(''); setContactName(''); setContactEmail(''); setContactPhone('');
    } catch (err) { setError(err.message); }
  }

  async function onDelete(client) {
    setError('');
    if (!window.confirm(`¿Eliminar el cliente "${client.name}"? Esta acción no se puede deshacer.`)) return;
    try {
      await deleteClient.mutateAsync(client.id);
    } catch (err) { setError(err.message); }
  }

  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold">Clientes</h2>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-text-secondary"><th className="pb-2">Código</th><th>Nombre</th><th>País</th><th></th></tr></thead>
        <tbody>
          {clients.map((c) => (
            <tr key={c.id} className="border-t border-border">
              <td className="py-1.5">{c.code}</td><td>{c.name}</td><td>{c.country}</td>
              <td className="text-right">
                <Button aria-label={`Eliminar cliente ${c.name}`} variant="danger" size="small" className="px-2" onClick={() => onDelete(c)}>
                  <TrashIcon />
                </Button>
              </td>
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
      <div className="mt-2 grid grid-cols-3 gap-2">
        <Input aria-label="Contacto del cliente" placeholder="Contacto (opcional)" value={contactName} onChange={(e) => setContactName(e.target.value)} />
        <Input aria-label="Correo del cliente" type="email" placeholder="Correo (opcional)" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
        <Input aria-label="Teléfono del cliente" placeholder="Teléfono (opcional)" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
      </div>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      <Button className="mt-2" disabled={createClient.isPending} onClick={onAdd}>
        {createClient.isPending ? 'Guardando…' : 'Guardar cliente'}
      </Button>
    </Card>
  );
}

function UsersPanel() {
  const { user } = useAuth();
  const isOwner = user?.role === 'owner';
  const { data: users = [] } = useExecutives();
  const createUser = useCreateExecutive();
  const resetPassword = useResetExecutivePassword();
  const deleteUser = useDeleteExecutive();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [revealed, setRevealed] = useState(null);

  async function onAdd() {
    setError('');
    try {
      const created = await createUser.mutateAsync({ name, email });
      setName(''); setEmail('');
      setRevealed({ email: created.email, tempPassword: created.tempPassword });
    } catch (err) { setError(err.message); }
  }

  async function onResetPassword(u) {
    setError('');
    if (!window.confirm(`¿Restablecer la contraseña de "${u.name}"?`)) return;
    try {
      const result = await resetPassword.mutateAsync(u.id);
      setRevealed({ email: u.email, tempPassword: result.tempPassword });
    } catch (err) { setError(err.message); }
  }

  async function onDelete(u) {
    setError('');
    if (!window.confirm(`¿Eliminar el usuario "${u.name}"? Esta acción no se puede deshacer.`)) return;
    try {
      await deleteUser.mutateAsync(u.id);
    } catch (err) { setError(err.message); }
  }

  async function onCopyPassword() {
    if (!revealed) return;
    try { await navigator.clipboard.writeText(revealed.tempPassword); } catch { /* clipboard unavailable — the text is still visible to select manually */ }
  }

  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold">Usuarios</h2>
      {revealed && (
        <div className="mb-3 rounded-md border border-ui-accent bg-ui-accent/5 p-2.5 text-xs">
          <p className="mb-1">Contraseña temporal para <strong>{revealed.email}</strong>: <code className="font-mono">{revealed.tempPassword}</code></p>
          <p className="mb-2 text-text-secondary">Cópiala ahora — no se volverá a mostrar.</p>
          <div className="flex gap-2">
            <Button type="button" size="small" onClick={onCopyPassword}>Copiar</Button>
            <Button type="button" size="small" onClick={() => setRevealed(null)}>Cerrar</Button>
          </div>
        </div>
      )}
      <ul className="text-sm">
        {users.map((u) => (
          <li key={u.id} className="flex items-center justify-between border-t border-border py-1.5 first:border-t-0">
            <div className="flex flex-col">
              <span className="flex items-center gap-1">
                <span>{u.name}</span>
                {u.role === 'owner' && <span className="text-[10px] uppercase text-ui-accent">Owner</span>}
              </span>
              <span className="text-xs text-text-secondary">{u.email}</span>
            </div>
            {isOwner && (
              <span className="flex shrink-0 gap-1">
                <Button type="button" size="small" aria-label={`Restablecer contraseña de ${u.name}`} onClick={() => onResetPassword(u)}>
                  Restablecer contraseña
                </Button>
                {String(u.id) !== String(user.id) && (
                  <Button aria-label={`Eliminar usuario ${u.name}`} variant="danger" size="small" className="px-2" onClick={() => onDelete(u)}>
                    <TrashIcon />
                  </Button>
                )}
              </span>
            )}
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      {isOwner && (
        <div className="mt-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="nu_name" className="mb-1 block text-xs text-text-secondary">Nombre del usuario</label>
              <Input id="nu_name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label htmlFor="nu_email" className="mb-1 block text-xs text-text-secondary">Correo del usuario</label>
              <Input id="nu_email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          <Button className="mt-2" disabled={createUser.isPending} onClick={onAdd}>
            {createUser.isPending ? 'Guardando…' : 'Crear usuario'}
          </Button>
        </div>
      )}
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
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result.length > MAX_LOGO_BYTES) {
        setError('La imagen es muy pesada (máx. ~1.5MB).');
        return;
      }
      saveLogos.mutate({ [key]: reader.result }, {
        onError: (err) => setError(err.message)
      });
    };
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
        <UsersPanel />
      </div>
      <ServiceLinesPanel />
      <LogosPanel />
    </div>
  );
}
