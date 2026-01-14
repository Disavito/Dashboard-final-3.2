import { Tables } from './database.types';

// Re-export all types defined in the form subdirectory
export * from './types/form';

// Definición de tipos para las tablas usadas en la aplicación
export type Ingreso = Tables<'ingresos'> & {
  // Incluye la relación con socio_titulares para la localidad
  socio_titulares?: Tables<'socio_titulares'> | null;
};
export type Cuenta = Tables<'cuentas'>;
export type Colaborador = Tables<'colaboradores'>; // Eliminado salario_mensual

// --- DEFINICIÓN CANÓNICA DE SOCIO TITULAR (UUID ID: string) ---
// Define el tipo base SocioTitular desde la base de datos
type SocioTitularBase = Tables<'socio_titulares'>;

// Extiende el tipo SocioTitular con propiedades derivadas para el componente
export interface SocioTitular extends SocioTitularBase {
  isActive: boolean; // Estado de actividad derivado del ingreso neto
  receiptNumber: string | null; // Número de recibo de pago más reciente
  netIncomeAmount: number; // Monto neto de ingresos
  // isObservado y observacion se eliminan de la extensión, ya que se asume que están
  // correctamente definidos en SocioTitularBase (Tables<'socio_titulares'>)
}
// ---------------------------------------------------------------

/**
 * Represents an expense record, mapped to the 'gastos' Supabase table.
 */
export type Gasto = Tables<'gastos'>;

/**
 * Represents a generic financial transaction, which can be either an Ingreso (Income) or un Gasto (Expense).
 */
export type Transaction = Ingreso | Gasto;
