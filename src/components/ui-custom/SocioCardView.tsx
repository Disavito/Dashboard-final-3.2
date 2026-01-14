import React from 'react';
import { Edit, Trash2, MapPin, Phone, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { SocioTitular } from '@/lib/types'; // CRITICAL FIX: Import standardized type

interface SocioCardViewProps {
  data: SocioTitular[];
  onEdit: (socio: SocioTitular) => void;
  onDelete: (socio: SocioTitular) => void;
}

const SocioCardView: React.FC<SocioCardViewProps> = ({ data, onEdit, onDelete }) => {
  if (data.length === 0) {
    return (
      <div className="text-center py-10 text-textSecondary">
        No hay socios que coincidan con los filtros o la búsqueda.
      </div>
    );
  }

  // FIX 1: w-full agregado
  return (
    <div className="grid gap-4 w-full max-w-md mx-auto">
      {data.map((socio) => (
        <Card key={socio.id} className="w-full bg-card border-border shadow-lg transition-all duration-300 hover:shadow-xl hover:border-primary/50 overflow-hidden">
          <CardHeader className="p-4 border-b border-border/50 flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-lg font-bold truncate">
              {socio.nombres} {socio.apellidoPaterno}
            </CardTitle>
            <Badge 
              className={cn(
                "text-xs font-semibold shrink-0",
                socio.isActive ? "bg-success/20 text-success hover:bg-success/30" : "bg-error/20 text-error hover:bg-error/30"
              )}
            >
              {socio.isActive ? 'Activo' : 'Inactivo'}
            </Badge>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-textSecondary">DNI:</span>
              <span className="font-medium text-foreground">{socio.dni || 'N/A'}</span>
            </div>
            
            {/* FIX 2: Ubicación responsiva (Stack en móvil) */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start text-sm gap-1">
              <span className="text-textSecondary flex items-center gap-1 shrink-0"><MapPin className="h-4 w-4" /> Ubicación:</span>
              <span className="font-medium text-foreground text-left sm:text-right break-words w-full">
                {socio.localidad || 'N/A'} ({socio.mz || 'N/A'}/{socio.lote || 'N/A'})
              </span>
            </div>

            {socio.celular && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-textSecondary flex items-center gap-1"><Phone className="h-4 w-4" /> Celular:</span>
                <span className="font-medium text-foreground">{socio.celular}</span>
              </div>
            )}
            {socio.receiptNumber && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-textSecondary flex items-center gap-1"><FileText className="h-4 w-4" /> Recibo:</span>
                <span className="font-medium text-primary break-all">{socio.receiptNumber}</span>
              </div>
            )}
            
            <div className="pt-3 flex gap-3 border-t border-border/50">
              <Button
                variant="outline"
                size="sm"
                className="text-accent hover:bg-accent/10 flex-1 h-9"
                onClick={() => onEdit(socio)}
              >
                <Edit className="h-4 w-4 mr-2" /> Editar
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:bg-destructive/10 flex-1 h-9"
                onClick={() => onDelete(socio)}
              >
                <Trash2 className="h-4 w-4 mr-2" /> Eliminar
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default SocioCardView;
