import { z } from 'zod';

// Esquema para un solo item en el formulario de boleta
export const DetalleBoletaSchema = z.object({
  codigo: z.string().optional(),
  descripcion: z.string().min(1, "La descripción es requerida."),
  unidad: z.string().min(1, "La unidad es requerida (ej: NIU)."),
  cantidad: z.coerce.number().min(0.01, "La cantidad debe ser mayor a 0."),
  mto_valor_unitario: z.coerce.number().min(0, "El precio no puede ser negativo."),
  porcentaje_igv: z.coerce.number().min(0, "El % IGV no puede ser negativo."),
  tip_afe_igv: z.string().min(1, "Seleccione un tipo de afectación."),
  codigo_producto_sunat: z.string().optional(),
});

// Esquema para el objeto cliente en el formulario de boleta
export const ClientBoletaSchema = z.object({
  // FIX: Cambiado a string opcional para reflejar el UUID de socio_titulares.id
  id: z.string().optional(), 
  tipo_documento: z.string().min(1, "Seleccione un tipo de documento."),
  numero_documento: z.string().min(1, "El número de documento es requerido."),
  razon_social: z.string().min(1, "La razón social o nombre es requerido."),
  nombre_comercial: z.string().optional().or(z.literal('')),
  direccion: z.string().optional().or(z.literal('')),
  ubigeo: z.string().optional().or(z.literal('')),
  distrito: z.string().optional().or(z.literal('')),
  provincia: z.string().optional().or(z.literal('')),
  departamento: z.string().optional().or(z.literal('')),
  telefono: z.string().optional().or(z.literal('')),
  email: z.string().email("Email inválido.").optional().or(z.literal('')),
  pais: z.string().optional().or(z.literal('')), // Campo para motivo 11
});

// Esquema principal para validar el formulario de boleta
export const BoletaFormSchema = z.object({
  serie: z.string(),
  fecha_emision: z.string(),
  moneda: z.string().min(1, "Seleccione una moneda."),
  tipo_operacion: z.string(),
  metodo_envio: z.string(),
  forma_pago_tipo: z.string(),
  usuario_creacion: z.string(),
  client: ClientBoletaSchema,
  detalles: z.array(DetalleBoletaSchema).min(1, "Debe agregar al menos un producto o servicio."),
  create_income_record: z.boolean().default(true),
  income_date: z.string().optional(),
  income_numero_operacion: z.string().optional(),
  income_account: z.string().optional(),
}).refine(data => {
    if (data.create_income_record) {
        // FIX: income_numero_operacion is now optional in the form, so we only check date and account
        return !!data.income_date && !!data.income_account;
    }
    return true;
}, {
    message: "La fecha y cuenta son requeridos para registrar el ingreso.",
    path: ["create_income_record"],
});

export type BoletaFormValues = z.infer<typeof BoletaFormSchema>;

// --- Esquemas y Tipos para el PAYLOAD de la API ---

export const ClientPayloadSchema = z.object({
  tipo_documento: z.string(),
  numero_documento: z.string(),
  razon_social: z.string(),
  nombre_comercial: z.string().optional(),
  direccion: z.string().optional(),
  ubigeo: z.string().optional(),
  distrito: z.string().optional(),
  provincia: z.string().optional(),
  departamento: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().email().optional(),
  pais: z.string().optional(),
});

export const DetallePayloadSchema = z.object({
    codigo: z.string().optional(),
    descripcion: z.string(),
    unidad: z.string(),
    cantidad: z.number(),
    mto_valor_unitario: z.number(), // Valor base sin IGV
    porcentaje_igv: z.number(),
    tip_afe_igv: z.string(),
    codigo_producto_sunat: z.string().optional(),
});

export const BoletaPayloadSchema = z.object({
  company_id: z.number(),
  branch_id: z.number(),
  serie: z.string(),
  fecha_emision: z.string(),
  moneda: z.string(),
  tipo_operacion: z.string(),
  metodo_envio: z.string(),
  forma_pago_tipo: z.string(),
  usuario_creacion: z.string(),
  client: ClientPayloadSchema,
  detalles: z.array(DetallePayloadSchema),
});

