import React from 'react';
import { useUser } from '@/context/UserContext';
import { Navigate, Outlet } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  resourcePath: string; // Nuevo: La ruta o identificador del recurso a proteger
  children?: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ resourcePath, children }) => {
  const { user, permissions, loading } = useUser(); // Ahora obtenemos 'permissions'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  if (!user) {
    // Si no hay usuario, redirigir a la página de autenticación
    return <Navigate to="/auth" replace />;
  }

  // CRÍTICO: Verificar si el usuario tiene permiso para el resourcePath
  // Si permissions es null (ej. no hay usuario o error), asumimos que no hay acceso.
  const isAuthorized = permissions?.has(resourcePath) ?? false;

  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-center bg-background text-text">
        <h1 className="text-4xl font-bold text-error">Acceso Denegado</h1>
        <p className="mt-4 text-lg text-textSecondary">
          No tienes los permisos necesarios para ver esta página.
        </p>
      </div>
    );
  }

  return children ? <>{children}</> : <Outlet />;
};

export default ProtectedRoute;
