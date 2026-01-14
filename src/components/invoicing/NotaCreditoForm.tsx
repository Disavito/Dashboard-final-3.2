import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Send, Search, RotateCcw, Info, CheckCircle } from 'lucide-react';
import { NotaCreditoFormValues, NotaCreditoFormSchema, DocumentoAfectado, NotaCreditoPayload, DetallePayloadSchema } from '@/lib/types/invoicing';
import { 
  fetchDocumentoAfectado, 
  issueNotaCredito,
  sendNotaCreditoToSunat,
  updateIncomeOnCreditNote,
} from '@/lib/api/invoicingApi';
import { useToast } from '@/components/ui/use-toast';
import { 
  DEFAULT_SERIE_NOTA_CREDITO_BOLETA,
  DEFAULT_SERIE_NOTA_CREDITO_FACTURA,
  CREDIT_NOTE_REASONS,
  DEFAULT_MONEDA,
  COMPANY_ID,
  BRANCH_ID,
} from '@/lib/constants';
import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

const getTodayDate = () => new Date().toISOString().split('T')[0];

const defaultValues: NotaCreditoFormValues = {
  documento_afectado_tipo: 'boleta',
  documento_afectado_serie: '',
  documento_afectado_numero: '',
  motivo_codigo: '',
  motivo_descripcion: '',
  serie: DEFAULT_SERIE_NOTA_CREDITO_BOLETA,
  fecha_emision: getTodayDate(),
  moneda: DEFAULT_MONEDA,
  client: {
    tipo_documento: '',
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
    pais: '',
  },
  detalles: [],
};

const transformDataToPayload = (data: NotaCreditoFormValues, originalDocument: DocumentoAfectado): NotaCreditoPayload => {
    const isAnulacion = ['01', '02', '06'].includes(data.motivo_codigo);
    
    let payloadDetalles: z.infer<typeof DetallePayloadSchema>[] = [];

    if (isAnulacion && originalDocument.detalles.length > 0) {
        const totalAmountWithTax = originalDocument.mto_imp_venta;
        const taxPercentage = originalDocument.detalles[0].porcentaje_igv;
        const preTaxAmount = parseFloat((totalAmountWithTax / (1 + taxPercentage / 100)).toFixed(2));

        payloadDetalles.push({
            codigo: 'ANULADO',
            descripcion: 'OPERACION ANULADA COMPLETAMENTE',
            unidad: 'ZZ',
            cantidad: 1,
            mto_valor_unitario: preTaxAmount,
            porcentaje_igv: taxPercentage,
            tip_afe_igv: originalDocument.detalles[0].tip_afe_igv,
        });
    } else {
        payloadDetalles = data.detalles.map(d => ({
            ...d,
            // NOTE: mto_valor_unitario en el formulario es con IGV. El payload lo requiere sin IGV.
            mto_valor_unitario: parseFloat((d.mto_valor_unitario / (1 + d.porcentaje_igv / 100)).toFixed(2)),
        }));
    }

    const clientPayload = { ...data.client };
    // El ID del cliente en el formulario es un string (UUID) o undefined.
    // No necesitamos eliminarlo si es undefined, pero si existe, debe ser un string.
    // La validación de Zod en ClientBoletaSchema ya maneja esto.

    const payload: NotaCreditoPayload = {
        company_id: COMPANY_ID,
        branch_id: BRANCH_ID,
        serie: data.serie,
        fecha_emision: data.fecha_emision,
        moneda: data.moneda,
        tipo_doc_afectado: data.documento_afectado_tipo === 'boleta' ? '03' : '01',
        num_doc_afectado: `${data.documento_afectado_serie}-${data.documento_afectado_numero}`,
        cod_motivo: data.motivo_codigo,
        des_motivo: data.motivo_descripcion,
        client: {
            // Aseguramos que el ID no se pase al payload si es undefined, 
            // aunque ClientPayloadSchema no lo requiere, es buena práctica.
            tipo_documento: clientPayload.tipo_documento,
            numero_documento: clientPayload.numero_documento,
            razon_social: clientPayload.razon_social,
            nombre_comercial: clientPayload.nombre_comercial || undefined,
            direccion: clientPayload.direccion || undefined,
            ubigeo: clientPayload.ubigeo || undefined,
            distrito: clientPayload.distrito || undefined,
            provincia: clientPayload.provincia || undefined,
            departamento: clientPayload.departamento || undefined,
            telefono: clientPayload.telefono || undefined,
            email: clientPayload.email || undefined,
            pais: clientPayload.pais || undefined,
        },
        detalles: payloadDetalles,
    };
    return payload;
};


