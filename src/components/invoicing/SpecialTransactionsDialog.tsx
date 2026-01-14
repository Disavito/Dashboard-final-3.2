import { ColumnDef } from '@tanstack/react-table';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Loader2, XCircle } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { DataTable } from '@/components/ui-custom/DataTable';
import { AnnulledIncomeSummary } from '@/lib/types/invoicing';
import { fetchAnnulledAndReturnedIncomes } from '@/lib/api/invoicingApi';
import EmptyState from '../ui-custom/EmptyState';
import { formatCurrency } from '@/lib/utils';

interface SpecialTransactionsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'annulled' | 'returned'; // Para futura diferenciación si es necesario
}

const columns: ColumnDef<AnnulledIncomeSummary>[] = [
  {
    accessorKey: 'date',
    header: 'Fecha',
    cell: ({ row }) => {
      const date = new Date(row.getValue('date'));
      return date.toLocaleDateString('es-PE', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    },
  },
  {
    accessorKey: 'receipt_number',
    header: 'N° Comprobante',
  },
  {
    accessorKey: 'client_name',
    header: 'Cliente',
    cell: ({ row }) => row.original.client_name || 'N/A',
  },
  {
    accessorKey: 'client_dni',
    header: 'DNI Cliente',
    cell: ({ row }) => row.original.client_dni || 'N/A',
  },
  {
    accessorKey: 'amount',
    header: 'Monto',
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue('amount'));
      return (
        <span className={amount < 0 ? 'text-error' : 'text-foreground'}>
          {formatCurrency(amount)}
        </span>
      );
    },
  },
  {
    accessorKey: 'transaction_type',
    header: 'Tipo Transacción',
  },
];

export const SpecialTransactionsDialog = ({
  isOpen,
  onClose,
  type,
}: SpecialTransactionsDialogProps) => {
  const {
    data: transactions,
    isLoading,
    isError,
    error,
  } = useQuery<AnnulledIncomeSummary[], Error>({
    queryKey: ['specialIncomes', type], // Incluir 'type' en queryKey para refetching
    queryFn: () => fetchAnnulledAndReturnedIncomes(type), // Pasar 'type' a la función de fetch
    enabled: isOpen, // Solo ejecutar la consulta cuando el diálogo está abierto
  });

  const title =
    type === 'annulled'
      ? 'Boletas Anuladas'
      : 'Devoluciones de Boletas';

  const description =
    type === 'annulled'
      ? 'Listado de todas las boletas que han sido anuladas.'
      : 'Listado de todas las devoluciones de boletas registradas.';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl border-border bg-background p-6 shadow-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-foreground">
            {title}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {description}
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2 text-muted-foreground">Cargando transacciones...</p>
          </div>
        )}

        {isError && (
          <EmptyState
            Icon={XCircle}
            title="Error al cargar transacciones"
            description={`No se pudieron cargar las transacciones especiales: ${error?.message || 'Error desconocido'}`}
          />
        )}

        {!isLoading && !isError && (
          <DataTable
            columns={columns}
            data={transactions || []}
            emptyTitle="No hay transacciones especiales"
            emptyDescription="No se encontraron boletas anuladas o devoluciones en el sistema."
            EmptyIcon={CalendarDays}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
