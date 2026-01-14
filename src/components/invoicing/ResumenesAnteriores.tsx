import { useEffect, useState, useMemo, useCallback } from 'react';
import { fetchDailySummaries } from '@/lib/api/invoicingApi';
import { DailySummary } from '@/lib/types/invoicing';
import { DataTable } from '../ui-custom/DataTable';
import { getColumns } from './columns';
import { Skeleton } from '../ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Terminal } from 'lucide-react';

function ResumenesAnteriores() {
  const [summaries, setSummaries] = useState<DailySummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSummaries = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await fetchDailySummaries();
        setSummaries(data);
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Ocurrió un error desconocido.');
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadSummaries();
  }, []);

  // Manejador para actualizar el estado de un único resumen en la tabla
  const handleStatusUpdate = useCallback((summaryId: number, newStatus: string) => {
    setSummaries(currentSummaries =>
      currentSummaries.map(s =>
        s.id === summaryId ? { ...s, estado_sunat: newStatus } : s
      )
    );
  }, []);

  // Genera las columnas pasando el manejador de actualización de estado
  const columns = useMemo(() => getColumns(handleStatusUpdate), [handleStatusUpdate]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <div className="flex justify-end space-x-2">
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="bg-error/10 border-error/30 text-error-foreground">
        <Terminal className="h-4 w-4" />
        <AlertTitle>Error al Cargar el Historial</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return <DataTable columns={columns} data={summaries} />;
}

export default ResumenesAnteriores;
