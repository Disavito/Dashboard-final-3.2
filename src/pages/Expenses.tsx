import { useState, useEffect, useCallback } from 'react';
import { ColumnDef, Row } from '@tanstack/react-table'; // Import Row type
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { PlusCircle, Edit, ArrowUpDown, CalendarIcon, XCircle, Search, Trash2 } from 'lucide-react'; // Added Search icon and Trash2
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui-custom/DataTable';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSupabaseData } from '@/hooks/useSupabaseData';
import { Gasto as GastoType, Colaborador, Cuenta } from '@/lib/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import ConfirmationDialog from '@/components/ui-custom/ConfirmationDialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn, formatCurrency } from '@/lib/utils';
import { FormField, FormItem, FormLabel, FormControl, FormMessage, Form } from '@/components/ui/form';


// --- Form Schema for Gasto ---
const expenseFormSchema = z.object({
  amount: z.preprocess(
    (val) => {
      if (val === '') return undefined; // Treat empty string as undefined
      return Number(val);
    },
    z.number({
      required_error: 'El monto es requerido.',
      invalid_type_error: 'El monto debe ser un número.'
    })
    .positive({ message: 'El monto debe ser positivo.' }) // User inputs positive, we negate for storage
  ),
  account: z.string().min(1, { message: 'La cuenta es requerida.' }),
  date: z.string().min(1, { message: 'La fecha es requerida.' }),
  category: z.string().min(1, { message: 'La categoría es requerida.' }),
  sub_category: z.string().optional().nullable(), // Corrected to sub_category
  description: z.string().min(1, { message: 'La descripción es requerida.' }).max(255, { message: 'La descripción es demasiado larga.' }),
  numero_gasto: z.string().optional().nullable(),
  colaborador_id: z.string().uuid().optional().nullable(),
});

// Type for the data after Zod transformation (what onSubmit receives from resolver)
type ExpenseFormValues = z.infer<typeof expenseFormSchema>;

// Type for the form's internal state (before Zod transformation, for useForm defaultValues)
type ExpenseFormInputValues = {
  amount: string; // Input field will hold a string
  account: string;
  date: string;
  category: string;
  sub_category: string | null; // Corrected to sub_category
  description: string;
  numero_gasto: string | null;
  colaborador_id: string | null;
};


// --- Column Definitions for Gasto ---
const expenseColumns: ColumnDef<GastoType>[] = [
  {
    accessorKey: 'date',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        className="px-0 hover:bg-transparent hover:text-accent"
      >
        Fecha
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => format(parseISO(row.getValue('date')), 'dd MMM yyyy', { locale: es }),
  },
  {
    accessorKey: 'numero_gasto',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        className="px-0 hover:bg-transparent hover:text-accent"
      >
        Nº Gasto
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => <span className="font-medium text-foreground">{row.getValue('numero_gasto') || 'N/A'}</span>,
  },
  {
    accessorKey: 'description',
    header: 'Descripción',
    cell: ({ row }) => <span className="font-medium text-foreground">{row.getValue('description')}</span>,
  },
  {
    accessorKey: 'category',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        className="px-0 hover:bg-transparent hover:text-accent"
      >
        Categoría
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => <span className="text-muted-foreground">{row.getValue('category')}</span>,
  },
  {
    accessorKey: 'sub_category', // Corrected to sub_category
    header: 'Subcategoría',
    cell: ({ row }) => <span className="text-muted-foreground">{row.getValue('sub_category') || 'N/A'}</span>, // Corrected to sub_category
  },
  {
    accessorKey: 'account',
    header: 'Cuenta',
    cell: ({ row }) => <span className="text-muted-foreground">{row.getValue('account')}</span>,
  },
  {
    accessorKey: 'colaborador_id',
    header: 'ID Colaborador',
    cell: ({ row }) => <span className="text-muted-foreground text-xs">{row.getValue('colaborador_id') ? (row.getValue('colaborador_id') as string).substring(0, 8) + '...' : 'N/A'}</span>,
  },
  {
    accessorKey: 'amount',
    header: () => <div className="text-right">Monto</div>,
    cell: ({ row }) => {
      // FIX: amount is already a number (GastoType['amount']), remove parseFloat
      const amount = row.getValue('amount') as number;
      const formattedAmount = formatCurrency(amount);

      // Lógica de color R/N/V: Verde > 0, Rojo < 0, Foreground = 0
      const colorClass = amount > 0 ? 'text-success' : amount < 0 ? 'text-error' : 'text-foreground';

      return (
        <div className={cn(
          "text-right font-semibold",
          colorClass
        )}>
          {formattedAmount}
        </div>
      );
    },
  },
  {
    id: 'actions',
    enableHiding: false,
    cell: () => {
      // Actions will be defined dynamically inside the component
      return null;
    },
  },
];

