import { useUser } from '@/context/UserContext';
import { useQuery } from '@tanstack/react-query';
import { getColaboradorProfile } from '@/lib/api/jornadaApi';
import { Loader2, UserX } from 'lucide-react';
import ClockManager from '@/components/jornada/ClockManager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AdminJornadaView from '@/components/jornada/AdminJornadaView';
import AdminClockManager from '@/components/jornada/AdminClockManager';

const JornadaPage = () => {
  const { user, roles } = useUser();
  const isAdmin = roles?.includes('admin') || roles?.includes('finanzas_senior');

  const { data: colaborador, isLoading, isError, error } = useQuery({
    queryKey: ['colaboradorProfile', user?.id],
    queryFn: () => getColaboradorProfile(user!.id),
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-lg">Cargando tu perfil de colaborador...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <UserX className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          No se pudo cargar tu perfil de colaborador. Error: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  if (!colaborador) {
    return (
      <Alert variant="destructive">
        <UserX className="h-4 w-4" />
        <AlertTitle>Perfil no encontrado</AlertTitle>
        <AlertDescription>
          Tu cuenta de usuario no está vinculada a un perfil de colaborador. Por favor, contacta a un administrador.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {isAdmin ? (
        <Tabs defaultValue="mi-jornada" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="mi-jornada">Mi Jornada</TabsTrigger>
            <TabsTrigger value="seguimiento">Seguimiento de Equipo</TabsTrigger>
            <TabsTrigger value="registro-manual">Registro Manual</TabsTrigger>
          </TabsList>
          <TabsContent value="mi-jornada">
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Mi Registro de Jornada</CardTitle>
              </CardHeader>
              <CardContent>
                <ClockManager colaborador={colaborador} bypassTimeRestrictions={isAdmin} />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="seguimiento">
             <Card className="mt-4">
              <CardHeader>
                <CardTitle>Seguimiento de Jornadas del Equipo</CardTitle>
              </CardHeader>
              <CardContent>
                <AdminJornadaView />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="registro-manual">
             <Card className="mt-4">
              <CardHeader>
                <CardTitle>Registro Manual de Jornada para Colaboradores</CardTitle>
              </CardHeader>
              <CardContent>
                <AdminClockManager />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Mi Registro de Jornada</CardTitle>
          </CardHeader>
          <CardContent>
            <ClockManager colaborador={colaborador} bypassTimeRestrictions={isAdmin} />
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default JornadaPage;
