import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { PlusCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { Cuenta, Ingreso, Gasto } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import TransactionForm from '@/components/custom/TransactionForm';
import { toast } from 'sonner';
import { Link } from 'react-router-dom'; // Import Link

interface AccountWithBalance extends Cuenta {
  balance: number;
}

const Accounts: React.FC = () => {
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false);

  const fetchAccountsAndBalances = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch all accounts
      console.log('Fetching accounts...');
      const { data: accountsData, error: accountsError } = await supabase
        .from('cuentas')
        .select('id, name, created_at')
        .order('name', { ascending: true });

      if (accountsError) throw accountsError;
      console.log('Fetched accounts data:', accountsData);

      const fetchedAccounts: Cuenta[] = accountsData || [];
      if (fetchedAccounts.length === 0) {
        console.warn('No accounts found in "cuentas" table.');
      }

      // 2. Fetch all ingresos (select all columns to match Ingreso type)
      console.log('Fetching ingresos...');
      const { data: ingresosData, error: ingresosError } = await supabase
        .from('ingresos')
        .select('*'); // Seleccionar todas las columnas

      if (ingresosError) throw ingresosError;
      console.log('Fetched ingresos data:', ingresosData);

      const fetchedIngresos: Ingreso[] = ingresosData || [];
      if (fetchedIngresos.length === 0) {
        console.warn('No ingresos found in "ingresos" table.');
      }

      // 3. Fetch all gastos (select all columns to match Gasto type)
      console.log('Fetching gastos...');
      const { data: gastosData, error: gastosError } = await supabase
        .from('gastos')
        .select('*'); // Seleccionar todas las columnas

      if (gastosError) throw gastosError;
      console.log('Fetched gastos data:', gastosData);

      const fetchedGastos: Gasto[] = gastosData || [];
      if (fetchedGastos.length === 0) {
        console.warn('No gastos found in "gastos" table.');
      }

      // 4. Calculate balances for each account
      console.log('Calculating balances...');
      const accountsWithBalances: AccountWithBalance[] = fetchedAccounts.map(account => {
        let balance = 0;

        // Add ingresos
        fetchedIngresos
          .filter(ingreso => ingreso.account === account.name)
          .forEach(ingreso => {
            if (ingreso.transaction_type === 'Ingreso') {
              balance += ingreso.amount;
            } else if (ingreso.transaction_type === 'Devolucion') {
              balance += ingreso.amount; // Amount is already stored as negative for Devolucion
            }
            // Anulacion amount is 0, so no change
          });

        // Subtract gastos
        fetchedGastos
          .filter(gasto => gasto.account === account.name)
          .forEach(gasto => {
            balance += gasto.amount; // Amount is already stored as negative for Gasto
          });

        return { ...account, balance };
      });

      console.log('Accounts with calculated balances:', accountsWithBalances);
      setAccounts(accountsWithBalances);
    } catch (err: any) {
      console.error('Error fetching accounts and balances:', err.message);
      setError('Error al cargar las cuentas y sus saldos. Por favor, inténtalo de nuevo.');
      toast.error('Error al cargar datos', { description: err.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccountsAndBalances();
  }, [fetchAccountsAndBalances]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-text font-sans flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg">Cargando cuentas y saldos...</p>
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold text-white">Cuentas</h1>
        <Dialog open={isTransactionDialogOpen} onOpenChange={setIsTransactionDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-white rounded-lg px-6 py-3 shadow-lg transition-all duration-300 ease-in-out transform hover:-translate-y-1">
              <PlusCircle className="mr-2 h-5 w-5" />
              Registrar Nueva Transacción
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] bg-card text-text border-border rounded-xl shadow-2xl p-6">
            <DialogHeader>
              <DialogTitle className="text-3xl font-bold text-primary">Registrar Transacción</DialogTitle>
              <DialogDescription className="text-textSecondary">
                Añade un nuevo ingreso, anulación, devolución o gasto a una cuenta.
              </DialogDescription>
            </DialogHeader>
            <TransactionForm
              onClose={() => setIsTransactionDialogOpen(false)}
              onSuccess={fetchAccountsAndBalances}
            />
          </DialogContent>
        </Dialog>
      </div>

      <p className="text-textSecondary text-lg">
        Gestiona todas tus cuentas financieras en un solo lugar. Visualiza saldos, tipos y movimientos.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {accounts.map((account) => (
          <Card key={account.id} className="bg-surface border-border rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 ease-in-out">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xl font-semibold text-primary">{account.name}</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className={`text-3xl font-extrabold mb-2 ${account.balance >= 0 ? 'text-success' : 'text-error'}`}>
                S/ {account.balance.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-textSecondary text-sm">Saldo actual</p>
              <div className="mt-4 flex justify-end space-x-2">
                <Link to={`/accounts/${account.id}`}> {/* Use Link for navigation */}
                  <Button variant="ghost" className="text-textSecondary hover:text-white hover:bg-background rounded-lg">Ver Detalles</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Accounts;
