import { SummaryData } from '@/lib/types/invoicing';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ResumenDiarioResultProps {
  data: SummaryData;
}

function ResumenDiarioResult({ data }: ResumenDiarioResultProps) {
  return (
    <div className="space-y-4 p-4 border border-primary/50 rounded-lg bg-card/30">
      <h3 className="text-lg font-semibold text-primary">Resumen Generado - Listo para Enviar</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-textSecondary">Identificador:</p>
          <p className="font-mono font-bold text-base">{data.numero_completo}</p>
        </div>
        <div>
          <p className="text-textSecondary">Fecha de Resumen:</p>
          <p className="font-medium">{format(new Date(data.fecha_resumen), "PPP", { locale: es })}</p>
        </div>
      </div>
      <div>
        <p className="text-textSecondary mb-2">Documentos Incluidos ({data.detalles.length}):</p>
        {data.detalles.length > 0 ? (
          <ScrollArea className="h-32 w-full rounded-md border p-2 bg-background/50">
            <div className="flex flex-wrap gap-2">
              {data.detalles.map((detalle, index) => (
                <Badge key={index} variant="secondary" className="font-mono">
                  {detalle.serie_numero}
                </Badge>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <p className="text-sm text-textSecondary italic">No se encontraron boletas para esta fecha.</p>
        )}
      </div>
    </div>
  );
}

export default ResumenDiarioResult;
