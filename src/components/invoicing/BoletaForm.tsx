import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PlusCircle, Trash2, Loader2, Send, Search, CalendarIcon, FileText, RotateCcw, Banknote } from 'lucide-react';
import { BoletaFormValues, BoletaFormSchema, Client, BoletaPayload } from '@/lib/types/invoicing';
import { issueBoleta, fetchClientByDocument, generateBoletaPdf, saveBoletaPdfToSupabase, downloadBoletaPdfToBrowser, createIncomeFromBoleta } from '@/lib/api/invoicingApi';
import { useToast } from '@/components/ui/use-toast';
import { 
  COMPANY_ID, 
  BRANCH_ID, 
  DEFAULT_SERIE_BOLETA, 
  DEFAULT_MONEDA, 
  DEFAULT_TIPO_OPERACION, 
  DEFAULT_FORMA_PAGO, 
  TIPO_DOCUMENTO_CLIENTE, 
  TIPO_AFECTACION_IGV,
  DEFAULT_ITEM_CODE,
  DEFAULT_SUNAT_PRODUCT_CODE
} from '@/lib/constants';
import { useState, useCallback, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Checkbox } from '../ui/checkbox';
import { supabase } from '@/lib/supabaseClient';

const getTodayDate = () => new Date().toISOString().split('T')[0];

const calculateBaseValue = (totalPrice: number, igvPercentage: number): number => {
  if (igvPercentage === 0) return totalPrice;
  const igvRate = igvPercentage / 100;
  const baseValue = totalPrice / (1 + igvRate);
  return parseFloat(baseValue.toFixed(2));
};

const DEFAULT_IGV_PERCENTAGE = 18;

interface LastIssuedBoleta {
  id: number;
  numero_completo: string;
}

const defaultClient: Client = {
  tipo_documento: '1',
  numero_documento: '',
  razon_social: '',
  nombre_comercial: '',
  direccion: '',
  ubigeo: '',
  distrito: '',
  provincia: '',
  departamento: '',
  telefono: '',
  email: '',
};

const defaultValues: BoletaFormValues = {
  serie: DEFAULT_SERIE_BOLETA,
  fecha_emision: getTodayDate(),
  moneda: DEFAULT_MONEDA,
  tipo_operacion: DEFAULT_TIPO_OPERACION,
  metodo_envio: 'resumen_diario',
  forma_pago_tipo: DEFAULT_FORMA_PAGO,
  usuario_creacion: 'admin_user',
  client: defaultClient,
  detalles: [
    {
      codigo: DEFAULT_ITEM_CODE,
      descripcion: 'Elaboracion de Expediente Tecnico', // UPDATED
      unidad: 'ZZ', // UPDATED
      cantidad: 1,
      mto_valor_unitario: 250, // UPDATED
      porcentaje_igv: DEFAULT_IGV_PERCENTAGE,
      tip_afe_igv: '10',
      codigo_producto_sunat: DEFAULT_SUNAT_PRODUCT_CODE,
    },
  ],
  // --- VALORES POR DEFECTO PARA INGRESO ---
  create_income_record: true,
  income_date: getTodayDate(),
  income_numero_operacion: '',
  income_account: 'Caja Principal', // Valor por defecto
};