// --- New Expense Category and Subcategory Definitions ---
const MAIN_EXPENSE_CATEGORIES = [
  { value: 'Gasto Fijo', label: 'Gasto Fijo' },
  { value: 'Viáticos', label: 'Viáticos' },
  { value: 'Otros', label: 'Otros' },
];

const GASTOS_FIJOS_SUB_CATEGORIES = [
  { value: 'internet', label: 'Internet' },
  { value: 'servidor', label: 'Servidor' },
  { value: 'alquiler', label: 'Alquiler' },
  { value: 'agua_mantenimiento', label: 'Agua/Mantenimiento' },
  { value: 'luz', label: 'Luz' },
  { value: 'sueldo', label: 'Sueldo' },
  { value: 'gasolina', label: 'Gasolina' },
  { value: 'impuestos', label: 'Impuestos' },
  { value: 'seguro', label: 'Seguro' },
  { value: 'afp', label: 'AFP' },
  { value: 'contador', label: 'Contador' },
];

const VIATICOS_SUB_CATEGORIES = [
  { value: 'tecnicos', label: 'Técnicos' },
  { value: 'proyecto', label: 'Proyecto' },
  { value: 'representantes', label: 'Representantes' },
  { value: 'ocasional', label: 'Ocasional' },
];

// Helper function to generate the next sequential numero_gasto
const generateNextNumeroGasto = (expenses: GastoType[]): string => {
  let maxNumber = 0;

  // Filter for valid 'GAXXX' format and find the maximum number
  expenses.forEach(expense => {
    if (expense.numero_gasto && expense.numero_gasto.startsWith('GA')) {
      const numPart = parseInt(expense.numero_gasto.substring(2), 10);
      if (!isNaN(numPart) && numPart > maxNumber) {
        maxNumber = numPart;
      }
    }
  });

  const nextNumber = maxNumber + 1;
  // Pad with leading zeros to ensure a 3-digit number (e.g., 1 -> 001, 17 -> 017)
  return `GA${String(nextNumber).padStart(3, '0')}`;
};


