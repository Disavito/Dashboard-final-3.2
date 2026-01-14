import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabaseClient';
import { Cuenta, TransactionFormValues } from '@/lib/types'; // Removed TransactionType
import { toast } from 'sonner';

interface TransactionFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

const formSchema = z.object({
  accountName: z.string().min(1, { message: 'Selecciona una cuenta.' }),
  transactionType: z.enum(['Ingreso', 'Anulacion', 'Devolucion', 'Gasto'], {
    required_error: 'Selecciona un tipo de transacción.',
  }),
  amount: z.preprocess(
    (val) => Number(val),
    z.number().min(0, { message: 'El monto debe ser positivo.' })
  ),
  date: z.date({
    required_error: 'Selecciona una fecha.',
  }),
  description: z.string().optional(),
  category: z.string().optional(), // Only for Gasto
  sub_category: z.string().optional(),
  receiptNumber: z.string().optional(), // Only for Ingreso
  dni: z.string().optional(), // Only for Ingreso
  fullName: z.string().optional(), // Only for Ingreso
  numeroOperacion: z.preprocess(
    // Pre-process to ensure the value is a string before validation
    (val) => (val === null || val === undefined || val === '' ? undefined : String(val)),
    z.string().optional()
  ),
  numeroGasto: z.string().optional(), // Only for Gasto
  colaboradorId: z.string().optional(), // Only for Gasto
}).superRefine((data, ctx) => {
  if (data.transactionType === 'Anulacion' && data.amount !== 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Para Anulación, el monto debe ser 0.',
      path: ['amount'],
    });
  }
  if (data.transactionType === 'Devolucion' && data.amount <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Para Devolución, el monto debe ser positivo (se registrará como negativo).',
      path: ['amount'],
    });
  }
  if (data.transactionType === 'Gasto' && data.amount <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Para Gasto, el monto debe ser positivo (se registrará como negativo).',
      path: ['amount'],
    });
  }
  if (data.transactionType === 'Ingreso' && data.amount <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Para Ingreso, el monto debe ser positivo.',
      path: ['amount'],
    });
  }
});

