import { Outlet, NavLink } from 'react-router-dom';
import { cn } from '../../lib/utils.js';
import { useAuth } from '../../context/AuthContext.jsx';

const NAV_ITEMS = [
  { to: '/nueva', label: 'Nueva cotización' },
  { to: '/historial', label: 'Historial' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/ficha', label: 'Ficha de cliente' },
  { to: '/catalogo', label: 'Configuración' }
];

export function AppLayout() {
  const { logout } = useAuth();

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-[210px] shrink-0 flex-col bg-gradient-to-br from-[#26232a] via-[#2d2433] to-[#33253a] p-6 text-[#e9e6df]">
        <div className="mb-8 flex items-center gap-2 text-base font-semibold">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-ui-accent text-sm font-semibold text-white">V</div>
          <div>
            VELARC
            <span className="block text-[10.5px] font-normal text-[#a39c8c]">Centro de cotizaciones</span>
          </div>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn('rounded-lg px-2.5 py-2 text-sm text-[#d2cdc3] hover:bg-white/5 hover:text-white', isActive && 'bg-ui-accent/20 font-medium text-[#cdb8f7]')
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button
          type="button"
          onClick={() => logout()}
          className="mt-auto rounded-lg px-2.5 py-2 text-sm text-[#d2cdc3] hover:bg-white/5 hover:text-white"
        >
          Cerrar sesión
        </button>
      </aside>
      <main className="min-w-0 flex-1 p-8">
        <Outlet />
      </main>
    </div>
  );
}
