import React, { useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { User } from '@supabase/supabase-js';

// Define un tipo que coincide con la estructura real de los datos de Supabase en tiempo de ejecución.
// 'roles' es un OBJETO de rol, ya que la consulta 'select' de una FK
// devuelve el objeto relacionado directamente para cada fila de user_roles.
type SupabaseFetchedRolesData = {
  roles: {
    id: number;
    role_name: string;
  };
};

interface UserContextType {
  user: User | null;
  roles: string[] | null;
  permissions: Set<string> | null;
  loading: boolean;
}

// Usamos React.createContext explícitamente para evitar problemas de desestructuración en el runtime.
const UserContext = React.createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<string[] | null>(null);
  const [permissions, setPermissions] = useState<Set<string> | null>(null);
  const [loading, setLoading] = useState(true);

  // Usamos useCallback para memoizar esta función y evitar que se recree en cada render.
  // Esto es importante porque la usaremos como dependencia en useEffect.
  const fetchUserAndRolesAndPermissions = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      setUser(authUser);
      console.log('UserContext: Fetched authUser:', authUser);

      if (authUser) {
        // 1. Obtener los roles del usuario, incluyendo el ID del rol
        const { data: userRolesDataRaw, error: userRolesError } = await supabase
          .from('user_roles')
          .select('roles(id, role_name)')
          .eq('user_id', authUser.id);

        if (userRolesError) {
          console.error('UserContext: Error fetching user roles:', userRolesError);
          throw userRolesError;
        }
        console.log('UserContext: Fetched userRolesDataRaw:', userRolesDataRaw);

        // Tratar los datos crudos como un array de 'any' para evitar la inferencia incorrecta de TypeScript
        // y luego realizar un cast explícito en cada elemento al mapear.
        const userRolesData: any[] = userRolesDataRaw || [];

        // Ajustar el mapeo para manejar 'item' como un OBJETO SupabaseFetchedRolesData
        const fetchedRoles = userRolesData
          .map(item => (item as SupabaseFetchedRolesData).roles?.role_name)
          .filter(Boolean) as string[] || [];
        setRoles(fetchedRoles);
        console.log('UserContext: Processed fetchedRoles (names):', fetchedRoles);

        // 2. Obtener los permisos de recursos basados en los roles del usuario
        if (fetchedRoles.length > 0) {
          // Ajustar el mapeo para manejar 'item' como un OBJETO SupabaseFetchedRolesData
          const roleIds = userRolesData
            .map(item => (item as SupabaseFetchedRolesData).roles?.id)
            .filter(Boolean) as number[];
          console.log('UserContext: Processed roleIds:', roleIds);

          if (roleIds.length === 0) {
              console.warn('UserContext: No role IDs found for user, setting empty permissions.');
              setPermissions(new Set());
              setLoading(false);
              return;
          }
          
          const { data: permissionsData, error: permissionsError } = await supabase
            .from('resource_permissions')
            .select('resource_path')
            .in('role_id', roleIds)
            .eq('can_access', true);

          if (permissionsError) {
            console.error('UserContext: Error fetching permissions:', permissionsError);
            throw permissionsError;
          }
          console.log('UserContext: Fetched permissionsData:', permissionsData);

          const fetchedPermissions = new Set(permissionsData?.map(p => p.resource_path) || []);
          // Asegurarse de que el dashboard principal siempre sea accesible si hay permisos
          if (fetchedPermissions.size > 0) {
            fetchedPermissions.add('/');
          }
          setPermissions(fetchedPermissions);
          console.log('UserContext: Final fetchedPermissions Set:', fetchedPermissions);

        } else {
          setPermissions(new Set());
          console.log('UserContext: No roles found, setting empty permissions.');
        }

      } else {
        setRoles(null);
        setPermissions(null);
        console.log('UserContext: No authenticated user, roles and permissions set to null.');
      }
    } catch (error) {
      console.error('UserContext: Global error fetching user, roles, or permissions:', error);
      setRoles(null);
      setPermissions(null);
    } finally {
      setLoading(false);
      console.log('UserContext: Loading finished.');
    }
  }, []); // Las dependencias están vacías porque la función obtiene el usuario de Supabase internamente.

  useEffect(() => {
    // Realiza la carga inicial de usuario, roles y permisos al montar el componente.
    fetchUserAndRolesAndPermissions();

    // Configura el listener de cambios de estado de autenticación de Supabase.
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('UserContext: Auth state changed. Event:', event, 'Session:', session);
      
      if (session?.user) {
        // Si el evento es SIGNED_IN y el ID del usuario es el mismo que el actual,
        // es una revalidación de sesión, no un nuevo inicio de sesión.
        // En este caso, solo actualizamos el objeto user sin recargar roles/permisos.
        if (event === 'SIGNED_IN' && user?.id === session.user.id) {
          setUser(session.user);
          console.log('UserContext: Session revalidated for same user, no full re-fetch.');
          setLoading(false); // Asegurarse de que el estado de carga se desactive
          return; // Salir sin recargar roles y permisos
        }

        // Para un inicio de sesión nuevo (user.id diferente o user era null) o cierre de sesión,
        // o cualquier otro evento que implique un cambio real de usuario,
        // entonces sí realizamos la carga completa.
        setUser(session.user); // Actualizar el usuario en el estado
        fetchUserAndRolesAndPermissions();
      } else {
        // Si no hay sesión de usuario, reseteamos el estado.
        setUser(null);
        setRoles(null);
        setPermissions(null);
        setLoading(false);
        console.log('UserContext: No authenticated user, roles and permissions set to null.');
      }
    });

    // Limpia el listener al desmontar el componente.
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [fetchUserAndRolesAndPermissions, user?.id]); // Asegúrate de incluir fetchUserAndRolesAndPermissions y user?.id como dependencias.

  return (
    <UserContext.Provider value={{ user, roles, permissions, loading }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  // Usamos React.useContext explícitamente
  const context = React.useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
