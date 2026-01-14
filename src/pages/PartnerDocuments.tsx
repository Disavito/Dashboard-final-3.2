import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { ColumnDef, PaginationState, Row } from '@tanstack/react-table';
import { DataTable } from '@/components/ui-custom/DataTable';
import { Loader2, FolderSearch, Search, Upload, FileWarning, CheckSquare, Square, MoreVertical } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { UploadDocumentModal } from '@/components/custom/UploadDocumentModal';
import DocumentLinkPill from '@/components/custom/DocumentLinkPill';
import ConfirmationDialog from '@/components/ui-custom/ConfirmationDialog';
import { useUser } from '@/context/UserContext';
import DocumentCardView from '@/components/ui-custom/DocumentCardView'; // <-- Importar la nueva vista de tarjetas

// Define la estructura de un documento de socio
interface SocioDocumento {
  id: number;
  tipo_documento: string;
  link_documento: string | null;
  transaction_type?: string; // Added for 'Comprobante de Pago' filtering
}

// Define la información de pago obtenida de la tabla 'ingresos'
interface IngresoInfo {
  status: 'Pagado' | 'No Pagado';
  receipt_number: string | null;
}

// Estructura principal para un socio con sus documentos e información de pago
interface SocioConDocumentos {
  id: string; // ID es UUID (string)
  dni: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  localidad: string;
  mz: string | null;
  lote: string | null;
  is_lote_medido: boolean | null; // <-- NUEVO CAMPO
  socio_documentos: SocioDocumento[];
  paymentInfo: IngresoInfo;
}

type DocumentoRequerido = 'Planos de ubicación' | 'Memoria descriptiva';

// Helper function to determine bucket name based on document type
const getBucketNameForDocumentType = (docType: string): string => {
  switch (docType) {
    case 'Planos de ubicación':
      return 'planos';
    case 'Memoria descriptiva':
      return 'memorias';
    default:
      return 'documents';
  }
};