const TransactionForm: React.FC<TransactionFormProps> = ({ onClose, onSuccess }) => {
  const [accounts, setAccounts] = useState<Cuenta[]>([]);
  const [loading, setLoading] = useState(false);

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      accountName: '',
      transactionType: 'Ingreso',
      amount: 0,
      date: new Date(),
      description: '',
      category: '',
      sub_category: '',
      receiptNumber: '',
      dni: '',
      fullName: '',
      numeroOperacion: '',
      numeroGasto: '',
      colaboradorId: '',
    },
  });

  const selectedTransactionType = form.watch('transactionType');

  useEffect(() => {
    const fetchAccounts = async () => {
      const { data, error } = await supabase.from('cuentas').select('id, name, created_at');
      if (error) {
        console.error('Error fetching accounts:', error.message);
        toast.error('Error al cargar cuentas', { description: error.message });
      } else {
        setAccounts(data || []);
      }
    };
    fetchAccounts();
  }, []);

  const onSubmit = async (values: TransactionFormValues) => {
    setLoading(true);
    try {
      const transactionDate = format(values.date, 'yyyy-MM-dd');
      let finalAmount = values.amount;

      if (values.transactionType === 'Devolucion' || values.transactionType === 'Gasto') {
        finalAmount = -Math.abs(values.amount); // Ensure it's negative
      } else if (values.transactionType === 'Anulacion') {
        finalAmount = 0;
      }

      if (values.transactionType === 'Gasto') {
        const { error } = await supabase.from('gastos').insert({
          account: values.accountName,
          amount: finalAmount,
          date: transactionDate,
          description: values.description,
          category: values.category,
          sub_category: values.sub_category,
          numero_gasto: values.numeroGasto,
          colaborador_id: values.colaboradorId,
        });
        if (error) throw error;
      } else { // Ingreso, Anulacion, Devolucion
        const { error } = await supabase.from('ingresos').insert({
          account: values.accountName,
          amount: finalAmount,
          date: transactionDate,
          transaction_type: values.transactionType,
          receipt_number: values.receiptNumber,
          dni: values.dni,
          full_name: values.fullName,
          numeroOperacion: values.numeroOperacion,
        });
        if (error) throw error;
      }

      toast.success('Transacción registrada', {
        description: `Se ha registrado un ${values.transactionType} de ${values.amount.toLocaleString('es-PE', { style: 'currency', currency: 'PEN' })} en la cuenta ${values.accountName}.`,
      });
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error registering transaction:', error.message);
      toast.error('Error al registrar transacción', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="accountName"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-text">Cuenta</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="bg-background border-border text-text focus:ring-primary focus:border-primary">
                    <SelectValue placeholder="Selecciona una cuenta" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="bg-surface border-border text-text">
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.name}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="transactionType"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-text">Tipo de Transacción</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="bg-background border-border text-text focus:ring-primary focus:border-primary">
                    <SelectValue placeholder="Selecciona un tipo" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="bg-surface border-border text-text">
                  <SelectItem value="Ingreso">Ingreso</SelectItem>
                  <SelectItem value="Anulacion">Anulación</SelectItem>
                  <SelectItem value="Devolucion">Devolución</SelectItem>
                  <SelectItem value="Gasto">Gasto</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-text">Monto</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  className="bg-background border-border text-text focus:ring-primary focus:border-primary"
                  {...field}
                  onChange={(e) => field.onChange(parseFloat(e.target.value))}
                  disabled={selectedTransactionType === 'Anulacion'}
                />
              </FormControl>
              {selectedTransactionType === 'Anulacion' && (
                <p className="text-sm text-textSecondary">El monto para Anulación es automáticamente 0.</p>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel className="text-text">Fecha</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={'outline'}
                      className={cn(
                        'w-full justify-start text-left font-normal bg-background border-border text-text hover:bg-muted/50',
                        !field.value && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {field.value ? format(field.value, 'PPP', { locale: es }) : <span>Selecciona una fecha</span>}
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-surface border-border rounded-xl shadow-lg" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) => date > new Date() || date < new Date('1900-01-01')}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-text">Descripción (Opcional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Detalles de la transacción..."
                  className="bg-background border-border text-text focus:ring-primary focus:border-primary"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Conditional fields for Ingreso */}
        {(selectedTransactionType === 'Ingreso' || selectedTransactionType === 'Devolucion' || selectedTransactionType === 'Anulacion') && (
          <>
            <FormField
              control={form.control}
              name="receiptNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-text">Número de Recibo (Opcional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ej: REC001"
                      className="bg-background border-border text-text focus:ring-primary focus:border-primary"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="dni"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-text">DNI (Opcional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ej: 12345678"
                      className="bg-background border-border text-text focus:ring-primary focus:border-primary"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-text">Nombre Completo (Opcional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ej: Juan Pérez"
                      className="bg-background border-border text-text focus:ring-primary focus:border-primary"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="numeroOperacion"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-text">Número de Operación (Opcional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ej: OP12345"
                      className="bg-background border-border text-text focus:ring-primary focus:border-primary"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        {/* Conditional fields for Gasto */}
        {selectedTransactionType === 'Gasto' && (
          <>
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-text">Categoría</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ej: Suministros, Transporte"
                      className="bg-background border-border text-text focus:ring-primary focus:border-primary"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="sub_category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-text">Subcategoría (Opcional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ej: Oficina, Combustible"
                      className="bg-background border-border text-text focus:ring-primary focus:border-primary"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="numeroGasto"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-text">Número de Gasto (Opcional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ej: GASTO001"
                      className="bg-background border-border text-text focus:ring-primary focus:border-primary"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="colaboradorId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-text">ID Colaborador (Opcional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="UUID del colaborador"
                      className="bg-background border-border text-text focus:ring-primary focus:border-primary"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        <div className="flex justify-end space-x-4 mt-8">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="rounded-lg border-border text-text hover:bg-muted/50 transition-all duration-300"
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            className="rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-300 flex items-center gap-2"
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Registrar Transacción
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default TransactionForm;