export type BoletaPayload = z.infer<typeof BoletaPayloadSchema>;

export const IssueResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    id: z.number(),
    numero_completo: z.string(),
    pdf_path: z.string().nullish(),
    xml_path: z.string().nullish(),
    cdr_path: z.string().nullish(),
    sunat_status: z.string().nullish(),
  }),
});

export type IssueResponse = z.infer<typeof IssueResponseSchema>;

export interface Client {
  id?: string; // UUID string
  tipo_documento: string;
  numero_documento: string;
  razon_social: string;
  nombre_comercial?: string;
  direccion: string;
  ubigeo?: string;
  distrito?: string;
  provincia?: string;
  departamento?: string;
  telefono?: string;
  email?: string;
  pais?: string;
}

export interface InvoicingCalendarItem {
  id: number;
  type: 'Boleta' | 'Factura' | 'Nota Crédito';
  serie: string;
  clientName: string;
  amount: number;
  date: string;
  status: 'Aceptado' | 'Pendiente' | 'Rechazado';
}

export const ResumenDiarioSchema = z.object({
  fecha_resumen: z.string({ required_error: "La fecha de resumen es obligatoria." }).min(1, "Por favor, seleccione una fecha válida."),
});

export type ResumenDiarioFormValues = z.infer<typeof ResumenDiarioSchema>;

const SummaryDetailSchema = z.object({
  serie_numero: z.string(),
});

const SummaryDataSchema = z.object({
  id: z.number(),
  numero_completo: z.string(),
  fecha_resumen: z.string(),
  estado_proceso: z.string(),
  estado_sunat: z.string(),
  detalles: z.array(SummaryDetailSchema).optional().default([]),
});

export type SummaryData = z.infer<typeof SummaryDataSchema>;

export const CreateSummaryResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: SummaryDataSchema,
});

export type CreateSummaryResponse = z.infer<typeof CreateSummaryResponseSchema>;

export const SendSummaryResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    id: z.number(),
    fecha_resumen: z.string(),
    numero_completo: z.string(),
    correlativo: z.string(),
    ticket: z.string(),
    estado_sunat: z.string().nullable(),
    detalles: z.array(SummaryDetailSchema),
  }),
});

export type SendSummaryResponse = z.infer<typeof SendSummaryResponseSchema>;
export type SendSummaryData = SendSummaryResponse['data'];

export type DailySummary = {
  id: number;
  created_at: string;
  fecha_resumen: string;
  numero_completo: string;
  correlativo: string;
  ticket: string;
  estado_sunat: string | null;
  summary_api_id: number | null;
};

// --- Esquemas y Tipos para NOTA DE CRÉDITO ---

const GuiaSchema = z.object({
  tipo_doc: z.string().min(1, "Tipo requerido"),
  nro_doc: z.string().min(1, "Número requerido"),
});

const FormaPagoCuotaSchema = z.object({
  monto: z.coerce.number().min(0.01, "Monto debe ser mayor a 0"),
  fecha_pago: z.string().min(1, "Fecha requerida"),
});

export const NotaCreditoFormSchema = z.object({
  documento_afectado_tipo: z.enum(['boleta', 'factura'], { required_error: "Seleccione el tipo de documento a modificar." }),
  documento_afectado_serie: z.string().min(4, "La serie debe tener 4 caracteres (ej: B001).").max(4),
  documento_afectado_numero: z.string().min(1, "El número es requerido."),
  motivo_codigo: z.string().min(1, "Seleccione un motivo."),
  motivo_descripcion: z.string().min(1, "La descripción del motivo es requerida."),
  serie: z.string(),
  fecha_emision: z.string(),
  moneda: z.string(),
  client: ClientBoletaSchema,
  detalles: z.array(DetalleBoletaSchema).min(1, "Debe haber al menos un item."),
  guias: z.array(GuiaSchema).optional(),
  forma_pago_tipo: z.string().optional(),
  forma_pago_cuotas: z.array(FormaPagoCuotaSchema).optional(),
});

