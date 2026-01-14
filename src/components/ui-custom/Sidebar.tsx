import React, { useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, ArrowUpCircle, ArrowDownCircle, Settings as SettingsIcon, Wallet, FolderOpen, ReceiptText } from 'lucide-react';
import { useUser } from '@/context/UserContext';

// Definición de todos los enlaces posibles con su ruta de recurso asociada
const allNavLinks = [
  // Dashboard no requiere permiso explícito, se maneja en UserContext
  { name: 'Dashboard', path: '/', icon: LayoutDashboard, requiresPermission: false }, 
  { name: 'Socios Titulares', path: '/people', icon: Users, requiresPermission: true },
  { name: 'Documentos', path: '/partner-documents', icon: FolderOpen, requiresPermission: true },
  { name: 'Facturación', path: '/invoicing', icon: ReceiptText, requiresPermission: true }, // Nuevo enlace de Facturación
  { name: 'Ingresos', path: '/income', icon: ArrowUpCircle, requiresPermission: true },
  { name: 'Gastos', path: '/expenses', icon: ArrowDownCircle, requiresPermission: true },
  { name: 'Cuentas', path: '/accounts', icon: Wallet, requiresPermission: true },
  { name: 'Configuración', path: '/settings', icon: SettingsIcon, requiresPermission: true },
];

const Sidebar: React.FC = () => {
  const { permissions, loading } = useUser();

  const visibleNavLinks = useMemo(() => {
    // Si está cargando o no hay permisos (ej. no logueado), no mostramos enlaces.
    if (loading || !permissions) return [];

    return allNavLinks.filter(link => {
      // Si no requiere permiso (como el Dashboard), siempre es visible.
      if (!link.requiresPermission) return true;
      
      // Verifica si el conjunto de permisos incluye la ruta del recurso.
      return permissions.has(link.path);
    });
  }, [permissions, loading]);

  // Opcional: Mostrar un estado de carga si es necesario, aunque el layout principal
  // ya maneja el estado de carga de la ruta protegida.
  if (loading) {
    // Podríamos mostrar un esqueleto, pero por ahora, solo el encabezado.
  }

  return (
    <aside className="w-64 bg-surface border-r border-border p-6 flex flex-col shadow-lg">
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-extrabold text-primary tracking-tight">
          Financiero<span className="text-accent">.</span>
        </h2>
        <p className="text-textSecondary text-sm mt-1">Gestión Integral</p>
      </div>
      <nav className="flex-1">
        <ul className="space-y-3">
          {visibleNavLinks.map((link) => (
            <li key={link.name}>
              <NavLink
                to={link.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 p-3 rounded-lg transition-all duration-200 ease-in-out
                  ${isActive
                    ? 'bg-primary/20 text-primary font-semibold shadow-md transform scale-105'
                    : 'text-textSecondary hover:bg-muted/30 hover:text-foreground'
                  }`
                }
              >
                <link.icon className="h-5 w-5" />
                <span className="text-lg">{link.name}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mt-auto pt-6 border-t border-border/50 text-center text-textSecondary text-sm">
        <p>&copy; 2025 Bolt. Todos los derechos reservados.</p>
      </div>
    </aside>
  );
};

export default Sidebar;