const BoletaForm = () => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClientSearching, setIsClientSearching] = useState(false);
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);
  const [lastIssuedBoleta, setLastIssuedBoleta] = useState<LastIssuedBoleta | null>(null);
  // FIX: currentSocioId debe ser string (UUID) para coincidir con el tipo de clientData.id y saveBoletaPdfToSupabase
  const [currentSocioId, setCurrentSocioId] = useState<string | null>(null); 
  const [accounts, setAccounts] = useState<{ name: string }[]>([]);


  const form = useForm<BoletaFormValues>({
    resolver: zodResolver(BoletaFormSchema),
    defaultValues,
    mode: 'onChange',
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'detalles',
  });

  const createIncomeRecord = form.watch('create_income_record');

  useEffect(() => {
    const fetchAccounts = async () => {
      const { data, error } = await supabase.from('cuentas').select('name');
      if (error) {
        console.error('Error fetching accounts:', error);
        toast({ title: "Error", description: "No se pudieron cargar las cuentas.", variant: "destructive" });
      } else {
        setAccounts(data || []);
        if (data && data.length > 0 && !form.getValues('income_account')) {
          form.setValue('income_account', data[0].name);
        }
      }
    };
    fetchAccounts();
  }, [toast, form]);

  const handleDownloadPdfOnly = async () => {
    if (!lastIssuedBoleta) {
      toast({ title: "Error", description: "No hay una boleta emitida para descargar.", variant: "destructive" });
      return;
    }
    
    try {
      await downloadBoletaPdfToBrowser(lastIssuedBoleta.id, lastIssuedBoleta.numero_completo, 'A4');
      toast({
        title: "Descarga Iniciada",
        description: `Descargando ${lastIssuedBoleta.numero_completo}.pdf.`,
        variant: "success",
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Error al descargar el PDF.";
      toast({
        title: "Error de Descarga",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const onSubmit = async (data: BoletaFormValues) => {
    setIsSubmitting(true);
    setLastIssuedBoleta(null);
    
    const processedDetails = data.detalles.map(d => {
      const total_price = Number(d.mto_valor_unitario);
      const igv_percent = Number(d.porcentaje_igv);
      const base_value = calculateBaseValue(total_price, igv_percent);

      return {
        ...d,
        codigo: d.codigo || '',
        codigo_producto_sunat: d.codigo_producto_sunat || '',
        cantidad: Number(d.cantidad),
        mto_valor_unitario: base_value, 
        porcentaje_igv: igv_percent,
      };
    });

    const processedClient = {
      ...data.client,
      nombre_comercial: data.client.nombre_comercial || '',
      direccion: data.client.direccion || '',
      ubigeo: data.client.ubigeo || '',
      distrito: data.client.distrito || '',
      provincia: data.client.provincia || '',
      departamento: data.client.departamento || '',
      telefono: data.client.telefono || '',
      email: data.client.email || '',
    };

    const payload: BoletaPayload = {
      company_id: COMPANY_ID,
      branch_id: BRANCH_ID,
      serie: data.serie,
      fecha_emision: data.fecha_emision,
      moneda: data.moneda,
      tipo_operacion: data.tipo_operacion,
      metodo_envio: data.metodo_envio,
      forma_pago_tipo: data.forma_pago_tipo,
      usuario_creacion: data.usuario_creacion,
      client: processedClient,
      detalles: processedDetails,
    };

    try {
      const result = await issueBoleta(payload);
      const boletaId = result.data.id;
      const numeroCompleto = result.data.numero_completo;
      
      setLastIssuedBoleta({ id: boletaId, numero_completo: numeroCompleto });
      
      toast({
        title: "Boleta Emitida con Éxito",
        description: `Documento ${numeroCompleto} procesado. Guardando PDF...`,
        variant: "success",
      });

      // --- LÓGICA AUTOMÁTICA DE PDF ---
      if (currentSocioId) {
        setIsProcessingPdf(true);
        try {
          await generateBoletaPdf(boletaId, 'A4');
          // currentSocioId es ahora string | null, y se verifica que no sea null
          await saveBoletaPdfToSupabase(boletaId, numeroCompleto, currentSocioId, 'A4');
          toast({
            title: "PDF Guardado Automáticamente",
            description: `El comprobante ${numeroCompleto}.pdf se guardó en el repositorio del socio.`,
            variant: "success",
          });
        } catch (pdfError) {
          const errorMessage = pdfError instanceof Error ? pdfError.message : "Error desconocido.";
          toast({
            title: "Error al Guardar PDF",
            description: `La boleta se emitió, pero no se pudo guardar el PDF: ${errorMessage}`,
            variant: "destructive",
          });
        } finally {
          setIsProcessingPdf(false);
        }
      } else {
        toast({
          title: "Advertencia: PDF no guardado",
          description: "No se ha identificado un socio para asociar y guardar el comprobante.",
          variant: "warning",
        });
      }

      // --- LÓGICA PARA CREAR EL INGRESO ---
      // MODIFICACIÓN: Se eliminó 'data.income_numero_operacion' de la condición obligatoria
      if (data.create_income_record && data.income_date && data.income_account) {
        try {
          const totalAmount = data.detalles.reduce((acc, item) => {
            // El precio unitario ya incluye IGV, así que lo usamos directamente
            return acc + (Number(item.cantidad) * Number(item.mto_valor_unitario));
          }, 0);

          await createIncomeFromBoleta({
            receipt_number: numeroCompleto,
            dni: data.client.numero_documento,
            full_name: data.client.razon_social,
            amount: parseFloat(totalAmount.toFixed(2)),
            account: data.income_account,
            date: data.income_date,
            transaction_type: 'Venta',
            numeroOperacion: data.income_numero_operacion ? Number(data.income_numero_operacion) : null,
          });

          toast({
            title: "Ingreso Registrado",
            description: `Se creó un nuevo ingreso por S/ ${totalAmount.toFixed(2)}.`,
            variant: "success",
          });

        } catch (incomeError) {
          const errorMessage = incomeError instanceof Error ? incomeError.message : "Error desconocido.";
          toast({
            title: "Error al Registrar Ingreso",
            description: `La boleta se emitió, pero no se pudo crear el ingreso: ${errorMessage}`,
            variant: "destructive",
          });
        }
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Ocurrió un error inesperado.";
      toast({
        title: "Error de Emisión",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClientSearch = useCallback(async (e: React.FocusEvent<HTMLInputElement>) => {
    const docNumber = e.target.value.trim();
    const docType = form.getValues('client.tipo_documento');
    setCurrentSocioId(null);

    if (docType !== '1' || docNumber.length < 8) {
      return;
    }

    setIsClientSearching(true);
    try {
      const clientData = await fetchClientByDocument(docNumber);

      if (clientData) {
        // clientData.id es un string (UUID)
        setCurrentSocioId(clientData.id || null);
        form.setValue('client.razon_social', clientData.razon_social || '', { shouldValidate: true });
        form.setValue('client.nombre_comercial', clientData.nombre_comercial || '', { shouldValidate: true });
        form.setValue('client.direccion', clientData.direccion || '', { shouldValidate: true });
        form.setValue('client.distrito', clientData.distrito || '', { shouldValidate: true });
        form.setValue('client.provincia', clientData.provincia || '', { shouldValidate: true });
        form.setValue('client.departamento', clientData.departamento || '', { shouldValidate: true });
        form.setValue('client.ubigeo', clientData.ubigeo || '');
        form.setValue('client.telefono', clientData.telefono || '');

        toast({
          title: "Cliente Encontrado",
          description: `Datos de ${clientData.razon_social} cargados.`,
          variant: "success",
        });
      } else {
        form.setValue('client.razon_social', '');
        form.setValue('client.nombre_comercial', '');
        form.setValue('client.direccion', '');
        form.setValue('client.distrito', '');
        form.setValue('client.provincia', '');
        form.setValue('client.departamento', '');
        form.setValue('client.ubigeo', '');
        form.setValue('client.telefono', '');

        toast({
          title: "Cliente No Encontrado",
          description: "No se encontraron datos para el documento ingresado. Por favor, complete manualmente.",
          variant: "warning",
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Error al buscar cliente.";
      toast({
        title: "Error de Búsqueda",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsClientSearching(false);
    }
  }, [form, toast]);


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        
        {/* SECCIÓN 1: METADATOS DE LA BOLETA */}
        <Card className="bg-surface border-primary/30 shadow-xl">
          <CardHeader>
            <CardTitle className="text-xl text-primary">Información General</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FormField
              control={form.control}
              name="serie"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Serie</FormLabel>
                  <FormControl>
                    <Input {...field} disabled />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="fecha_emision"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Fecha de Emisión</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full justify-start text-left font-normal rounded-lg border-border bg-background text-foreground focus:ring-primary focus:border-primary transition-all duration-300",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value ? format(parseISO(field.value), "PPP", { locale: es }) : <span>Selecciona una fecha</span>}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-card border-border rounded-xl shadow-lg" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value ? parseISO(field.value) : undefined}
                        onSelect={(date) => {
                          field.onChange(date ? format(date, 'yyyy-MM-dd') : '');
                        }}
                        initialFocus
                        locale={es}
                        toDate={new Date()}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="moneda"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Moneda</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione Moneda" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="PEN">PEN - Soles</SelectItem>
                      <SelectItem value="USD">USD - Dólares</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* SECCIÓN 2: DATOS DEL CLIENTE */}
        <Card className="bg-surface border-accent/30 shadow-xl">
          <CardHeader>
            <CardTitle className="text-xl text-accent">Datos del Cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormField
                control={form.control}
                name="client.tipo_documento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo Doc.</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Tipo Documento" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-card border-border">
                        {TIPO_DOCUMENTO_CLIENTE.map(doc => (
                          <SelectItem key={doc.code} value={doc.code}>{doc.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="client.numero_documento"
                render={({ field }) => (
                  <FormItem className="md:col-span-2 relative">
                    <FormLabel>Número de Documento</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ej: 23456789" 
                        {...field} 
                        onBlur={(e) => {
                          field.onBlur();
                          handleClientSearch(e);
                        }}
                        disabled={isClientSearching}
                      />
                    </FormControl>
                    {isClientSearching && (
                      <Loader2 className="absolute right-3 top-9 h-5 w-5 text-primary animate-spin" />
                    )}
                    {!isClientSearching && form.getValues('client.tipo_documento') === '1' && (
                       <Search className="absolute right-3 top-9 h-5 w-5 text-textSecondary" />
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="client.razon_social"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Razón Social / Nombre Completo</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: María Sánchez" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="client.nombre_comercial"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre Comercial (Opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: María E. Sánchez P." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <FormField
                control={form.control}
                name="client.departamento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Departamento/Región</FormLabel>
                    <FormControl><Input placeholder="Lima" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="client.provincia"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Provincia</FormLabel>
                    <FormControl><Input placeholder="Lima" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="client.distrito"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Distrito</FormLabel>
                    <FormControl><Input placeholder="Miraflores" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="client.ubigeo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ubigeo (Opcional)</FormLabel>
                    <FormControl><Input placeholder="150101" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="client.direccion"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dirección Completa</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Av. Los Negocios 456" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="client.telefono"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono/Celular (Opcional)</FormLabel>
                    <FormControl><Input placeholder="987654321" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="client.email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email (Opcional)</FormLabel>
                    <FormControl><Input placeholder="contacto@ejemplo.com" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* SECCIÓN 3: DETALLES DE LA VENTA */}
        <Card className="bg-surface border-secondary/30 shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-xl text-secondary">Detalles de Productos/Servicios</CardTitle>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => append({ 
                codigo: DEFAULT_ITEM_CODE, 
                descripcion: 'Elaboracion de Expediente Tecnico', // UPDATED
                unidad: 'ZZ', // UPDATED
                cantidad: 1, 
                mto_valor_unitario: 250, // UPDATED
                porcentaje_igv: DEFAULT_IGV_PERCENTAGE, 
                tip_afe_igv: '10', 
                codigo_producto_sunat: DEFAULT_SUNAT_PRODUCT_CODE
              })}
              className="text-secondary hover:bg-secondary/20 border-secondary"
            >
              <PlusCircle className="h-4 w-4 mr-2" />
              Agregar Detalle
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            {fields.map((item, index) => (
              <div key={item.id} className="p-4 border border-border rounded-lg bg-card/50 relative space-y-4 transition-all duration-300 hover:shadow-md">
                <h4 className="text-lg font-semibold text-foreground/80">Item #{index + 1}</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name={`detalles.${index}.codigo`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Código</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`detalles.${index}.unidad`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unidad</FormLabel>
                        <FormControl><Input {...field} placeholder="NIU, ZZ" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`detalles.${index}.cantidad`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cantidad</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`detalles.${index}.mto_valor_unitario`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Precio Unitario (con IGV)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name={`detalles.${index}.descripcion`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción</FormLabel>
                      <FormControl><Textarea {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name={`detalles.${index}.tip_afe_igv`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Afectación IGV</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Tipo Afectación" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-card border-border">
                            {TIPO_AFECTACION_IGV.map(type => (
                              <SelectItem key={type.code} value={type.code}>{type.code} - {type.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`detalles.${index}.porcentaje_igv`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>% IGV</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field} 
                            min="0" max="18"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`detalles.${index}.codigo_producto_sunat`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cód. Producto SUNAT</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {fields.length > 1 && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => remove(index)}
                    className="absolute top-2 right-2 h-8 w-8 p-0"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Eliminar detalle</span>
                  </Button>
                )}
              </div>
            ))}
            {form.formState.errors.detalles && !form.formState.errors.detalles.root && (
              <p className="text-sm font-medium text-destructive mt-2">
                {form.formState.errors.detalles.message}
              </p>
            )}
          </CardContent>
        </Card>

        {/* SECCIÓN 4: REGISTRO DE INGRESO (OPCIONAL) */}
        <Card className="bg-surface border-success/30 shadow-xl">
          <CardHeader>
            <CardTitle className="text-xl text-success flex items-center">
              <Banknote className="mr-3 h-6 w-6" />
              Registro de Ingreso (Opcional)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="create_income_record"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 bg-card/50">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>
                      Registrar Ingreso Automáticamente
                    </FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Marque esta casilla para crear un registro en la sección de ingresos cuando la boleta sea emitida.
                    </p>
                  </div>
                </FormItem>
              )}
            />
            {createIncomeRecord && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                <FormField
                  control={form.control}
                  name="income_date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Fecha del Ingreso</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {field.value ? format(parseISO(field.value), "PPP", { locale: es }) : <span>Selecciona una fecha</span>}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value ? parseISO(field.value) : undefined}
                            onSelect={(date) => field.onChange(date ? format(date, 'yyyy-MM-dd') : '')}
                            initialFocus
                            locale={es}
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="income_numero_operacion"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nº de Operación (Opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: 0012345" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="income_account"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cuenta de Destino</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccione una cuenta" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {accounts.map(acc => (
                            <SelectItem key={acc.name} value={acc.name}>{acc.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* SECCIÓN 5: ACCIONES POST-EMISIÓN (PDF) */}
        {lastIssuedBoleta && (
          <Card className="bg-surface border-success/30 shadow-xl">
            <CardHeader>
              <CardTitle className="text-xl text-success">Documento Emitido: {lastIssuedBoleta.numero_completo}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col md:flex-row gap-4">
              <Button 
                type="button" 
                onClick={handleDownloadPdfOnly}
                disabled={isProcessingPdf}
                className="flex-1 py-3 bg-success hover:bg-success/90 text-white transition-all duration-300"
              >
                <FileText className="mr-2 h-5 w-5" />
                {isProcessingPdf ? 'Guardando PDF...' : 'Descargar PDF'}
              </Button>
              <Button 
                type="button" 
                onClick={() => { 
                  form.reset(defaultValues); 
                  setLastIssuedBoleta(null); 
                  setCurrentSocioId(null);
                }}
                variant="outline"
                className="flex-1 py-3 border-border text-foreground hover:bg-card transition-all duration-300"
              >
                <RotateCcw className="mr-2 h-5 w-5" />
                Nueva Boleta
              </Button>
            </CardContent>
          </Card>
        )}

        <Button 
          type="submit" 
          className="w-full py-6 text-lg font-semibold transition-all duration-300 hover:shadow-primary/50 shadow-lg"
          disabled={isSubmitting || isClientSearching || !form.formState.isValid || !!lastIssuedBoleta}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Emitiendo Boleta...
            </>
          ) : (
            <>
              <Send className="mr-2 h-5 w-5" />
              Emitir Boleta Electrónica
            </>
          )}
        </Button>
      </form>
    </Form>
  );
};

export default BoletaForm;
