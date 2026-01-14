import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, UploadCloud, FileText, Download } from 'lucide-react'; // DollarSign and Receipt removed
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface SocioStatusAndDocumentsProps {
  socioId: string;
}

// Define Lot Type (Updated to include all required socio and financial data)
interface Lot {
  id: string; // Unique ID for selection (socioId for primary, mock-X for simulated)
  mz: string;
  lote: string;
  is_lote_medido: boolean;
  isPrimary: boolean; // Identifies the lot linked to socio_titulares
  // New fields for the comprehensive table view
  fullName: string;
  dni: string;
  paymentStatus: 'Pagado' | 'Pendiente' | 'Atrasado';
  receiptNumber: string;
  documentLink: string | null;
}

/**
 * Componente para gestionar el estado de ingeniería (medición de lote)
 * y simular la sección de carga de documentos, ahora con edición masiva de lotes.
 */
function SocioStatusAndDocuments({ socioId }: SocioStatusAndDocumentsProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lots, setLots] = useState<Lot[]>([]);
  const [selectedLotIds, setSelectedLotIds] = useState<string[]>([]);

  // Helper function for payment status badge
  const getPaymentStatusBadge = (status: Lot['paymentStatus']) => {
    const base = "px-2 py-0.5 rounded-full text-xs font-semibold";
    switch (status) {
        case 'Pagado':
            return <span className={cn(base, "bg-success/20 text-success")}>Pagado</span>;
        case 'Pendiente':
            return <span className={cn(base, "bg-warning/20 text-warning")}>Pendiente</span>;
        case 'Atrasado':
            return <span className={cn(base, "bg-error/20 text-error")}>Atrasado</span>;
        default:
            return <span className={cn(base, "bg-textSecondary/10 text-textSecondary")}>N/A</span>;
    }
  };

  // --- Fetch initial data ---
  useEffect(() => {
    const fetchStatusAndLot = async () => {
      if (!socioId) return;
      setIsLoading(true);
      
      // Fetch the primary lot data and socio details
      const { data, error } = await supabase
        .from('socio_titulares')
        .select('mz, lote, is_lote_medido, nombres, apellidoPaterno, apellidoMaterno, dni')
        .eq('id', socioId)
        .single();

      if (error) {
        console.error('Error fetching socio status:', error.message);
        toast.error('Error al cargar estado de ingeniería', { description: error.message });
        setIsLoading(false);
        return;
      } 
      
      if (data) {
        const socioFullName = `${data.nombres} ${data.apellidoPaterno} ${data.apellidoMaterno}`;
        const socioDni = data.dni;

        const primaryLot: Lot = {
          id: socioId, 
          mz: data.mz || 'N/A',
          lote: data.lote || 'N/A',
          is_lote_medido: data.is_lote_medido || false,
          isPrimary: true,
          fullName: socioFullName,
          dni: socioDni,
          paymentStatus: 'Pagado', // Simulated
          receiptNumber: 'R-2025-001', // Simulated
          documentLink: 'https://example.com/doc/primary', // Simulated
        };

        // SIMULACIÓN DE MÚLTIPLES LOTES PARA DEMOSTRAR BULK EDITING
        // En un sistema real, esto se cargaría desde una tabla 'socio_lotes'.
        const mockLots: Lot[] = [
          { 
            id: 'mock-1', 
            mz: 'B', 
            lote: '10', 
            is_lote_medido: false, 
            isPrimary: false,
            fullName: socioFullName,
            dni: socioDni,
            paymentStatus: 'Pendiente', // Simulated
            receiptNumber: 'N/A', // Simulated
            documentLink: null, // Simulated
          },
          { 
            id: 'mock-2', 
            mz: 'C', 
            lote: '5', 
            is_lote_medido: true, 
            isPrimary: false,
            fullName: socioFullName,
            dni: socioDni,
            paymentStatus: 'Atrasado', // Simulated
            receiptNumber: 'R-2024-150', // Simulated
            documentLink: 'https://example.com/doc/mock2', // Simulated
          },
        ];

        // Combine primary lot and mock lots. Filter out primary lot if MZ/Lote are null/empty.
        const initialLots = (primaryLot.mz !== 'N/A' || primaryLot.lote !== 'N/A') 
          ? [primaryLot, ...mockLots] 
          : mockLots;

        setLots(initialLots);
        
        // Initialize selection based on current measured status
        const initialSelected = initialLots
          .filter(lot => lot.is_lote_medido)
          .map(lot => lot.id);
        setSelectedLotIds(initialSelected);
      }
      setIsLoading(false);
    };
    fetchStatusAndLot();
  }, [socioId]);

  // --- Selection Handlers ---
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedLotIds(lots.map(lot => lot.id));
    } else {
      setSelectedLotIds([]);
    }
  };

  const handleSelectLot = (lotId: string, checked: boolean) => {
    setSelectedLotIds(prev => {
      if (checked) {
        return [...prev, lotId];
      } else {
        return prev.filter(id => id !== lotId);
      }
    });
  };

  // --- Submission Handler (Bulk Update Simulation) ---
  const handleBulkUpdate = async () => {
    setIsSubmitting(true);
    
    // 1. Identify the primary lot (the one linked to socio_titulares)
    const primaryLot = lots.find(lot => lot.isPrimary);
    
    if (!primaryLot) {
      toast.error('Error', { description: 'No se encontró el lote principal para actualizar.' });
      setIsSubmitting(false);
      return;
    }

    // 2. Determine the new status for the primary lot based on current selection state
    const newPrimaryStatus = selectedLotIds.includes(primaryLot.id);

    try {
      // Only update the primary lot's status in the socio_titulares table
      const { error } = await supabase
        .from('socio_titulares')
        .update({ is_lote_medido: newPrimaryStatus })
        .eq('id', socioId);

      if (error) throw error;
      
      // 3. Update local state for all lots based on selection (Simulating successful bulk update)
      const updatedLots = lots.map(lot => ({
        ...lot,
        is_lote_medido: selectedLotIds.includes(lot.id)
      }));
      setLots(updatedLots);

      toast.success('Estado de lotes actualizado', { 
        description: `Se actualizó el estado de medición del lote principal (${primaryLot.mz}-${primaryLot.lote}) y se simularon los cambios para ${updatedLots.length - 1} lotes adicionales.` 
      });

    } catch (submitError: any) {
      console.error('Error al guardar el estado:', submitError.message);
      toast.error('Error al guardar estado', { description: submitError.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const allSelected = lots.length > 0 && selectedLotIds.length === lots.length;
  const someSelected = selectedLotIds.length > 0 && selectedLotIds.length < lots.length;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8 bg-surface rounded-xl shadow-2xl border border-border">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-textSecondary">Cargando estado de ingeniería...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6 bg-surface rounded-xl shadow-2xl border border-border">
      <h2 className="text-2xl font-bold text-primary border-b border-border pb-3 flex items-center">
        <FileText className="w-6 h-6 mr-2 text-accent" />
        Gestión de Lotes y Documentos
      </h2>

      {/* Sección de Estado de Ingeniería (Lote Medido) - Bulk Table */}
      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-secondary">Detalle de Lotes y Documentación</h3>
        
        <div className="rounded-xl border border-border overflow-x-auto shadow-lg">
          <Table className="min-w-[1200px]"> {/* Ensure minimum width for all columns */}
            <TableHeader className="bg-background/70 sticky top-0">
              <TableRow className="hover:bg-background/70">
                <TableHead className="w-[50px] text-secondary">
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    onCheckedChange={handleSelectAll}
                    aria-label="Seleccionar todos"
                    className="h-5 w-5 border-secondary data-[state=checked]:bg-secondary data-[state=checked]:text-secondary-foreground"
                  />
                </TableHead>
                <TableHead className="text-secondary w-[200px]">Nombre Completo</TableHead>
                <TableHead className="text-secondary w-[120px]">DNI</TableHead>
                <TableHead className="text-secondary w-[80px]">Mz</TableHead>
                <TableHead className="text-secondary w-[80px]">Lote</TableHead>
                <TableHead className="text-secondary w-[120px]">Estado de Pago</TableHead>
                <TableHead className="text-secondary w-[120px]">N° Recibo</TableHead>
                <TableHead className="text-secondary w-[100px] text-center">Documentos</TableHead>
                <TableHead className="text-secondary w-[100px] text-center">Subir Doc.</TableHead>
                <TableHead className="text-secondary w-[100px] text-right">Tipo Lote</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lots.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-24 text-center text-textSecondary">
                    No hay lotes registrados para este socio.
                  </TableCell>
                </TableRow>
              ) : (
                lots.map((lot) => {
                  const isSelected = selectedLotIds.includes(lot.id);
                  return (
                    <TableRow 
                      key={lot.id} 
                      className={cn(
                        "cursor-pointer transition-colors duration-150",
                        isSelected ? "bg-secondary/10 hover:bg-secondary/20" : "hover:bg-background/50"
                      )}
                      onClick={() => handleSelectLot(lot.id, !isSelected)}
                    >
                      {/* 1. Lote Medido Checkbox */}
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => handleSelectLot(lot.id, !!checked)}
                          aria-label={`Seleccionar lote ${lot.mz}-${lot.lote}`}
                          className="h-5 w-5 border-secondary data-[state=checked]:bg-secondary data-[state=checked]:text-secondary-foreground"
                        />
                        <span className={cn(
                          "ml-2 text-xs font-medium",
                          isSelected ? "text-success" : "text-warning"
                        )}>
                          {isSelected ? 'MEDIDO' : 'PENDIENTE'}
                        </span>
                      </TableCell>
                      {/* 2. Nombre Completo */}
                      <TableCell className="font-medium text-foreground truncate max-w-[200px]">{lot.fullName}</TableCell>
                      {/* 3. DNI */}
                      <TableCell className="text-textSecondary">{lot.dni}</TableCell>
                      {/* 4. Mz */}
                      <TableCell className="font-medium text-foreground">{lot.mz}</TableCell>
                      {/* 5. Lote */}
                      <TableCell className="font-medium text-foreground">{lot.lote}</TableCell>
                      {/* 6. Estado de Pago */}
                      <TableCell>{getPaymentStatusBadge(lot.paymentStatus)}</TableCell>
                      {/* 7. N° Recibo */}
                      <TableCell className="text-textSecondary">{lot.receiptNumber}</TableCell>
                      {/* 8. Documentos (Descarga) */}
                      <TableCell className="text-center">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          disabled={!lot.documentLink}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (lot.documentLink) {
                              toast.info('Descarga Simulada', { description: `Descargando documento para ${lot.mz}-${lot.lote}` });
                              // window.open(lot.documentLink, '_blank'); // Real action
                            }
                          }}
                          className={cn("h-8 w-8", lot.documentLink ? "text-primary hover:bg-primary/10" : "text-border cursor-not-allowed")}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </TableCell>
                      {/* 9. Subir Documento */}
                      <TableCell className="text-center">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={(e) => {
                            e.stopPropagation();
                            toast.info('Carga de Archivo', { description: `Abriendo diálogo de carga para lote ${lot.mz}-${lot.lote}` });
                          }}
                          className="h-8 w-8 text-accent hover:bg-accent/10"
                        >
                          <UploadCloud className="h-4 w-4" />
                        </Button>
                      </TableCell>
                      {/* 10. Tipo Lote */}
                      <TableCell className="text-right text-textSecondary">
                        {lot.isPrimary ? (
                          <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-medium">Principal</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-surface/50 text-textSecondary text-xs font-medium">Simulado</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        
        <p className="text-sm text-textSecondary mt-2">
          *Nota: La selección masiva actualiza el estado de 'Lote Medido' del lote principal en la base de datos. Los datos de pago y recibo son simulados.
        </p>
      </div>

      {/* Sección de Carga de Documentos General (Mantenida para documentos no específicos de lote) */}
      <div className="space-y-4 pt-4 border-t border-border">
        <h3 className="text-xl font-semibold text-accent">Carga de Archivos Generales (Planos y Memorias)</h3>
        <div className="border-2 border-dashed border-border p-8 rounded-xl text-center bg-background/50">
          <UploadCloud className="w-10 h-10 mx-auto text-accent mb-3" />
          <p className="text-textSecondary">
            Arrastre y suelte los planos o memorias descriptivas aquí, o haga clic para seleccionar archivos.
          </p>
          <p className="text-xs text-textSecondary/70 mt-1">
            (Funcionalidad de carga de archivos pendiente de implementación)
          </p>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <Button 
          type="button" 
          onClick={handleBulkUpdate} 
          disabled={isSubmitting} 
          className="rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-300"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Guardando Lotes...
            </>
          ) : (
            `Guardar Estado de ${selectedLotIds.length} Lote(s)`
          )}
        </Button>
      </div>
    </div>
  );
}

export default SocioStatusAndDocuments;