export default function Expenses() { // FIX: Export as default for lazy loading
  const {
    data: expenseData,
    loading,
    error,
    addRecord,
    updateRecord,
    deleteRecord,
    refreshData,
    setFilters,
  } = useSupabaseData<GastoType>({
    tableName: 'gastos',
    initialSort: { column: 'date', ascending: false },
  });
  const { data: colaboradoresData } = useSupabaseData<Colaborador>({ tableName: 'colaboradores', enabled: true });
  const { data: accountsData, loading: accountsLoading, error: accountsError } = useSupabaseData<Cuenta>({ tableName: 'cuentas' });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<GastoType | null>(null);
  const [globalFilter, setGlobalFilter] = useState('');

  // Estados para los filtros (solo fecha y colaborador)
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
  const [colaboradorFilter, setColaboradorFilter] = useState<string | null>(null);

  // State for confirmation dialog
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [dataToConfirm, setDataToConfirm] = useState<ExpenseFormValues | null>(null);
  const [isConfirmingSubmission, setIsConfirmingSubmission] = useState(false);


  const form = useForm<ExpenseFormInputValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      amount: '',
      account: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      category: '',
      sub_category: null, // Corrected to sub_category
      description: '',
      numero_gasto: null,
      colaborador_id: null,
    },
  });

  const watchedCategory = form.watch('category');

  // Fetch accounts from Supabase
  const availableAccounts = accountsData.map(account => account.name);

  // Efecto para aplicar los filtros a useSupabaseData (solo fecha y colaborador)
  useEffect(() => {
    const newFilters: Record<string, any> = {};
    if (dateFilter) {
      newFilters.date = format(dateFilter, 'yyyy-MM-dd');
    }
    if (colaboradorFilter) {
      newFilters.colaborador_id = colaboradorFilter;
    }
    setFilters(newFilters);
  }, [dateFilter, colaboradorFilter, setFilters]);

  // Función para limpiar todos los filtros y la búsqueda global
  const clearAllFilters = () => {
    setDateFilter(undefined);
    setColaboradorFilter(null);
    setGlobalFilter(''); // Limpiar el filtro global de la tabla
  };

  // Función de filtro global personalizada para gastos
  const expenseGlobalFilterFn = useCallback((row: Row<GastoType>, _columnId: string, filterValue: string) => {
    const search = filterValue.toLowerCase();
    const original = row.original;

    // Buscar en categoría
    const category = original.category?.toLowerCase();
    if (category && category.includes(search)) {
      return true;
    }

    // Buscar en número de gasto
    const numeroGasto = original.numero_gasto?.toLowerCase();
    if (numeroGasto && numeroGasto.includes(search)) {
      return true;
    }

    // Buscar en subcategoría
    const sub_category = original.sub_category?.toLowerCase(); // Corrected to sub_category
    if (sub_category && sub_category.includes(search)) {
      return true;
    }

    // Buscar en descripción
    const description = original.description?.toLowerCase();
    if (description && description.includes(search)) {
      return true;
    }

    return false;
  }, []);


  // Function to close *only* the confirmation dialog
  const handleCloseConfirmationOnly = () => {
    setIsConfirmDialogOpen(false);
    setDataToConfirm(null);
    setIsConfirmingSubmission(false);
  };

  const handleOpenDialog = (expense?: GastoType) => {
    setEditingExpense(expense || null);
    if (expense) {
      form.reset({
        amount: Math.abs(expense.amount).toString(), // Display positive for editing, will be negated on save
        account: expense.account || '',
        date: expense.date,
        category: expense.category || '',
        sub_category: expense.sub_category || null, // Corrected to sub_category
        description: expense.description || '',
        numero_gasto: expense.numero_gasto || null,
        colaborador_id: expense.colaborador_id || null,
      });
    } else {
      const nextNumeroGasto = generateNextNumeroGasto(expenseData);
      form.reset({
        amount: '',
        account: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        category: '',
        sub_category: null, // Corrected to sub_category
        description: '',
        numero_gasto: nextNumeroGasto,
        colaborador_id: null,
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingExpense(null);
    form.reset();
    handleCloseConfirmationOnly();
  };

  const onSubmit = async (inputValues: ExpenseFormInputValues, event?: React.BaseSyntheticEvent) => {
    event?.preventDefault();
    const parsedValues: ExpenseFormValues = expenseFormSchema.parse(inputValues);
    setDataToConfirm(parsedValues);
    setIsConfirmDialogOpen(true);
  };

  const handleConfirmSubmit = async () => {
    if (!dataToConfirm) return;

    setIsConfirmingSubmission(true);
    try {
      // Negate the amount here before sending to Supabase
      const amountToStore = -Math.abs(dataToConfirm.amount); // Ensure it's negative for storage

      if (editingExpense) {
        // Ensure numero_gasto is explicitly string | null for updateRecord
        const dataToUpdate = {
          ...dataToConfirm,
          amount: amountToStore, // Use the negated amount
          numero_gasto: dataToConfirm.numero_gasto === undefined ? null : dataToConfirm.numero_gasto,
        };
        await updateRecord(editingExpense.id, dataToUpdate);
        toast.success('Gasto actualizado', { description: 'El gasto ha sido actualizado exitosamente.' });
        handleCloseDialog();
      } else {
        // Ensure numero_gasto is explicitly string | null for addRecord
        const dataToAdd = {
          ...dataToConfirm,
          amount: amountToStore, // Use the negated amount
          numero_gasto: dataToConfirm.numero_gasto === undefined ? null : dataToConfirm.numero_gasto,
        };
        const newRecord = await addRecord(dataToAdd);
        toast.success('Gasto añadido', { description: 'El nuevo gasto ha sido registrado exitosamente.' });
        
        let nextNumeroGastoForForm: string | null = null;
        if (newRecord && newRecord.numero_gasto) {
          const numPart = parseInt(newRecord.numero_gasto.substring(2), 10);
          if (!isNaN(numPart)) {
            nextNumeroGastoForForm = `GA${String(numPart + 1).padStart(3, '0')}`;
          }
        } else {
          nextNumeroGastoForForm = generateNextNumeroGasto(expenseData);
        }

        form.reset({
          amount: '',
          account: '',
          date: format(new Date(), 'yyyy-MM-dd'),
          category: '',
          sub_category: null, // Corrected to sub_category
          description: '',
          numero_gasto: nextNumeroGastoForForm,
          colaborador_id: null,
        });
        setEditingExpense(null);
        handleCloseConfirmationOnly();
        await refreshData();
      }
    } catch (submitError: any) {
      console.error('Error al guardar el gasto:', submitError.message);
      toast.error('Error al guardar gasto', { description: submitError.message });
    } finally {
      setIsConfirmingSubmission(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este gasto?')) {
      await deleteRecord(id);
      toast.success('Gasto eliminado', { description: 'El gasto ha sido eliminado exitosamente.' });
    }
  };

  const columnsWithActions: ColumnDef<GastoType>[] = expenseColumns.map(col => {
    if (col.id === 'actions') {
      return {
        ...col,
        cell: ({ row }) => {
          const expense = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Abrir menú</span>
                  <Edit className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-card border-border rounded-lg shadow-lg">
                <DropdownMenuItem onClick={() => handleOpenDialog(expense)} className="hover:bg-muted/50 cursor-pointer">
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDelete(expense.id)} className="hover:bg-destructive/20 text-destructive cursor-pointer">
                  Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      };
    }
    return col;
  });

  if (loading || accountsLoading) {
    return <div className="text-center text-muted-foreground">Cargando gastos y cuentas...</div>;
  }

  if (error) {
    return <div className="text-center text-destructive">Error al cargar gastos: {error}</div>;
  }

  if (accountsError) {
    return <div className="text-center text-destructive">Error al cargar cuentas: {accountsError}</div>;
  }

  return (
    <div className="space-y-8">
      <Card className="rounded-xl border-border shadow-lg animate-fade-in">
        <CardHeader className="flex flex-col space-y-4">
          <div className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-foreground">Gestión de Gastos</CardTitle>
              <CardDescription className="text-muted-foreground">
                Visualiza, busca y gestiona tus gastos.
              </CardDescription>
            </div>
            <Button onClick={() => handleOpenDialog()} className="flex items-center gap-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-300">
              <PlusCircle className="h-4 w-4" />
              Añadir Gasto
            </Button>
          </div>

          {/* Filter Section */}
          <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-border mt-4">
            {/* Global Search Input */}
            <div className="relative flex-grow max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por categoría, número de gasto, subcategoría o descripción..."
                value={globalFilter ?? ''}
                onChange={(event) => setGlobalFilter(event.target.value)}
                className="pl-9 rounded-lg border-border bg-background text-foreground focus:ring-primary focus:border-primary transition-all duration-300"
              />
            </div>

            {/* Date Filter */}
            <div className="flex items-center gap-2">
              <Label htmlFor="filter-date" className="text-textSecondary">Fecha:</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-[180px] justify-start text-left font-normal rounded-lg border-border bg-background text-foreground focus:ring-primary focus:border-primary transition-all duration-300",
                      !dateFilter && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFilter ? format(dateFilter, "PPP", { locale: es }) : <span>Selecciona una fecha</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-card border-border rounded-xl shadow-lg" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFilter}
                    onSelect={setDateFilter}
                    initialFocus
                    locale={es}
                    toDate={new Date()}
                  />
                </PopoverContent>
              </Popover>
              {dateFilter && (
                <Button variant="ghost" size="icon" onClick={() => setDateFilter(undefined)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                  <XCircle className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Collaborator Filter */}
            <div className="flex items-center gap-2">
              <Label htmlFor="filter-colaborador" className="text-textSecondary">Colaborador:</Label>
              <Select onValueChange={(value) => setColaboradorFilter(value === 'all' ? null : value)} value={colaboradorFilter || 'all'}>
                <SelectTrigger id="filter-colaborador" className="w-[200px] rounded-lg border-border bg-background text-foreground focus:ring-primary focus:border-primary transition-all duration-300">
                  <SelectValue placeholder="Todos los colaboradores" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border rounded-lg shadow-lg">
                  <SelectItem value="all" className="hover:bg-muted/50 cursor-pointer">Todos los colaboradores</SelectItem>
                  {colaboradoresData.map(colaborador => (
                    <SelectItem key={colaborador.id} value={colaborador.id} className="hover:bg-muted/50 cursor-pointer">
                      {colaborador.name} {colaborador.apellidos}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Clear Filters Button */}
            {(dateFilter || colaboradorFilter || globalFilter) && (
              <Button
                variant="outline"
                onClick={clearAllFilters}
                className="flex items-center gap-2 rounded-lg border-border bg-background text-foreground hover:bg-muted/50 transition-all duration-300"
              >
                <XCircle className="h-4 w-4" />
                Limpiar Filtros
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* VISTA ESCRITORIO: Tabla (Oculta en móvil) */}
          <div className="hidden md:block">
            <DataTable
              columns={columnsWithActions}
              data={expenseData}
              globalFilter={globalFilter}
              setGlobalFilter={setGlobalFilter}
              customGlobalFilterFn={expenseGlobalFilterFn}
            />
          </div>

          {/* VISTA MÓVIL: Tarjetas (Oculta en md+) */}
          <div className="grid gap-4 md:hidden">
            {expenseData.map((expense) => {
              // FIX: expense.amount is already a number
              const amount = expense.amount;
              const formattedAmount = formatCurrency(amount);
              // Los gastos se almacenan como negativos, pero el color debe ser de error (rojo)
              const colorClass = 'text-error'; 
              const formattedDate = format(parseISO(expense.date), 'dd MMM yyyy', { locale: es });
              
              // Buscar nombre del colaborador
              const collaborator = colaboradoresData.find(c => c.id === expense.colaborador_id);
              const collaboratorName = collaborator ? `${collaborator.name} ${collaborator.apellidos}` : 'N/A';

              return (
                <Card key={expense.id} className="w-full bg-card border-border shadow-lg transition-all duration-300">
                  <CardHeader className="p-4 flex flex-row items-center justify-between border-b border-border/50">
                    <span className="text-sm font-medium text-textSecondary">{formattedDate}</span>
                    <CardTitle className={cn("text-xl font-bold", colorClass)}>
                      {formattedAmount}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 space-y-2 text-sm">
                    <div className="flex justify-between items-start">
                      <span className="text-textSecondary shrink-0 mr-2">Descripción:</span>
                      <span className="font-medium text-foreground text-right break-words">{expense.description}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-textSecondary">Nº Gasto:</span>
                      <span className="font-medium text-foreground">{expense.numero_gasto || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-textSecondary">Categoría:</span>
                      <span className="font-medium text-foreground">{expense.category}</span>
                    </div>
                    {expense.sub_category && (
                      <div className="flex justify-between">
                        <span className="text-textSecondary">Subcategoría:</span>
                        <span className="font-medium text-foreground">{expense.sub_category}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-textSecondary">Cuenta:</span>
                      <span className="font-medium text-foreground">{expense.account}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-textSecondary">Colaborador:</span>
                      <span className="font-medium text-foreground text-right truncate max-w-[60%]">{collaboratorName}</span>
                    </div>
                    <div className="pt-3 flex justify-end gap-2 border-t border-border/50">
                      <Button variant="outline" size="icon" className="h-8 w-8 text-accent hover:bg-accent/10" onClick={() => handleOpenDialog(expense)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(expense.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px] bg-card border-border rounded-xl shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground">{editingExpense ? 'Editar Gasto' : 'Añadir Nuevo Gasto'}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {editingExpense ? 'Realiza cambios en el gasto existente aquí.' : 'Añade un nuevo registro de gasto a tu sistema.'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="amount" className="text-right text-textSecondary">
                  Monto
                </Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  {...form.register('amount')}
                  className="col-span-3 rounded-lg border-border bg-background text-foreground focus:ring-primary focus:border-primary transition-all duration-300"
                  placeholder="0.00"
                />
                {form.formState.errors.amount && <p className="col-span-4 text-right text-error text-sm">{form.formState.errors.amount.message}</p>}
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="account" className="text-right text-textSecondary">
                  Cuenta
                </Label>
                <Select onValueChange={(value) => form.setValue('account', value)} value={form.watch('account')}>
                  <SelectTrigger className="col-span-3 rounded-lg border-border bg-background text-foreground focus:ring-primary focus:border-primary transition-all duration-300">
                    <SelectValue placeholder="Selecciona una cuenta" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border rounded-lg shadow-lg">
                    {availableAccounts.length > 0 ? (
                      availableAccounts.map(account => (
                        <SelectItem key={account} value={account} className="hover:bg-muted/50 cursor-pointer">
                          {account}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-accounts" disabled>No hay cuentas disponibles</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {form.formState.errors.account && <p className="col-span-4 text-right text-error text-sm">{form.formState.errors.account.message}</p>}
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="category" className="text-right text-textSecondary">
                  Categoría
                </Label>
                <Select onValueChange={(value) => {
                  form.setValue('category', value);
                  form.setValue('sub_category', null); // Corrected to sub_category
                }} value={form.watch('category')}>
                  <SelectTrigger className="col-span-3 rounded-lg border-border bg-background text-foreground focus:ring-primary focus:border-primary transition-all duration-300">
                    <SelectValue placeholder="Selecciona una categoría" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border rounded-lg shadow-lg">
                    {MAIN_EXPENSE_CATEGORIES.map(category => (
                      <SelectItem key={category.value} value={category.value} className="hover:bg-muted/50 cursor-pointer">
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.category && <p className="col-span-4 text-right text-error text-sm">{form.formState.errors.category.message}</p>}
              </div>

              {watchedCategory && (watchedCategory === 'Gasto Fijo' || watchedCategory === 'Viáticos') && (
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="sub_category" className="text-right text-textSecondary"> {/* Corrected to sub_category */}
                    Subcategoría
                  </Label>
                  <Select onValueChange={(value) => form.setValue('sub_category', value)} value={form.watch('sub_category') || ''}> {/* Corrected to sub_category */}
                    <SelectTrigger className="col-span-3 rounded-lg border-border bg-background text-foreground focus:ring-primary focus:border-primary transition-all duration-300">
                      <SelectValue placeholder="Selecciona una subcategoría" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border rounded-lg shadow-lg">
                      {watchedCategory === 'Gasto Fijo' && GASTOS_FIJOS_SUB_CATEGORIES.map(subCat => (
                        <SelectItem key={subCat.value} value={subCat.value} className="hover:bg-muted/50 cursor-pointer">
                          {subCat.label}
                        </SelectItem>
                      ))}
                      {watchedCategory === 'Viáticos' && VIATICOS_SUB_CATEGORIES.map(subCat => (
                        <SelectItem key={subCat.value} value={subCat.value} className="hover:bg-muted/50 cursor-pointer">
                          {subCat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.sub_category && <p className="col-span-4 text-right text-error text-sm">{form.formState.errors.sub_category.message}</p>} {/* Corrected to sub_category */}
                </div>
              )}

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="description" className="text-right text-textSecondary">
                  Descripción
                </Label>
                <Textarea
                  id="description"
                  {...form.register('description')}
                  className="col-span-3 rounded-lg border-border bg-background text-foreground focus:ring-primary focus:border-primary transition-all duration-300"
                />
                {form.formState.errors.description && <p className="col-span-4 text-right text-error text-sm">{form.formState.errors.description.message}</p>}
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="numero_gasto" className="text-right text-textSecondary">
                  Nº Gasto
                </Label>
                <Input
                  id="numero_gasto"
                  {...form.register('numero_gasto')}
                  className="col-span-3 rounded-lg border-border bg-background text-foreground focus:ring-primary focus:border-primary transition-all duration-300"
                  readOnly
                />
                {form.formState.errors.numero_gasto && <p className="col-span-4 text-right text-error text-sm">{form.formState.errors.numero_gasto.message}</p>}
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="colaborador_id" className="text-right text-textSecondary">
                  Colaborador (Opcional)
                </Label>
                <Select onValueChange={(value) => form.setValue('colaborador_id', value)} value={form.watch('colaborador_id') || ''}>
                  <SelectTrigger className="col-span-3 rounded-lg border-border bg-background text-foreground focus:ring-primary focus:border-primary transition-all duration-300">
                    <SelectValue placeholder="Selecciona un colaborador" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border rounded-lg shadow-lg">
                    {colaboradoresData.map(colaborador => (
                      <SelectItem key={colaborador.id} value={colaborador.id} className="hover:bg-muted/50 cursor-pointer">
                        {colaborador.name} {colaborador.apellidos}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.colaborador_id && <p className="col-span-4 text-right text-error text-sm">{form.formState.errors.colaborador_id.message}</p>}
              </div>
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="grid grid-cols-4 items-center gap-4">
                    <FormLabel className="text-right text-textSecondary">Fecha</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "col-span-3 w-full justify-start text-left font-normal rounded-lg border-border bg-background text-foreground focus:ring-primary focus:border-primary transition-all duration-300",
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
                    <FormMessage className="col-span-4 text-right" />
                  </FormItem>
                )}
              />
              <DialogFooter className="mt-4">
                <Button type="button" variant="outline" onClick={handleCloseDialog} className="rounded-lg border-border hover:bg-muted/50 transition-all duration-300">
                  Cancelar
                </Button>
                <Button type="submit" className="rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-300">
                  {editingExpense ? 'Guardar Cambios' : 'Añadir Gasto'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={isConfirmDialogOpen}
        onClose={handleCloseConfirmationOnly}
        onConfirm={handleConfirmSubmit}
        title={editingExpense ? 'Confirmar Edición de Gasto' : 'Confirmar Nuevo Gasto'}
        description="Por favor, revisa los detalles del gasto antes de confirmar."
        data={dataToConfirm || {}}
        confirmButtonText={editingExpense ? 'Confirmar Actualización' : 'Confirmar Registro'}
        isConfirming={isConfirmingSubmission}
      />
    </div>
  );
}
