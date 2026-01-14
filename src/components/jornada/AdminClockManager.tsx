import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAllColaboradores } from '@/lib/api/jornadaApi';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, UserSearch } from 'lucide-react';
import ClockManager from './ClockManager';

const AdminClockManager: React.FC = () => {
  const [selectedColaboradorId, setSelectedColaboradorId] = useState<string | null>(null);

  const { data: colaboradores, isLoading: isLoadingColaboradores } = useQuery({
    queryKey: ['allColaboradores'],
    queryFn: getAllColaboradores,
  });

  const selectedColaborador = colaboradores?.find(c => c.id === selectedColaboradorId) || null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Seleccionar Colaborador</CardTitle>
          <CardDescription>Elige un colaborador para registrar su jornada manualmente.</CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            onValueChange={setSelectedColaboradorId}
            disabled={isLoadingColaboradores}
          >
            <SelectTrigger className="w-full md:w-1/2">
              <Users className="mr-2 h-4 w-4" />
              <SelectValue placeholder={isLoadingColaboradores ? "Cargando..." : "Seleccionar colaborador"} />
            </SelectTrigger>
            <SelectContent>
              {colaboradores?.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} {c.apellidos}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedColaborador ? (
        <ClockManager colaborador={selectedColaborador} bypassTimeRestrictions={true} />
      ) : (
        <div className="flex flex-col items-center justify-center text-center p-10 border-2 border-dashed rounded-lg">
            <UserSearch className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Selecciona un colaborador para ver y gestionar su registro de jornada.</p>
        </div>
      )}
    </div>
  );
};

export default AdminClockManager;