function PartnerDocuments() {
  const [sociosConDocumentos, setSociosConDocumentos] = useState<SocioConDocumentos[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocalidad, setSelectedLocalidad] = useState('all');
  const [localidades, setLocalidades] = useState<string[]>([]);
  
  // Estado para la selección de filas (para edición masiva)
  const [rowSelection, setRowSelection] = useState({});
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    socioId: string | null; // ID es string (UUID)
    socioName: string;
    documentType: DocumentoRequerido | null;
  }>({
    isOpen: false,
    socioId: null,
    socioName: '',
    documentType: null,
  });

  const [deleteConfirmState, setDeleteConfirmState] = useState<{
    isOpen: boolean;
    documentId: number | null;
    documentLink: string | null;
    documentType: string | null;
    socioName: string | null;
  }>({
    isOpen: false,
    documentId: null,
    documentLink: null,
    documentType: null,
    socioName: null,
  });
  const [isDeleting, setIsDeleting] = useState(false);

  const { roles, loading: userLoading } = useUser();
  const isAdmin = useMemo(() => roles?.includes('admin') ?? false, [roles]); // FIX: Ensure isAdmin is always boolean

  // Estado para la paginación
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const allowedDocumentTypes = useMemo(() => [
    "Planos de ubicación",
    "Memoria descriptiva",
    "Ficha",
    "Contrato",
    "Comprobante de Pago"
  ], []);

  const requiredDocumentTypes: DocumentoRequerido[] = useMemo(() => [
    "Planos de ubicación",
    "Memoria descriptiva"
  ], []);

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Obtener socios (con sus documentos anidados), localidades e ingresos
      const [sociosRes, localidadesRes, ingresosRes] = await Promise.all([
        supabase
          .from('socio_titulares')
          .select(`
            id, dni, nombres, apellidoPaterno, apellidoMaterno, localidad, mz, lote, is_lote_medido,
            socio_documentos (id, tipo_documento, link_documento)
          `)
          .order('apellidoPaterno', { ascending: true }),
        supabase.from('socio_titulares').select('localidad').neq('localidad', null),
        supabase.from('ingresos').select('dni, receipt_number, transaction_type').neq('dni', null)
      ]);

      if (sociosRes.error) throw sociosRes.error;
      if (localidadesRes.error) throw localidadesRes.error;
      if (ingresosRes.error) throw ingresosRes.error;

      const uniqueLocalidades = [...new Set(localidadesRes.data.map(item => item.localidad).filter(Boolean) as string[])];
      setLocalidades(uniqueLocalidades.sort());

      // Nuevo map para agrupar todos los ingresos por DNI
      const ingresosByDni = new Map<string, Array<{ receipt_number: string | null; transaction_type: string | null }>>();
      ingresosRes.data.forEach(ingreso => {
        if (ingreso.dni) {
          if (!ingresosByDni.has(ingreso.dni)) {
            ingresosByDni.set(ingreso.dni, []);
          }
          ingresosByDni.get(ingreso.dni)?.push({
            receipt_number: ingreso.receipt_number,
            transaction_type: ingreso.transaction_type,
          });
        }
      });

      // Nuevo map para filtrar documentos por tipo de transacción (para la columna 'Documentos')
      const receiptTransactionTypeMap = new Map<string, string>(); // Map: receipt_number -> transaction_type
      ingresosRes.data.forEach(ingreso => {
        if (ingreso.receipt_number && ingreso.transaction_type) {
          receiptTransactionTypeMap.set(ingreso.receipt_number, ingreso.transaction_type);
        }
      });

      // 2. Procesar y combinar la información
      const processedData = sociosRes.data.map(socio => {
        let validReceiptNumber: string | null = null;
        let paymentStatus: 'Pagado' | 'No Pagado' = 'No Pagado';

        const socioIngresos = ingresosByDni.get(socio.dni) || [];
        const validTransactionTypes = ['Venta', 'Ingreso', 'Recibo de Pago'];

        for (const ingreso of socioIngresos) {
          if (ingreso.receipt_number && ingreso.transaction_type && validTransactionTypes.includes(ingreso.transaction_type)) {
            validReceiptNumber = ingreso.receipt_number;
            paymentStatus = 'Pagado';
            break;
          }
        }

        const paymentInfo: IngresoInfo = {
          status: paymentStatus,
          receipt_number: validReceiptNumber,
        };

        const filteredSocioDocuments = socio.socio_documentos.filter(doc => {
          if (!allowedDocumentTypes.includes(doc.tipo_documento) || !doc.link_documento) {
            return false;
          }

          if (doc.tipo_documento === 'Comprobante de Pago') {
            const parts = doc.link_documento.split('/');
            const fileNameWithExtension = parts[parts.length - 1];
            const serieCorrelativo = fileNameWithExtension.replace('.pdf', '');

            const transactionType = receiptTransactionTypeMap.get(serieCorrelativo);

            return transactionType && validTransactionTypes.includes(transactionType);
          }

          return true;
        }).map(doc => {
          if (doc.tipo_documento === 'Comprobante de Pago' && doc.link_documento) {
            const parts = doc.link_documento.split('/');
            const fileNameWithExtension = parts[parts.length - 1];
            const serieCorrelativo = fileNameWithExtension.replace('.pdf', '');
            const transactionType = receiptTransactionTypeMap.get(serieCorrelativo);
            return { ...doc, transaction_type: transactionType };
          }
          return doc;
        });

        // --- NUEVA REGLA DE NEGOCIO: Derivar is_lote_medido de los documentos ---
        const hasPlanos = filteredSocioDocuments.some(
          doc => doc.tipo_documento === 'Planos de ubicación' && doc.link_documento
        );
        const hasMemoria = filteredSocioDocuments.some(
          doc => doc.tipo_documento === 'Memoria descriptiva' && doc.link_documento
        );
        
        // Si tiene Planos O Memoria, el lote se considera Medido (override)
        const isMeasuredByDocument = hasPlanos || hasMemoria;
        
        // El valor final para la UI es: Documentos > DB value
        const finalIsLoteMedido = isMeasuredByDocument || (socio.is_lote_medido ?? false);
        // ----------------------------------------------------------------------

        return {
          ...socio,
          is_lote_medido: finalIsLoteMedido, // Usamos el valor derivado
          socio_documentos: filteredSocioDocuments,
          paymentInfo: paymentInfo,
        } as SocioConDocumentos; // Aseguramos el tipo de retorno
      });

      setSociosConDocumentos(processedData);
      setError(null);
    } catch (error: any) {
      console.error('Error fetching data:', error.message);
      setError('Error al cargar los datos. Por favor, revisa la consola para más detalles.');
      toast.error('Error al cargar datos', { description: error.message });
      setSociosConDocumentos([]);
    } finally {
      setLoading(false);
    }
  }, [allowedDocumentTypes]);


  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // --- Lógica de Actualización de Lote Medido ---

  const handleUpdateLoteMedido = useCallback(async (socioId: string, newValue: boolean) => {
    if (!isAdmin) {
      toast.error('Permiso denegado', { description: 'Solo los administradores pueden modificar el estado de Lote Medido.' });
      return;
    }
    
    const originalData = sociosConDocumentos.find(s => s.id === socioId);
    if (!originalData) return;

    // --- REGLA DE NEGOCIO: Bloquear desmarcar si hay documentos requeridos ---
    const hasRequiredDocs = originalData.socio_documentos.some(doc => 
        (doc.tipo_documento === 'Planos de ubicación' || doc.tipo_documento === 'Memoria descriptiva') && doc.link_documento
    );

    if (!newValue && hasRequiredDocs) {
        toast.warning('Acción Bloqueada', { 
            description: 'El lote no puede ser marcado como "No Medido" porque ya tiene Planos de ubicación o Memoria descriptiva subidos.' 
        });
        return;
    }
    // -----------------------------------------------------------------------------

    // Optimistic update
    setSociosConDocumentos(prev => prev.map(s => 
      s.id === socioId ? { ...s, is_lote_medido: newValue } : s
    ));

    try {
      const { error: updateError } = await supabase
        .from('socio_titulares')
        .update({ is_lote_medido: newValue })
        .eq('id', socioId);

      if (updateError) throw updateError;

      toast.success('Estado de Lote Medido actualizado', {
        description: `${originalData.nombres} ${originalData.apellidoPaterno} ahora está marcado como ${newValue ? 'Medido' : 'No Medido'}.`
      });
    } catch (error: any) {
      console.error('Error updating lote medido:', error.message);
      toast.error('Error al actualizar', { description: `No se pudo actualizar el estado: ${error.message}` });
      // Revert optimistic update
      setSociosConDocumentos(prev => prev.map(s => 
        s.id === socioId ? { ...s, is_lote_medido: originalData.is_lote_medido } : s
      ));
    }
  }, [isAdmin, sociosConDocumentos]);

  const handleBulkUpdateLoteMedido = useCallback(async (newValue: boolean, selectedRows: Row<SocioConDocumentos>[]) => {
    if (!isAdmin) {
      toast.error('Permiso denegado', { description: 'Solo los administradores pueden realizar ediciones masivas.' });
      return;
    }

    if (selectedRows.length === 0) {
      toast.warning('Selección vacía', { description: 'Por favor, selecciona al menos un socio para actualizar.' });
      return;
    }

    setIsBulkUpdating(true);
    
    let selectedIds = selectedRows.map(row => row.original.id);
    let blockedCount = 0;

    if (!newValue) {
        // Si se intenta marcar como NO MEDIDO (false), filtramos los socios que tienen documentos requeridos
        const allowedRows = selectedRows.filter(row => {
            const hasRequiredDocs = row.original.socio_documentos.some(doc => 
                (doc.tipo_documento === 'Planos de ubicación' || doc.tipo_documento === 'Memoria descriptiva') && doc.link_documento
            );
            if (hasRequiredDocs) {
                blockedCount++;
                return false; // Bloquear actualización
            }
            return true; // Permitir actualización
        });
        selectedIds = allowedRows.map(row => row.original.id);
    }

    if (selectedIds.length === 0) {
        setIsBulkUpdating(false);
        if (blockedCount > 0) {
            toast.warning('Actualización Masiva Cancelada', { 
                description: `No se pudo actualizar ninguna fila. ${blockedCount} socio(s) fueron omitidos porque tienen documentos requeridos y no pueden ser marcados como "No Medido".` 
            });
        } else {
            toast.warning('Selección vacía', { description: 'Por favor, selecciona al menos un socio para actualizar.' });
        }
        return;
    }

    try {
      // 1. Actualizar en Supabase
      const { error: updateError } = await supabase
        .from('socio_titulares')
        .update({ is_lote_medido: newValue })
        .in('id', selectedIds);

      if (updateError) throw updateError;

      // 2. Actualizar estado local (refetch es más seguro)
      let successMessage = `Se actualizaron ${selectedIds.length} socios a Lote ${newValue ? 'Medido' : 'No Medido'}.`;
      if (blockedCount > 0) {
          successMessage += ` (${blockedCount} socio(s) fueron omitidos por tener documentos subidos).`;
      }

      toast.success('Actualización Masiva Exitosa', {
        description: successMessage
      });
      
      // 3. Limpiar selección y recargar datos
      setRowSelection({});
      fetchAllData();

    } catch (error: any) {
      console.error('Error during bulk update:', error.message);
      toast.error('Error en la Edición Masiva', { description: error.message });
    } finally {
      setIsBulkUpdating(false);
    }
  }, [isAdmin, fetchAllData]);

  // --- Fin Lógica de Actualización de Lote Medido ---


  const handleOpenModal = (socio: SocioConDocumentos, documentType: DocumentoRequerido) => {
    const fullName = `${socio.nombres || ''} ${socio.apellidoPaterno || ''}`.trim();
    setModalState({
      isOpen: true,
      socioId: socio.id, // socio.id is string (UUID)
      socioName: fullName,
      documentType: documentType,
    });
  };

  const handleDeleteDocument = useCallback(async () => {
    if (!deleteConfirmState.documentId || !deleteConfirmState.documentLink || !deleteConfirmState.documentType) {
      toast.error('Error: No se pudo obtener la información completa del documento para eliminar.');
      return;
    }

    setIsDeleting(true);
    try {
      const { documentId, documentLink, documentType, socioName } = deleteConfirmState;

      const bucketName = getBucketNameForDocumentType(documentType);
      if (!bucketName) {
        throw new Error(`No se pudo determinar el nombre del bucket para el tipo de documento: ${documentType}`);
      }

      const url = new URL(documentLink);
      const pathSegments = url.pathname.split('/');
      const publicIndex = pathSegments.indexOf('public');
      if (publicIndex === -1 || publicIndex + 2 >= pathSegments.length) {
        throw new Error('Formato de URL de documento inesperado.');
      }
      
      const filePath = pathSegments.slice(publicIndex + 2).join('/');

      if (!filePath) {
        throw new Error('No se pudo extraer la ruta del archivo del enlace.');
      }

      // 1. Delete file from Supabase Storage
      const { error: storageError } = await supabase.storage
        .from(bucketName)
        .remove([filePath]);

      if (storageError) {
        console.warn(`Advertencia: No se pudo eliminar el archivo del almacenamiento (${bucketName}): ${storageError.message}`);
      }

      // 2. Delete record from socio_documentos table
      const { error: dbError } = await supabase
        .from('socio_documentos')
        .delete()
        .eq('id', documentId);

      if (dbError) {
        throw dbError;
      }

      toast.success(`Documento "${documentType}" de ${socioName} eliminado correctamente.`);
      setDeleteConfirmState({ isOpen: false, documentId: null, documentLink: null, documentType: null, socioName: null });
      
      // Refetch para actualizar el estado de Lote Medido si se eliminó un documento clave
      fetchAllData(); 
    } catch (error: any) {
      console.error('Error al eliminar el documento:', error.message);
      toast.error('Error al eliminar el documento', { description: error.message });
    } finally {
      setIsDeleting(false);
    }
  }, [deleteConfirmState, fetchAllData]);

  const openDeleteConfirmDialog = useCallback((documentId: number, documentLink: string, documentType: string, socioName: string) => {
    setDeleteConfirmState({
      isOpen: true,
      documentId,
      documentLink,
      documentType,
      socioName,
    });
  }, []);

  const filteredData = useMemo(() => {
    return sociosConDocumentos.filter(socio => {
      const searchLower = searchQuery.toLowerCase().trim();
      const fullName = (`${socio.nombres || ''} ${socio.apellidoPaterno || ''} ${socio.apellidoMaterno || ''}`).toLowerCase().trim();
      const dni = (socio.dni || '').toLowerCase();
      const mz = (socio.mz || '').toLowerCase();
      const lote = (socio.lote || '').toLowerCase();
      const matchesLocalidad = selectedLocalidad === 'all' || socio.localidad === selectedLocalidad;

      if (!searchLower) return matchesLocalidad;

      const searchTerms = searchLower.split(' ').filter(term => term.length > 0);
      const matchesDni = dni.includes(searchLower);
      const matchesName = searchTerms.every(term => fullName.includes(term));
      const matchesMz = mz.includes(searchLower);
      const matchesLote = lote.includes(searchLower);

      return matchesLocalidad && (matchesDni || matchesName || matchesMz || matchesLote);
    });
  }, [sociosConDocumentos, searchQuery, selectedLocalidad]);

  const columns: ColumnDef<SocioConDocumentos>[] = useMemo(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && 'indeterminate')
            }
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Seleccionar todos"
            className="translate-y-[2px]"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Seleccionar fila"
            className="translate-y-[2px]"
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: 'nombreCompleto',
        header: 'Nombre Completo',
        cell: ({ row }) => {
          const socio = row.original;
          const fullName = `${socio.nombres || ''} ${socio.apellidoPaterno || ''} ${socio.apellidoMaterno || ''}`.trim();
          return <div className="font-medium text-text">{fullName || 'N/A'}</div>;
        },
      },
      {
        accessorKey: 'dni',
        header: 'DNI',
        cell: ({ row }) => <div className="text-textSecondary">{row.getValue('dni') || 'N/A'}</div>,
      },
      {
        accessorKey: 'mz',
        header: 'Mz',
        cell: ({ row }) => <div className="text-textSecondary">{row.original.mz || 'N/A'}</div>,
      },
      {
        accessorKey: 'lote',
        header: 'Lote',
        cell: ({ row }) => <div className="text-textSecondary">{row.original.lote || 'N/A'}</div>,
      },
      {
        accessorKey: 'is_lote_medido',
        header: 'Lote Medido',
        cell: ({ row }) => {
          const socio = row.original;
          const isMedido = socio.is_lote_medido ?? false;
          
          return (
            <div className="flex items-center justify-center">
              <Checkbox
                checked={isMedido}
                onCheckedChange={(checked) => {
                  // checked puede ser boolean o 'indeterminate'
                  if (typeof checked === 'boolean') {
                    handleUpdateLoteMedido(socio.id, checked);
                  }
                }}
                disabled={!isAdmin}
                aria-label={`Marcar lote de ${socio.nombres} como medido`}
                className="h-5 w-5 border-border data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
              />
            </div>
          );
        },
        enableSorting: true,
        enableHiding: true,
      },
      {
        accessorKey: 'paymentInfo.status',
        header: 'Estado de Pago',
        cell: ({ row }) => {
          const { status } = row.original.paymentInfo;
          return (
            <Badge variant={status === 'Pagado' ? 'success' : 'destructive'}>
              {status}
            </Badge>
          );
        },
      },
      {
        accessorKey: 'paymentInfo.receipt_number',
        header: 'N° Recibo',
        cell: ({ row }) => row.original.paymentInfo.receipt_number || <span className="text-textSecondary/70 italic">N/A</span>,
      },
      {
        id: 'documentos',
        header: 'Documentos',
        cell: ({ row }) => {
          const socio = row.original;
          const { socio_documentos } = socio;

          if (socio_documentos.length === 0) {
            return <span className="text-textSecondary/70 italic text-sm">Sin documentos</span>;
          }

          return (
            <div className="flex flex-wrap gap-2 items-start">
              {socio_documentos.map((doc) => (
                <DocumentLinkPill
                  key={doc.id}
                  type={doc.tipo_documento}
                  link={doc.link_documento!}
                  isAdmin={isAdmin}
                  onDelete={() => openDeleteConfirmDialog(doc.id, doc.link_documento!, doc.tipo_documento, `${socio.nombres} ${socio.apellidoPaterno}`)}
                />
              ))}
            </div>
          );
        },
      },
      {
        id: 'acciones',
        header: 'Subir Faltantes',
        cell: ({ row }) => {
          const socio = row.original;
          const missingDocs = requiredDocumentTypes.filter(docType => {
            const doc = socio.socio_documentos.find(d => d.tipo_documento === docType);
            return !doc || !doc.link_documento;
          });

          if (missingDocs.length === 0) {
            return <span className="text-sm text-success italic">Completo</span>;
          }

          return (
            <div className="flex flex-col items-start gap-2">
              {missingDocs.map(docType => (
                <Button
                  key={docType}
                  variant="outline"
                  size="sm"
                  className="text-xs h-auto py-1 px-2"
                  onClick={() => handleOpenModal(socio, docType as DocumentoRequerido)}
                >
                  <Upload className="mr-2 h-3 w-3" />
                  Subir {docType === 'Planos de ubicación' ? 'Planos' : 'Memoria'}
                </Button>
              ))}
            </div>
          );
        },
      },
    ],
    [requiredDocumentTypes, isAdmin, openDeleteConfirmDialog, handleUpdateLoteMedido]
  );

  // Componente para las acciones masivas
  const BulkActions = ({ tableInstance }: { tableInstance: any }) => {
    const selectedRows = tableInstance?.getSelectedRowModel().rows || [];
    const selectedCount = selectedRows.length;

    if (!isAdmin || selectedCount === 0) return null;

    return (
      <div className="flex items-center space-x-2 mb-4 p-3 bg-surface/70 border border-border rounded-lg shadow-inner flex-wrap gap-y-2">
        <span className="text-sm font-medium text-textSecondary">
          {selectedCount} {selectedCount === 1 ? 'fila seleccionada' : 'filas seleccionadas'}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm" disabled={isBulkUpdating}>
              {isBulkUpdating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <MoreVertical className="mr-2 h-4 w-4" />
              )}
              Acciones Masivas
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="bg-surface border-border">
            <DropdownMenuItem 
              onClick={() => handleBulkUpdateLoteMedido(true, selectedRows)}
              disabled={isBulkUpdating}
              className="text-success hover:!bg-success/10"
            >
              <CheckSquare className="mr-2 h-4 w-4" /> Marcar como Lote Medido
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => handleBulkUpdateLoteMedido(false, selectedRows)}
              disabled={isBulkUpdating}
              className="text-warning hover:!bg-warning/10"
            >
              <Square className="mr-2 h-4 w-4" /> Marcar como Lote NO Medido
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem onClick={() => setRowSelection({})} disabled={isBulkUpdating}>
              Limpiar Selección
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  if (loading || userLoading) {
    return (
      <div className="min-h-screen bg-background text-text font-sans flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg">Cargando documentos y permisos...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background text-text font-sans flex items-center justify-center">
        <p className="text-destructive text-lg text-center p-4">{error}</p>
      </div>
    );
  }

  // Renderizado de contenido principal
  const renderTableOrCards = () => {
    if (filteredData.length === 0) {
      return (
        <div className="text-center py-16 px-6 bg-surface/50 rounded-lg border-2 border-dashed border-border">
          <FileWarning className="mx-auto h-12 w-12 text-textSecondary" />
          <h3 className="mt-4 text-xl font-semibold text-text">No se encontraron socios</h3>
          <p className="mt-2 text-sm text-textSecondary">
            Prueba a cambiar los filtros de búsqueda o de localidad.
          </p>
          <p className="mt-1 text-xs text-textSecondary/70">
            (Si esperabas ver datos, verifica que tu rol tenga permisos para acceder a los titulares).
          </p>
        </div>
      );
    }

    return (
      <>
        {/* Desktop/Tablet View: DataTable */}
        <div className="hidden md:block">
          <DataTable 
            columns={columns} 
            data={filteredData} 
            pagination={pagination}
            onPaginationChange={setPagination}
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            renderAboveTable={(tableInstance) => (
              <BulkActions tableInstance={tableInstance} />
            )}
          />
        </div>

        {/* Mobile View: Card View */}
        <div className="md:hidden">
          <DocumentCardView
            data={filteredData}
            requiredDocumentTypes={requiredDocumentTypes}
            isAdmin={isAdmin} // FIX: isAdmin is now guaranteed boolean
            onOpenUploadModal={(socio, docType) => handleOpenModal(socio, docType as DocumentoRequerido)}
            onDeleteDocument={openDeleteConfirmDialog}
            onUpdateLoteMedido={handleUpdateLoteMedido}
          />
        </div>
      </>
    );
  };


  return (
    <div className="min-h-screen bg-background text-text font-sans"> {/* Root container */}
      <header className="relative h-48 md:h-64 flex items-center justify-center overflow-hidden bg-gradient-to-br from-accent to-primary rounded-xl shadow-lg mb-8">
        <img
          src="https://images.pexels.com/photos/1181352/pexels-photo-1181352.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2"
          alt="Document organization"
          className="absolute inset-0 w-full h-full object-cover opacity-20"
        />
        <div className="relative z-10 text-center p-4">
          <h1 className="text-4xl md:text-5xl font-extrabold text-white drop-shadow-lg leading-tight">
            Documentos de Socios
          </h1>
          <p className="mt-2 text-lg md:text-xl text-white text-opacity-90 max-w-2xl mx-auto">
            Filtra, busca y accede a la documentación clave de cada socio.
          </p>
        </div>
      </header>

      <div className="py-6 md:py-10"> {/* Main content wrapper - No padding here */}
        <Card className="bg-surface rounded-xl shadow-lg border-border">
          <CardHeader className="border-b border-border/50">
            <CardTitle className="text-2xl font-bold text-primary flex items-center gap-3">
              <FolderSearch className="h-7 w-7" />
              Socio y Documentos
            </CardTitle>
            <CardDescription className="text-textSecondary pt-1">
              Tabla de socios con enlaces directos a sus documentos, estado de pago y filtros de búsqueda.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-2 md:p-6"> {/* Adjusted internal padding wrapper: p-2 on mobile */}
            <div className="flex flex-col md:flex-row items-center gap-4 mb-6">
              <div className="relative w-full md:flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-textSecondary" />
                <Input
                  placeholder="Buscar por DNI, nombre, apellidos, Mz o Lote..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-full bg-background border-border rounded-lg focus:ring-2 focus:ring-primary"
                />
              </div>
              <Select value={selectedLocalidad} onValueChange={setSelectedLocalidad}>
                <SelectTrigger className="w-full md:w-[220px] bg-background border-border rounded-lg focus:ring-2 focus:ring-primary">
                  <SelectValue placeholder="Filtrar por localidad" />
                </SelectTrigger>
                <SelectContent className="border-border bg-surface">
                  <SelectItem value="all">Todas las localidades</SelectItem>
                  {localidades.map(loc => (
                    <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {renderTableOrCards()}

          </CardContent>
        </Card>
      </div>
      <UploadDocumentModal
        isOpen={modalState.isOpen}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setModalState({ isOpen: false, socioId: null, socioName: '', documentType: null });
          }
        }}
        socioId={modalState.socioId} // FIX: socioId is now correctly typed as string | null
        socioName={modalState.socioName}
        documentType={modalState.documentType}
        onUploadSuccess={() => {
          toast.info('Actualizando la tabla de documentos...');
          // Refetch para actualizar el estado de Lote Medido después de una subida exitosa
          fetchAllData();
        }}
      />
      <ConfirmationDialog
        isOpen={deleteConfirmState.isOpen}
        onClose={() => setDeleteConfirmState({ isOpen: false, documentId: null, documentLink: null, documentType: null, socioName: null })}
        onConfirm={handleDeleteDocument}
        title="Confirmar Eliminación de Documento"
        description={`¿Estás seguro de que quieres eliminar el documento "${deleteConfirmState.documentType}" de ${deleteConfirmState.socioName}? Esta acción es irreversible y eliminará el archivo del almacenamiento.`}
        data={{
          'Tipo de Documento': deleteConfirmState.documentType,
          'Socio': deleteConfirmState.socioName,
        }}
        confirmButtonText="Eliminar Documento"
        isConfirming={isDeleting}
      />
    </div>
  );
}

export default PartnerDocuments;
