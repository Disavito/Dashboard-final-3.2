import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Search, Download, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { ReciboPagoFormSchema, ReciboPagoFormValues } from '@/lib/types/invoicing';
import { fetchClientByDocument, fetchNextReceiptCorrelative, createIncomeFromBoleta, saveReceiptPdfToSupabase } from '@/lib/api/invoicingApi';
import { Client } from '@/lib/types/invoicing';
// import { generateReceiptPdf } from '@/lib/pdfUtils'; // <-- IMPORTACIÓN ESTÁTICA ELIMINADA
import { TablesInsert } from '@/lib/database.types';
import { format } from 'date-fns';

const PAYMENT_METHODS = [
  { value: 'BBVA Empresa', label: 'BBVA Empresa' },
  { value: 'Efectivo', label: 'Efectivo' },
  { value: 'Cuenta Fidel', label: 'Cuenta Fidel' },
];

function RecibosPage() {
  const { toast } = useToast();
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [correlative, setCorrelative] = useState('');
  const [clientData, setClientData] = useState<Client | null>(null);

  const form = useForm<ReciboPagoFormValues>({
    resolver: zodResolver(ReciboPagoFormSchema),
    defaultValues: {
      dni: '',
      client_name: '',
      client_id: null,
      fecha_emision: format(new Date(), 'yyyy-MM-dd'),
      monto: 250.00,
      concepto: 'Elaboracion de Expediente Tecnico',
      metodo_pago: 'Efectivo',
      numero_operacion: '',
    },
  });

  const dni = form.watch('dni');
  const metodoPago = form.watch('metodo_pago');

  const loadCorrelative = async () => {
    try {
        const nextCorrelative = await fetchNextReceiptCorrelative();
        setCorrelative(nextCorrelative);
        return nextCorrelative;
    } catch (error) {
        console.error(error);
        toast({
          title: "Error de Correlativo",
          description: "No se pudo obtener el siguiente número de recibo (R-00xxx).",
          variant: "destructive",
        });
        return '';
    }
  };

  useEffect(() => {
    loadCorrelative();
  }, []);

  const handleDniSearch = async () => {
    if (!dni || dni.length !== 8) {
      toast({
        title: "DNI Inválido",
        description: "Ingrese un DNI de 8 dígitos.",
        variant: "warning",
      });
      return;
    }

    setIsSearching(true);
    setClientData(null);
    form.setValue('client_name', ''); 
    form.setValue('client_id', null);

    try {
      const client = await fetchClientByDocument(dni);
      
      if (client && client.id) {
        setClientData(client);
        form.setValue('client_name', client.razon_social);
        form.setValue('client_id', client.id);
        toast({
          title: "Socio Encontrado",
          description: `Datos cargados para: ${client.razon_social}`,
        });
      } else {
        toast({
          title: "Socio No Encontrado",
          description: "No se encontró un socio titular con ese DNI.",
          variant: "warning",
        });
      }
    } catch (error) {
      toast({
        title: "Error de Búsqueda",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const onSubmit = async (values: ReciboPagoFormValues) => {
    if (!clientData || !clientData.id || !correlative) {
        toast({
            title: "Datos Incompletos",
            description: "Asegúrese de buscar y cargar los datos del socio y que el correlativo esté disponible.",
            variant: "destructive",
        });
        return;
    }

    setIsSubmitting(true);

    try {
        // 1. Preparar datos para el PDF
        const receiptData = {
            ...values,
            correlative: correlative,
            client_full_name: clientData.razon_social,
            client_dni: clientData.numero_documento,
        };
        
        // 2. Cargar dinámicamente el generador de PDF y crear el Blob
        const { generateReceiptPdf } = await import('@/lib/receiptPdfGenerator');
        const pdfBlob = await generateReceiptPdf(receiptData);

        // 3. Guardar PDF en Supabase Storage y vincular en socio_documentos
        await saveReceiptPdfToSupabase(pdfBlob, correlative, clientData.id);

        // 4. Preparar datos para el registro de ingreso
        const incomeData: Omit<TablesInsert<'ingresos'>, 'id' | 'created_at'> = {
            receipt_number: correlative,
            dni: values.dni,
            full_name: clientData.razon_social,
            amount: values.monto,
            account: values.metodo_pago,
            date: values.fecha_emision,
            transaction_type: 'Recibo de Pago',
            numeroOperacion: values.metodo_pago === 'BBVA Empresa' ? Number(values.numero_operacion) : null,
        };

        // 5. Crear el registro de ingreso en la tabla 'ingresos'
        await createIncomeFromBoleta(incomeData);

        // 6. Notificar éxito con acción de descarga
        toast({
            title: "Recibo Generado y Registrado",
            description: `El Recibo N° ${correlative} ha sido creado, guardado y el ingreso registrado.`,
            action: (
                <Button 
                    onClick={() => {
                        const url = window.URL.createObjectURL(pdfBlob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.setAttribute('download', `${correlative}.pdf`);
                        document.body.appendChild(link);
                        link.click();
                        link.remove();
                        window.URL.revokeObjectURL(url);
                    }}
                    variant="secondary"
                    className="gap-2"
                >
                    <Download className="h-4 w-4" /> Descargar PDF
                </Button>
            ),
            duration: 8000,
        });

        // 7. Resetear el formulario y estado para el siguiente recibo
        form.reset({
            dni: '',
            client_name: '',
            client_id: null,
            fecha_emision: format(new Date(), 'yyyy-MM-dd'),
            monto: 250.00,
            concepto: 'Elaboracion de Expediente Tecnico',
            metodo_pago: 'Efectivo',
            numero_operacion: '',
        });
        setClientData(null);
        loadCorrelative();

    } catch (error) {
        console.error("Error en el proceso de generación de recibo:", error);
        toast({
            title: "Error al Generar Recibo",
            description: (error as Error).message || "Ocurrió un error inesperado.",
            variant: "destructive",
        });
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-4xl">
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-text tracking-tight">Generar Recibo de Pago Interno</h1>
        <p className="text-textSecondary mt-2">
          Emite un recibo de pago para socios. El número de recibo se genera automáticamente.
        </p>
      </header>

      <div className="bg-surface p-6 md:p-8 rounded-lg border border-border shadow-md">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-border">
            <h2 className="text-2xl font-semibold text-text">Formulario de Emisión</h2>
            <div className="text-right">
                <span className="text-sm text-textSecondary block">Número de Recibo</span>
                <span className="text-2xl font-bold text-primary">{correlative || <Loader2 className="h-6 w-6 animate-spin inline-block" />}</span>
            </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2">
                <FormField
                  control={form.control}
                  name="dni"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>DNI del Socio Titular</FormLabel>
                      <div className="flex items-center gap-2">
                        <FormControl>
                          <Input placeholder="Buscar por DNI..." {...field} maxLength={8} />
                        </FormControl>
                        <Button type="button" onClick={handleDniSearch} disabled={isSearching || !dni || dni.length !== 8}>
                          {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                          <span className="ml-2 hidden sm:inline">Buscar</span>
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="md:col-span-1">
                 <FormField
                  control={form.control}
                  name="fecha_emision"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha de Emisión</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="client_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre / Razón Social del Socio</FormLabel>
                  <FormControl>
                    <Input placeholder="El nombre se cargará automáticamente..." {...field} readOnly />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                control={form.control}
                name="monto"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Monto (S/.)</FormLabel>
                    <FormControl>
                        <Input type="number" step="0.01" placeholder="250.00" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={form.control}
                name="metodo_pago"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Método de Pago</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Seleccione un método" />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        {PAYMENT_METHODS.map((method) => (
                            <SelectItem key={method.value} value={method.value}>
                            {method.label}
                            </SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>

            <FormField
              control={form.control}
              name="concepto"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Concepto de Pago</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Elaboración de Expediente Técnico" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {metodoPago === 'BBVA Empresa' && (
                 <FormField
                    control={form.control}
                    name="numero_operacion"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Número de Operación</FormLabel>
                        <FormControl>
                            <Input placeholder="Ingrese el N° de operación del voucher" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
            )}

            <div className="flex justify-end pt-6 border-t border-border">
                <Button 
                    type="submit" 
                    disabled={isSubmitting || !clientData || !correlative}
                    className="w-full md:w-auto gap-2"
                    size="lg"
                >
                  {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileText className="h-5 w-5" />}
                  Generar y Registrar Recibo
                </Button>
            </div>
            {!clientData && (
                <p className="text-sm text-warning text-center mt-4">
                    Por favor, busque y seleccione un socio para poder generar el recibo.
                </p>
            )}
          </form>
        </Form>
      </div>
    </div>
  );
}

export default RecibosPage;