export type NotaCreditoFormValues = z.infer<typeof NotaCreditoFormSchema>;

export const NotaCreditoPayloadSchema = z.object({
  company_id: z.number(),
  branch_id: z.number(),
  serie: z.string(),
  fecha_emision: z.string(),
  moneda: z.string(),
  tipo_doc_afectado: z.string(),
  num_doc_afectado: z.string(),
  cod_motivo: z.string(),
  des_motivo: z.string(),
  client: ClientPayloadSchema,
  detalles: z.array(DetallePayloadSchema),
  guias: z.array(z.object({ tipo_doc: z.string(), nro_doc: z.string() })).optional(),
  forma_pago_tipo: z.string().optional(),
  forma_pago_cuotas: z.array(z.object({ monto: z.number(), fecha_pago: z.string() })).optional(),
});

export type NotaCreditoPayload = z.infer<typeof NotaCreditoPayloadSchema>;

export const DocumentoAfectadoSchema = z.object({
    id: z.number(),
    fecha_emision: z.string(),
    moneda: z.string(),
    client: ClientBoletaSchema,
    detalles: z.array(DetalleBoletaSchema),
    mto_imp_venta: z.number(),
});

export type DocumentoAfectado = z.infer<typeof DocumentoAfectadoSchema>;

// --- Esquemas y Tipos para CONSULTA DE ESTADO DE RESUMEN ---

export const CheckSummaryStatusDataSchema = z.object({
  id: z.number(),
  estado_sunat: z.string().nullable(),
});

export const CheckSummaryStatusResponseSchema = z.object({
  success: z.boolean(),
  data: CheckSummaryStatusDataSchema,
  message: z.string().optional(),
  ticket: z.string().optional(),
});

// Nuevo tipo para el resumen de ingresos anulados/devueltos
export type AnnulledIncomeSummary = {
  id: number;
  date: string;
  receipt_number: string; // El número de serie-correlativo de la nota de crédito
  amount: number; // Monto negativo
  client_dni: string | null;
  client_name: string | null; // Nombre del cliente, obtenido de socio_titulares
  transaction_type: string; // Debería ser 'Nota de Crédito'
};

// --- Esquemas y Tipos para RECIBO DE PAGO INTERNO (NUEVO) ---

export const ReciboPagoFormSchema = z.object({
  dni: z.string().min(8, "El DNI debe tener 8 dígitos."),
  client_name: z.string().optional(), // Llenado por lookup
  // CRITICAL FIX: client_id must be a UUID string.
  client_id: z.preprocess(
    (val) => (val === "" ? null : val), // Convert empty string (from hidden input) to null
    z.nullable(z.string().uuid("El ID del socio no tiene un formato UUID válido.")) // Expects a UUID string, allows null
  ), // Llenado por lookup
  fecha_emision: z.string().min(1, "La fecha de emisión es requerida."), // <-- FIX: Added missing field
  // CRITICAL FIX: Preprocess empty string to 0 so z.coerce.number() works, and then .min(0.01) fails with the correct message.
  monto: z.preprocess(
    (val) => (val === "" ? 0 : val),
    z.coerce.number().min(0.01, "El monto debe ser mayor a cero.")
  ),
  concepto: z.string().default("Elaboracion de Expediente Tecnico"),
  metodo_pago: z.enum(['BBVA Empresa', 'Efectivo', 'Cuenta Fidel'], { required_error: "Seleccione un método de pago." }),
  numero_operacion: z.string().optional(),
}).refine(data => {
    if (data.metodo_pago === 'BBVA Empresa') {
        return !!data.numero_operacion && data.numero_operacion.length > 0;
    }
    return true;
}, {
    message: "El número de operación es requerido para BBVA Empresa.",
    path: ["numero_operacion"],
});

export type ReciboPagoFormValues = z.infer<typeof ReciboPagoFormSchema>;
