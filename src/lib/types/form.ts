export type EconomicSituation = 'Pobre' | 'Extremo Pobre';

export interface EconomicSituationOption {
  value: EconomicSituation;
  label: string;
}

/**
 * Defines the structure for submitting a new financial transaction.
 * This structure is tailored specifically to the fields used in TransactionForm.tsx.
 */
export interface TransactionFormValues {
  accountName: string; // Matches form field
  transactionType: 'Ingreso' | 'Anulacion' | 'Devolucion' | 'Gasto'; // Matches form.watch('transactionType')
  amount: number;
  date: Date;
  description?: string;
  
  // Fields specific to Gasto
  category?: string;
  sub_category?: string;
  numeroGasto?: string;
  colaboradorId?: string;

  // Fields specific to Ingreso/Devolucion/Anulacion
  receiptNumber?: string;
  dni?: string;
  fullName?: string;
  numeroOperacion?: string;
}