const NotaCreditoForm = () => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [documentoEncontrado, setDocumentoEncontrado] = useState<DocumentoAfectado | null>(null);
  const [issuedCreditNote, setIssuedCreditNote] = useState<{ id: number; numero_completo: string } | null>(null);

  const form = useForm<NotaCreditoFormValues>({
    resolver: zodResolver(NotaCreditoFormSchema),
    defaultValues,
    mode: 'onChange',
  });

  const { fields, replace } = useFieldArray({
    control: form.control,
    name: 'detalles',
  });

  const handleDocumentSearch = async () => {
    const { documento_afectado_tipo, documento_afectado_serie, documento_afectado_numero } = form.getValues();
    if (!documento_afectado_serie || !documento_afectado_numero) {
      toast({ title: "Datos incompletos", description: "Por favor, ingrese la serie y el número del documento.", variant: "warning" });
      return;
    }

    setIsSearching(true);
    setDocumentoEncontrado(null);
    setIssuedCreditNote(null);
    form.reset({ ...defaultValues, documento_afectado_tipo, documento_afectado_serie, documento_afectado_numero });

    try {
      const result = await fetchDocumentoAfectado(documento_afectado_tipo, documento_afectado_serie, documento_afectado_numero);
      if (result) {
        // FIX: El ID del cliente en DocumentoAfectadoSchema es de tipo number (id de la tabla de documentos), 
        // pero el campo client.id en el formulario espera un string (UUID de socio_titulares).
        // Dado que DocumentoAfectadoSchema usa ClientBoletaSchema, debemos asegurar que el ID sea string o undefined.
        // Si el documento afectado tiene un ID de cliente (que es un UUID string), lo usamos.
        // Si el documento afectado solo tiene el ID de la tabla de documentos (number), lo ignoramos o lo convertimos si es necesario.
        
        // Asumimos que result.client.id es el UUID string si existe, o undefined.
        // Si result.client.id es un number (como en el esquema original de DocumentoAfectado), lo convertimos a string.
        
        const clientId = result.client.id;
        let sanitizedClientId: string | undefined;

        if (typeof clientId === 'number') {
            // Si por alguna razón el ID es un número (ej. ID de la tabla de documentos), lo convertimos a string.
            // Esto es un parche, idealmente DocumentoAfectadoSchema.client.id debería ser string | undefined.
            sanitizedClientId = String(clientId);
        } else if (typeof clientId === 'string') {
            sanitizedClientId = clientId;
        } else {
            sanitizedClientId = undefined;
        }

        const sanitizedClient = {
          ...defaultValues.client,
          ...result.client,
          id: sanitizedClientId, // Aseguramos que sea string | undefined
        };

        setDocumentoEncontrado(result);
        form.setValue('client', sanitizedClient);
        form.setValue('moneda', result.moneda);
        replace(result.detalles);
        toast({ title: "Documento Encontrado", description: `Se cargaron los datos del comprobante.`, variant: "success" });
      } else {
        toast({ title: "No Encontrado", description: "No se encontró ningún documento con la serie y número especificados.", variant: "destructive" });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Error desconocido.";
      toast({ title: "Error de Búsqueda", description: errorMessage, variant: "destructive" });
    } finally {
      setIsSearching(false);
    }
  };
  
  const handleReset = () => {
    form.reset(defaultValues);
    setDocumentoEncontrado(null);
    setIssuedCreditNote(null);
    setIsSubmitting(false);
  };

  const onSubmit = async (data: NotaCreditoFormValues) => {
    if (!documentoEncontrado) {
        toast({ title: "Error", description: "No hay un documento original cargado.", variant: "destructive" });
        return;
    }
    setIsSubmitting(true);
    try {
        // 1. Crear Payload y emitir la Nota de Crédito
        const payload = transformDataToPayload(data, documentoEncontrado);
        const response = await issueNotaCredito(payload);

        if (!response.success) {
            throw new Error(response.message || "Ocurrió un error desconocido al emitir.");
        }
        
        const newCreditNoteId = response.data.id;
        const newCreditNoteNumero = response.data.numero_completo;
        setIssuedCreditNote({ id: newCreditNoteId, numero_completo: newCreditNoteNumero });
        toast({ title: "Paso 1/3: Nota de Crédito Creada", description: `Documento ${newCreditNoteNumero} generado.`, variant: "success" });

        // 2. Enviar la Nota de Crédito a SUNAT
        try {
            await sendNotaCreditoToSunat(newCreditNoteId);
            toast({ title: "Paso 2/3: Enviado a SUNAT", description: "El comprobante ha sido enviado para validación.", variant: "success" });
        } catch (sunatError) {
            console.error("Error al enviar a SUNAT:", sunatError);
            toast({ title: "Error Crítico en Paso 2", description: "No se pudo enviar a SUNAT. La NC fue creada pero debe enviarse manualmente.", variant: "destructive" });
        }

        // 3. Actualizar el registro de ingreso original
        try {
            const originalSerieNumero = `${data.documento_afectado_serie}-${data.documento_afectado_numero}`;
            await updateIncomeOnCreditNote(originalSerieNumero, documentoEncontrado.mto_imp_venta, newCreditNoteNumero);
            toast({ title: "Paso 3/3: Ingreso Original Actualizado", description: "El registro de ingreso ha sido modificado.", variant: "success" });
        } catch (incomeError) {
            console.error("Error al actualizar ingreso:", incomeError);
            toast({ title: "Advertencia en Paso 3", description: "No se pudo actualizar el registro de ingreso original.", variant: "warning" });
        }

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Error Crítico de Emisión.";
        toast({ title: "Error Crítico de Emisión", description: errorMessage, variant: "destructive" });
        setIssuedCreditNote(null); // Revertir si la emisión falla
    } finally {
        setIsSubmitting(false);
    }
  };

  const onValidationErrors = (errors: any) => {
    console.error("Errores de validación del formulario:", errors);
    toast({
      title: "Formulario Inválido",
      description: "Por favor, revise los campos con errores.",
      variant: "destructive",
    });
  };

  const selectedReasonCode = form.watch('motivo_codigo');
  const isAnulacion = ['01', '02', '06'].includes(selectedReasonCode);

  if (issuedCreditNote) {
    return (
      <Card className="bg-surface border-success/50 shadow-xl text-center p-8">
        <CheckCircle className="mx-auto h-16 w-16 text-success mb-4" />
        <CardTitle className="text-2xl text-success">¡Nota de Crédito Emitida con Éxito!</CardTitle>
        <CardDescription className="text-lg mt-2">
          El documento <span className="font-bold text-white">{issuedCreditNote.numero_completo}</span> ha sido procesado y el ingreso original ha sido actualizado.
        </CardDescription>
        <CardContent className="mt-6 flex justify-center">
          <Button onClick={handleReset} variant="outline" className="w-full md:w-auto">
            <RotateCcw className="mr-2 h-4 w-4" />
            Emitir Nueva Nota de Crédito
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, onValidationErrors)} className="space-y-8">
        
        {/* SECCIÓN 1: BÚSQUEDA DEL DOCUMENTO A MODIFICAR */}
        <Card className="bg-surface border-primary/30 shadow-xl">
          <CardHeader>
            <CardTitle className="text-xl text-primary">1. Comprobante de Venta a Modificar</CardTitle>
            <CardDescription>Ingrese los datos del documento original para cargar su información.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
            <FormField
              control={form.control}
              name="documento_afectado_tipo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo</FormLabel>
                  <Select onValueChange={(value) => {
                      field.onChange(value);
                      const newSerie = value === 'boleta' ? DEFAULT_SERIE_NOTA_CREDITO_BOLETA : DEFAULT_SERIE_NOTA_CREDITO_FACTURA;
                      form.setValue('serie', newSerie);
                  }} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="boleta">Boleta de Venta</SelectItem>
                      <SelectItem value="factura">Factura</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="documento_afectado_serie"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Serie</FormLabel>
                  <FormControl><Input placeholder="B001" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="documento_afectado_numero"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número</FormLabel>
                  <FormControl><Input placeholder="12345" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="button" onClick={handleDocumentSearch} disabled={isSearching} className="w-full">
              {isSearching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
              Buscar Documento
            </Button>
          </CardContent>
        </Card>

        {documentoEncontrado && (
          <>
            {/* SECCIÓN 1.5: RESUMEN DEL DOCUMENTO ENCONTRADO */}
            <Card className="bg-surface border-secondary/30 shadow-xl">
              <CardHeader>
                <CardTitle className="text-xl text-secondary">Resumen del Comprobante Original</CardTitle>
                <CardDescription>
                  Verifique que estos son los datos del documento que desea modificar.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                <div className="flex flex-col">
                  <span className="text-textSecondary">Cliente:</span>
                  <span className="font-semibold text-base">{documentoEncontrado.client.razon_social}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-textSecondary">RUC/DNI:</span>
                  <span className="font-semibold text-base">{documentoEncontrado.client.numero_documento}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-textSecondary">Fecha Emisión:</span>
                  <span className="font-semibold text-base">{new Date(documentoEncontrado.fecha_emision + 'T00:00:00').toLocaleDateString('es-PE', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-textSecondary">Monto Total:</span>
                  <span className="font-bold text-lg text-secondary">{documentoEncontrado.moneda} {documentoEncontrado.mto_imp_venta.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>

            {/* SECCIÓN 2: MOTIVO DE LA NOTA DE CRÉDITO */}
            <Card className="bg-surface border-accent/30 shadow-xl">
              <CardHeader>
                <CardTitle className="text-xl text-accent">2. Motivo de la Emisión</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField
                  control={form.control}
                  name="motivo_codigo"
                  render={({ field }) => (
                    <FormItem className="md:col-span-1">
                      <FormLabel>Motivo SUNAT</FormLabel>
                      <Select onValueChange={(value) => {
                          field.onChange(value);
                          const reasonName = CREDIT_NOTE_REASONS.find(r => r.code === value)?.name;
                          form.setValue('motivo_descripcion', reasonName || '');
                      }} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccione un motivo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CREDIT_NOTE_REASONS.map(reason => (
                            <SelectItem key={reason.code} value={reason.code}>{reason.code} - {reason.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="motivo_descripcion"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Descripción del Motivo</FormLabel>
                      <FormControl><Input placeholder="Detalle del motivo" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* SECCIÓN 3: DETALLES Y TOTALES */}
            <Card className="bg-surface border-primary/30 shadow-xl">
              <CardHeader>
                <CardTitle className="text-xl text-primary">3. Detalles del Comprobante Original</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isAnulacion && (
                  <Alert variant="default" className="bg-primary/10 border-primary/30 text-primary">
                    <Info className="h-4 w-4 !text-primary" />
                    <AlertTitle>Modo Anulación</AlertTitle>
                    <AlertDescription>
                      Para motivos de anulación, todos los items del documento original se incluirán como un único monto total en la nota de crédito.
                    </AlertDescription>
                  </Alert>
                )}
                {fields.map((item) => (
                  <div key={item.id} className="p-4 border border-border rounded-lg bg-card/50 space-y-2">
                    <p className="font-semibold">{item.descripcion}</p>
                    <div className="flex justify-between text-sm text-textSecondary">
                      <span>Cantidad: {item.cantidad}</span>
                      <span>P. Unitario (con IGV): S/ {Number(item.mto_valor_unitario).toFixed(2)}</span>
                      <span>Subtotal: S/ {(Number(item.cantidad) * Number(item.mto_valor_unitario)).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
                <div className="text-right font-bold text-xl mt-4">
                  Total a Anular/Corregir: S/ {documentoEncontrado.mto_imp_venta.toFixed(2)}
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-col md:flex-row gap-4">
              <Button 
                type="submit" 
                className="w-full py-6 text-lg font-semibold"
                disabled={isSubmitting}
              >
                {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Send className="mr-2 h-5 w-5" />}
                Emitir Nota de Crédito
              </Button>
              <Button 
                type="button" 
                variant="outline"
                onClick={handleReset}
                className="w-full py-6 text-lg font-semibold"
              >
                <RotateCcw className="mr-2 h-5 w-5" />
                Cancelar / Nueva Búsqueda
              </Button>
            </div>
          </>
        )}
      </form>
    </Form>
  );
};

export default NotaCreditoForm;
