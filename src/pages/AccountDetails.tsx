import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { Cuenta, Ingreso, Gasto } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

interface AccountWithBalance extends Cuenta {
  balance: number;
}

interface DailyTransaction {
  date: string; // YYYY-MM-DD
  amount: number;
}

const AccountDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [account, setAccount] = useState<AccountWithBalance | null>(null);
  const [dailyIncomes, setDailyIncomes] = useState<DailyTransaction[]>([]);
  const [dailyExpenses, setDailyExpenses] = useState<DailyTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAccountDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        if (!id) {
          throw new Error('ID de cuenta no proporcionado.');
        }

        // Fetch account details
        const { data: accountData, error: accountError } = await supabase
          .from('cuentas')
          .select('*')
          .eq('id', id)
          .single();

        if (accountError) throw accountError;
        if (!accountData) {
          throw new Error('Cuenta no encontrada.');
        }

        const fetchedAccount: Cuenta = accountData;

        // Fetch all ingresos
        const { data: ingresosData, error: ingresosError } = await supabase
          .from('ingresos')
          .select('*')
          .eq('account', fetchedAccount.name);

        if (ingresosError) throw ingresosError;
        const fetchedIngresos: Ingreso[] = ingresosData || [];

        // Fetch all gastos
        const { data: gastosData, error: gastosError } = await supabase
          .from('gastos')
          .select('*')
          .eq('account', fetchedAccount.name);

        if (gastosError) throw gastosError;
        const fetchedGastos: Gasto[] = gastosData || [];

        // Calculate daily incomes
        const dailyIncomeMap = new Map<string, number>();
        fetchedIngresos.forEach(ingreso => {
          const dateKey = new Date(ingreso.date).toISOString().split('T')[0]; // YYYY-MM-DD
          const amountToAdd = (ingreso.transaction_type === 'Ingreso' || ingreso.transaction_type === 'Devolucion' || ingreso.transaction_type === 'Venta')
            ? ingreso.amount
            : 0; // Anulacion / Nota de Crédito has 0 effect on income sum
          dailyIncomeMap.set(dateKey, (dailyIncomeMap.get(dateKey) || 0) + amountToAdd);
        });

        const sortedDailyIncomes = Array.from(dailyIncomeMap.entries())
          .map(([date, amount]) => ({ date, amount }))
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Sort descending by date
        setDailyIncomes(sortedDailyIncomes);

        // Calculate daily expenses
        const dailyExpenseMap = new Map<string, number>();
        fetchedGastos.forEach(gasto => {
          const dateKey = new Date(gasto.date).toISOString().split('T')[0]; // YYYY-MM-DD
          dailyExpenseMap.set(dateKey, (dailyExpenseMap.get(dateKey) || 0) + gasto.amount);
        });

        const sortedDailyExpenses = Array.from(dailyExpenseMap.entries())
          .map(([date, amount]) => ({ date, amount }))
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Sort descending by date
        setDailyExpenses(sortedDailyExpenses);

        // Calculate total balance
        let balance = 0;
        fetchedIngresos.forEach(ingreso => {
            // All income types add to balance, credit notes are stored as negative
            balance += ingreso.amount;
        });
        fetchedGastos.forEach(gasto => {
          balance += gasto.amount; // Gastos are stored as negative
        });

        setAccount({ ...fetchedAccount, balance });

      } catch (err: any) {
        console.error('Error fetching account details:', err.message);
        setError('Error al cargar los detalles de la cuenta. Por favor, inténtalo de nuevo.');
        toast.error('Error al cargar detalles', { description: err.message });
      } finally {
        setLoading(false);
      }
    };

    fetchAccountDetails();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-text font-sans flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg">Cargando detalles de la cuenta...</p>
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

  if (!account) {
    return (
      <div className="min-h-screen bg-background text-text font-sans flex items-center justify-center">
        <p className="text-textSecondary text-lg">No se encontró la cuenta.</p>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('es-ES', options);
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-4xl font-bold text-white">Detalles de la Cuenta: {account.name}</h1>
      <p className="text-textSecondary text-lg">
        Información detallada y movimientos diarios de {account.name}.
      </p>

      <Card className="bg-surface border-border rounded-xl shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold text-primary">Resumen de la Cuenta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-textSecondary">Nombre de la Cuenta:</span>
            <span className="text-text font-medium">{account.name}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-textSecondary">Saldo Actual:</span>
            <span className={`text-2xl font-extrabold ${account.balance >= 0 ? 'text-success' : 'text-error'}`}>
              S/ {account.balance.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-textSecondary">Fecha de Creación:</span>
            <span className="text-text font-medium">{new Date(account.created_at).toLocaleDateString()}</span>
          </div>
        </CardContent>
      </Card>

      {/* Sección de Ingresos Diarios */}
      <h2 className="text-3xl font-bold text-white mt-8">Ingresos Diarios</h2>
      <p className="text-textSecondary text-lg">
        Total de ingresos registrados por día para esta cuenta.
      </p>
      {dailyIncomes.length === 0 ? (
        <p className="text-textSecondary text-center py-8">No hay ingresos registrados para esta cuenta.</p>
      ) : (
        <div className="space-y-4">
          {dailyIncomes.map((daily, index) => (
            <Card key={`income-${daily.date}-${index}`} className="bg-surface border-border rounded-xl shadow-md">
              <CardContent className="p-4 flex justify-between items-center">
                <span className="text-lg font-semibold text-text">{formatDate(daily.date)}</span>
                <span className="text-xl font-bold text-success">
                  S/ {daily.amount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Sección de Gastos Diarios */}
      <h2 className="text-3xl font-bold text-white mt-8">Gastos Diarios</h2>
      <p className="text-textSecondary text-lg">
        Total de gastos registrados por día para esta cuenta.
      </p>
      {dailyExpenses.length === 0 ? (
        <p className="text-textSecondary text-center py-8">No hay gastos registrados para esta cuenta.</p>
      ) : (
        <div className="space-y-4">
          {dailyExpenses.map((daily, index) => (
            <Card key={`expense-${daily.date}-${index}`} className="bg-surface border-border rounded-xl shadow-md">
              <CardContent className="p-4 flex justify-between items-center">
                <span className="text-lg font-semibold text-text">{formatDate(daily.date)}</span>
                <span className="text-xl font-bold text-error">
                  S/ {daily.amount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AccountDetails;
