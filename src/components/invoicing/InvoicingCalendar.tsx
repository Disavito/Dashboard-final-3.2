import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { fetchRecentInvoices } from '@/lib/api/invoicingApi';
import { InvoicingCalendarItem } from '@/lib/types/invoicing';
import { useQuery } from '@tanstack/react-query';
import { Loader2, FileText, CheckCircle, XCircle, Clock, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// Función para obtener el color y el ícono del estado
const getStatusProps = (status: InvoicingCalendarItem['status']) => {
  switch (status) {
    case 'Aceptado':
      return { icon: CheckCircle, color: 'text-success', bgColor: 'bg-success/10' };
    case 'Pendiente':
      return { icon: Clock, color: 'text-warning', bgColor: 'bg-warning/10' };
    case 'Rechazado':
      return { icon: XCircle, color: 'text-error', bgColor: 'bg-error/10' };
    default:
      return { icon: FileText, color: 'text-textSecondary', bgColor: 'bg-surface' };
  }
};

// Función para obtener el color del tipo de documento
const getTypeColor = (type: InvoicingCalendarItem['type']) => {
  switch (type) {
    case 'Factura':
      return 'text-primary';
    case 'Boleta':
      return 'text-secondary';
    case 'Nota Crédito':
      return 'text-accent';
    default:
      return 'text-textSecondary';
  }
};

const InvoicingCalendar = () => {
  // Forzando la re-evaluación del módulo @tanstack/react-query
  const { data: invoices, isLoading, isError } = useQuery<InvoicingCalendarItem[]>({
    queryKey: ['recentInvoices'],
    queryFn: fetchRecentInvoices,
  });

  if (isLoading) {
    return (
      <Card className="bg-surface border-border shadow-lg h-full min-h-[400px]">
        <CardHeader>
          <CardTitle className="text-xl text-primary">Actividad de Facturación Reciente</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-3 text-textSecondary">Cargando documentos...</p>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="bg-surface border-error/50 shadow-lg h-full min-h-[400px]">
        <CardHeader>
          <CardTitle className="text-xl text-primary">Actividad de Facturación Reciente</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64 text-error">
          <XCircle className="h-8 w-8 mr-2" />
          <p>Error al cargar la actividad de facturación.</p>
        </CardContent>
      </Card>
    );
  }

  if (!invoices || invoices.length === 0) {
    return (
      <Card className="bg-surface border-border shadow-lg h-full min-h-[400px]">
        <CardHeader>
          <CardTitle className="text-xl text-primary">Actividad de Facturación Reciente</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64 text-textSecondary">
          <FileText className="h-8 w-8 mr-2" />
          <p>No hay documentos emitidos recientemente.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-surface border-border shadow-lg h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xl text-primary">Actividad de Facturación Reciente</CardTitle>
        <DollarSign className="h-6 w-6 text-primary/70" />
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[350px]">
          <div className="space-y-1 p-4">
            {invoices.map((item: InvoicingCalendarItem) => {
              const { icon: StatusIcon, color: statusColor, bgColor: statusBgColor } = getStatusProps(item.status);
              const typeColor = getTypeColor(item.type);
              const formattedDate = format(new Date(item.date), 'dd MMM', { locale: es });
              
              return (
                <div 
                  key={item.id} 
                  className="flex items-center justify-between p-3 rounded-lg transition-colors duration-200 hover:bg-card/50 border-b border-border/50 last:border-b-0"
                >
                  {/* Fecha y Tipo */}
                  <div className="flex items-center space-x-4">
                    <div className={`flex flex-col items-center justify-center w-12 h-12 rounded-full ${statusBgColor} border border-border/50`}>
                      <p className="text-xs font-bold text-textSecondary uppercase">{formattedDate.split(' ')[0]}</p>
                      <p className="text-xs text-textSecondary uppercase">{formattedDate.split(' ')[1]}</p>
                    </div>
                    
                    <div>
                      <p className={`text-sm font-semibold ${typeColor}`}>{item.type} <span className="text-textSecondary/70 font-normal">({item.serie})</span></p>
                      <p className="text-xs text-textSecondary truncate max-w-[150px]">{item.clientName}</p>
                    </div>
                  </div>

                  {/* Monto y Estado */}
                  <div className="flex flex-col items-end">
                    <p className={`text-base font-bold ${item.amount < 0 ? 'text-error' : 'text-success'}`}>
                      {item.amount.toLocaleString('es-PE', { style: 'currency', currency: 'PEN' })}
                    </p>
                    <div className="flex items-center mt-1">
                      <StatusIcon className={`h-3 w-3 mr-1 ${statusColor}`} />
                      <span className={`text-xs font-medium ${statusColor}`}>{item.status}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default InvoicingCalendar;
