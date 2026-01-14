import { useState, useEffect, useCallback, useMemo } from 'react';
import { ColumnDef, Column, Row } from '@tanstack/react-table';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { PlusCircle, Edit, ArrowUpDown, Loader2, CalendarIcon, Search, ChevronDown, Check, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui-custom/DataTable';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSupabaseData } from '@/hooks/useSupabaseData';
import { Ingreso as IngresoType, Cuenta } from '@/lib/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn, formatCurrency } from '@/lib/utils';
import { FormField, FormItem, FormLabel, FormControl, FormMessage, Form } from '@/components/ui/form';
import ConfirmationDialog from '@/components/ui-custom/ConfirmationDialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { useUser } from '@/context/UserContext';
import { Badge } from '@/components/ui/badge';

// --- Form Schema for Ingreso ---
const incomeFormSchema = z.object({
  receipt_number: z.string().min(1, { message: 'El número de recibo es requerido.' }).max(255, { message: 'El número de recibo es demasiado largo.' }),
  dni: z.string().min(8, { message: 'El DNI debe tener 8 dígitos.' }).max(8, { message: 'El DNI debe tener 8 dígitos.' }).regex(/^\d{8}$/, { message: 'El DNI debe ser 8 dígitos numéricos.' }),
  full_name: z.string().min(1, { message: 'El nombre completo es requerido.' }).max(255, { message: 'El nombre completo es demasiado largo.' }),
  amount: z.preprocess(
    (val) => {
      if (val === '') return undefined; // Treat empty string as undefined
      return Number(val);
    },
    z.number({
      required_error: 'El monto es requerido.',
      invalid_type_error: 'El monto debe ser un número.'
    })
  ),
  account: z.string().min(1, { message: 'La cuenta es requerida.' }),
  date: z.string().min(1, { message: 'La fecha es requerida.' }),
  transaction_type: z.enum(['Ingreso', 'Anulacion', 'Devolucion'], { message: 'Tipo de transacción inválido.' }),
  numeroOperacion: z.preprocess(
    // Pre-process to ensure the value is a string before validation
    (val) => (val === null || val === undefined || val === '' ? null : String(val)),
    z.string().optional().nullable()
  ),
  allow_duplicate_numero_operacion: z.boolean().optional().default(false),
})
.refine((data) => {
  // For 'Ingreso', amount must be strictly positive
  if (data.transaction_type === 'Ingreso' && data.amount <= 0) {
    return false;
  }
  return true;
}, {
  message: 'El monto para un ingreso debe ser positivo.',
  path: ['amount'],
})
.refine((data) => {
  // Conditional requirement for numeroOperacion
  if (['BBVA Empresa', 'Cuenta Fidel'].includes(data.account) && !data.numeroOperacion) {
    return false;
  }
  return true;
}, {
  message: 'El número de operación es requerido para la cuenta seleccionada.',
  path: ['numeroOperacion'],
})
.refine((data) => {
  // If numeroOperacion exists, it must be a valid number string
  if (data.numeroOperacion && isNaN(Number(data.numeroOperacion))) {
    return false;
  }
  return true;
}, {
  message: 'El número de operación debe ser un valor numérico.',
  path: ['numeroOperacion'],
})
.transform((data) => {
  let transformedAmount = data.amount;
  if (data.transaction_type === 'Anulacion') {
    transformedAmount = 0;
  } else if (data.transaction_type === 'Devolucion') {
    transformedAmount = -Math.abs(transformedAmount); // Ensure it's negative
  }
  return {
    ...data,
    amount: transformedAmount,
    // Ensure numeroOperacion is null if not provided and not required, and convert to number
    numeroOperacion: (['BBVA Empresa', 'Cuenta Fidel'].includes(data.account) && data.numeroOperacion)
      ? Number(data.numeroOperacion)
      : null,
  };
});

// Type for the data after Zod transformation (what onSubmit receives from resolver)
type IncomeFormValues = z.infer<typeof incomeFormSchema>;

// Type for the form's internal state (before Zod transformation, for useForm defaultValues)
type IncomeFormInputValues = {
  receipt_number: string;
  dni: string;
  full_name: string;
  amount: string; // Input field will hold a string
  account: string;
  date: string;
  transaction_type: 'Ingreso' | 'Anulacion' | 'Devolucion';
  numeroOperacion: string;
  allow_duplicate_numero_operacion: boolean;
};


// --- Column Definitions for Ingreso ---
const transactionTypes = ['Ingreso', 'Anulacion', 'Devolucion'];

function Income() {
  // Use IngresoType directly
  const { data: incomeData, loading, error, addRecord, updateRecord, deleteRecord } = useSupabaseData<IngresoType>({
    tableName: 'ingresos',
    selectQuery: '*, socio_titulares(localidad)', // Join socio_titulares to get locality
  });
  const { data: accountsData, loading: accountsLoading, error: accountsError } = useSupabaseData<Cuenta>({ tableName: 'cuentas' });

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<IngresoType | null>(null); // Keep original IngresoType for editing form
  const [globalFilter, setGlobalFilter] = useState('');
  const [isDniSearching, setIsDniSearching] = useState(false);
  const [isDuplicateNumeroOperacionDetected, setIsDuplicateNumeroOperacionDetected] = useState(false);

  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [dataToConfirm, setDataToConfirm] = useState<Omit<IncomeFormValues, 'allow_duplicate_numero_operacion'> | null>(null);
  const [isConfirmingSubmission, setIsConfirmingSubmission] = useState(false);

  // New state for locality filter
  const [uniqueLocalities, setUniqueLocalities] = useState<string[]>([]);
  const [selectedLocalidadFilter, setSelectedLocalidadFilter] = useState<string>('all'); // 'all' for no filter
  const [openLocalitiesFilterPopover, setOpenLocalitiesFilterPopover] = useState(false);

  // State for data displayed in the table, pre-filtered by locality
  const [displayIncomeData, setDisplayIncomeData] = useState<IngresoType[]>([]);

  // --- Estados para la gestión de roles y números de recibo restringidos ---
  const { user, roles, loading: userLoading } = useUser();
  const [receiptNumbersMap, setReceiptNumbersMap] = useState<Map<number, string>>(new Map());
  const [fetchingRestrictedReceipts, setFetchingRestrictedReceipts] = useState(false);
  // --- Fin de estados ---


  const form = useForm<IncomeFormInputValues>({
    resolver: zodResolver(incomeFormSchema),
    defaultValues: {
      receipt_number: '',
      dni: '',
      full_name: '',
      amount: '',
      account: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      transaction_type: 'Ingreso',
      numeroOperacion: '',
      allow_duplicate_numero_operacion: false,
    },
  });

  const { handleSubmit, register, setValue, watch, formState: { errors } } = form;
  const watchedDni = watch('dni');
  const watchedTransactionType = watch('transaction_type');
  const watchedAccount = watch('account');
  const watchedNumeroOperacion = watch('numeroOperacion');

  // Fetch accounts from Supabase
  const availableAccounts = accountsData.map(account => account.name);

  // Fetch unique localities for the filter dropdown
  const fetchUniqueLocalities = useCallback(async () => {
    const { data, error } = await supabase
      .from('socio_titulares')
      .select('localidad')
      .neq('localidad', '') // Exclude empty strings
      .order('localidad', { ascending: true });

    if (error) {
      console.error('Error fetching unique localities for filter:', error.message);
      toast.error('Error al cargar comunidades para el filtro', { description: error.message });
    } else if (data) {
      const unique = Array.from(new Set(data.map(item => item.localidad))).filter(Boolean) as string[];
      setUniqueLocalities(['Todas las Comunidades', ...unique]); // Add 'All' option
    }
  }, []);

  useEffect(() => {
    fetchUniqueLocalities();
  }, [fetchUniqueLocalities]);

  // Effect to filter income data based on selectedLocalidadFilter
  useEffect(() => {
    let filtered = incomeData;
    if (selectedLocalidadFilter !== 'all') {
      filtered = incomeData.filter(income =>
        income.socio_titulares?.localidad?.toLowerCase() === selectedLocalidadFilter.toLowerCase()
      );
    }
    setDisplayIncomeData(filtered);
  }, [incomeData, selectedLocalidadFilter]);

  // --- useEffect para cargar números de recibo restringidos ---
  useEffect(() => {
    const fetchRestrictedReceiptNumbers = async () => {
      if (userLoading || !user || !roles || displayIncomeData.length === 0) {
        setReceiptNumbersMap(new Map()); // Clear map if conditions not met
        return;
      }

      const hasSpecialRole = roles.some(role => ['engineer', 'files'].includes(role));

      if (hasSpecialRole) {
        setFetchingRestrictedReceipts(true);
        const ingresoIds = displayIncomeData.map(income => income.id);

        if (ingresoIds.length === 0) {
          setReceiptNumbersMap(new Map());
          setFetchingRestrictedReceipts(false);
          return;
        }

        const { data, error } = await supabase.rpc('get_receipt_numbers_for_role', { ingreso_ids: ingresoIds });

        if (error) {
          console.error('Error fetching restricted receipt numbers:', error.message);
          toast.error('Error al cargar números de recibo restringidos', { description: error.message });
          setReceiptNumbersMap(new Map());
        } else {
          const newMap = new Map<number, string>();
          data.forEach((item: { id: number; receipt_number: string }) => {
            if (item.receipt_number) {
              newMap.set(item.id, item.receipt_number);
            }
          });
          setReceiptNumbersMap(newMap);
        }
        setFetchingRestrictedReceipts(false);
      } else {
        // Si el usuario no tiene roles especiales, limpiar el mapa
        setReceiptNumbersMap(new Map());
      }
    };

    fetchRestrictedReceiptNumbers();
  }, [displayIncomeData, roles, user, userLoading]);
  // --- Fin de useEffect ---


  // DNI Auto-population Logic
  const searchSocioByDni = useCallback(async (dni: string) => {
    if (!dni || dni.length !== 8) {
      setValue('full_name', '');
      return;
    }
    setIsDniSearching(true);
    const { data, error } = await supabase
      .from('socio_titulares')
      .select('nombres, apellidoPaterno, apellidoMaterno')
      .eq('dni', dni)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error searching socio by DNI:', error.message);
      toast.error('Error al buscar DNI', { description: error.message });
      setValue('full_name', '');
    } else if (data) {
      const fullName = `${data.nombres || ''} ${data.apellidoPaterno || ''} ${data.apellidoMaterno || ''}`.trim();
      setValue('full_name', fullName);
      toast.success('Socio encontrado', { description: `Nombre: ${fullName}` });
    } else {
      setValue('full_name', '');
      toast.warning('DNI no encontrado', { description: 'No se encontró un socio con este DNI.' });
    }
    setIsDniSearching(false);
  }, [setValue]);

  useEffect(() => {
    if (editingIncome?.dni) {
      searchSocioByDni(editingIncome.dni);
    }
  }, [editingIncome, searchSocioByDni]);

  // Effect to handle amount change based on transaction type
  useEffect(() => {
    if (watchedTransactionType === 'Anulacion') {
      setValue('amount', '0', { shouldValidate: true });
    }
  }, [watchedTransactionType, setValue]);

  const handleCloseConfirmationOnly = () => {
    setIsConfirmDialogOpen(false);
    setDataToConfirm(null);
    setIsConfirmingSubmission(false);
  };

  const handleOpenDialog = (income?: IngresoType) => { // Keep original IngresoType for form
    setEditingIncome(income || null);
    setIsDuplicateNumeroOperacionDetected(false);
    if (income) {
      form.reset({
        receipt_number: income.receipt_number || '',
        dni: income.dni || '',
        full_name: income.full_name || '',
        amount: Math.abs(income.amount).toString(),
        account: income.account || '',
        date: income.date,
        transaction_type: income.transaction_type as IncomeFormInputValues['transaction_type'] || 'Ingreso',
        numeroOperacion: String(income.numeroOperacion || ''),
        allow_duplicate_numero_operacion: false,
      });
    } else {
      form.reset({
        receipt_number: '',
        dni: '',
        full_name: '',
        amount: '',
        account: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        transaction_type: 'Ingreso',
        numeroOperacion: '',
        allow_duplicate_numero_operacion: false,
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingIncome(null);
    setIsDuplicateNumeroOperacionDetected(false);
    form.reset({
      receipt_number: '',
      dni: '',
      full_name: '',
      amount: '',
      account: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      transaction_type: 'Ingreso',
      numeroOperacion: '',
      allow_duplicate_numero_operacion: false,
    });
    handleCloseConfirmationOnly();
  };

  const onSubmit = async (inputValues: IncomeFormInputValues, event?: React.BaseSyntheticEvent) => {
    event?.preventDefault();

    // Clear previous numeroOperacion errors and reset duplicate detection state
    form.clearErrors('numeroOperacion');
    setIsDuplicateNumeroOperacionDetected(false);

    // First, parse with Zod to get client-side validation (excluding async uniqueness)
    // This will also apply the transform for numeroOperacion to null if not required/provided
    const parsedValues: IncomeFormValues = incomeFormSchema.parse(inputValues);

    // Perform async uniqueness check for numeroOperacion if applicable
    // Only check if parsedValues.numeroOperacion has a value AND duplication is NOT allowed
    if (parsedValues.numeroOperacion && !parsedValues.allow_duplicate_numero_operacion) {
      let query = supabase
        .from('ingresos')
        .select('id')
        .eq('numeroOperacion', parsedValues.numeroOperacion);

      // If editing, exclude the current income's ID from the uniqueness check
      if (editingIncome) {
        query = query.neq('id', editingIncome.id);
      }

      const { data: existingIncomes, error: supabaseError } = await query;

      if (supabaseError) {
        console.error('Error checking numeroOperacion uniqueness:', supabaseError.message);
        toast.error('Error de validación', { description: 'No se pudo verificar la unicidad del número de operación.' });
        return;
      }

      if (existingIncomes && existingIncomes.length > 0) {
        form.setError('numeroOperacion', {
          type: 'manual',
          message: 'El número de operación ya existe. Marque "Permitir duplicado" si es intencional.',
        });
        setIsDuplicateNumeroOperacionDetected(true);
        toast.error('Error de validación', { description: 'El número de operación ya existe.' });
        return;
      }
    }

    // If all checks pass, proceed to confirmation
    // Omit allow_duplicate_numero_operacion before passing to confirmation dialog
    const { allow_duplicate_numero_operacion, ...dataToConfirmWithoutFlag } = parsedValues;
    setDataToConfirm(dataToConfirmWithoutFlag);
    setIsConfirmDialogOpen(true);
  };

  const handleConfirmSubmit = async () => {
    if (!dataToConfirm) return;

    setIsConfirmingSubmission(true);
    try {
      if (editingIncome) {
        // dataToConfirm already excludes allow_duplicate_numero_operacion
        await updateRecord(editingIncome.id, dataToConfirm);
        toast.success('Ingreso actualizado', { description: 'El ingreso ha sido actualizado exitosamente.' });
        handleCloseDialog();
      } else {
        // dataToConfirm already excludes allow_duplicate_numero_operacion
        await addRecord(dataToConfirm);
        toast.success('Ingreso añadido', { description: 'El nuevo ingreso ha sido registrado exitosamente.' });

        form.reset({
          receipt_number: '',
          dni: '',
          full_name: '',
          amount: '',
          account: '',
          date: format(new Date(), 'yyyy-MM-dd'),
          transaction_type: 'Ingreso',
          numeroOperacion: '',
          allow_duplicate_numero_operacion: false,
        });
        setEditingIncome(null);
        handleCloseConfirmationOnly();
      }
    } catch (submitError: any) {
      console.error('Error al guardar el ingreso:', submitError.message);
      toast.error('Error al guardar ingreso', { description: submitError.message });
    } finally {
      setIsConfirmingSubmission(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este ingreso?')) {
      await deleteRecord(id);
      toast.success('Ingreso eliminado', { description: 'El ingreso ha sido eliminado exitosamente.' });
    }
  };

  const incomeColumns: ColumnDef<IngresoType>[] = useMemo(
    () => [
      {
        accessorKey: 'date',
        header: ({ column }: { column: Column<IngresoType> }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="px-0 hover:bg-transparent hover:text-accent"
          >
            Fecha
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }: { row: Row<IngresoType> }) => format(parseISO(row.getValue('date')), 'dd MMM yyyy', { locale: es }),
      },
      {
        accessorKey: 'receipt_number',
        header: ({ column }: { column: Column<IngresoType> }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="px-0 hover:bg-transparent hover:text-accent"
          >
            Nº Recibo
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }: { row: Row<IngresoType> }) => {
          const income = row.original;
          const hasSpecialRole = roles?.some(role => ['engineer', 'files'].includes(role));

          if (userLoading || fetchingRestrictedReceipts) {
            return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
          }

          if (hasSpecialRole) {
            const receiptNum = receiptNumbersMap.get(income.id);
            return <span className="font-medium text-foreground">{receiptNum || 'N/A'}</span>;
          } else if (income.receipt_number) {
            // Si el usuario tiene acceso directo (ej. admin), el número de recibo estará en income.receipt_number
            return <span className="font-medium text-foreground">{income.receipt_number}</span>;
          } else {
            return <span className="text-muted-foreground">Acceso Restringido</span>;
          }
        },
      },
      {
        accessorKey: 'full_name',
        header: 'Nombre Completo',
        cell: ({ row }: { row: Row<IngresoType> }) => <span className="text-muted-foreground">{row.getValue('full_name')}</span>,
      },
      {
        accessorKey: 'dni',
        header: 'DNI',
        cell: ({ row }: { row: Row<IngresoType> }) => <span className="text-muted-foreground">{row.getValue('dni')}</span>,
      },
      {
        accessorKey: 'account',
        header: 'Cuenta',
        cell: ({ row }: { row: Row<IngresoType> }) => <span className="text-muted-foreground">{row.getValue('account')}</span>,
      },
      {
        accessorKey: 'numeroOperacion',
        header: 'Nº Operación',
        cell: ({ row }: { row: Row<IngresoType> }) => <span className="text-muted-foreground">{row.getValue('numeroOperacion') || '-'}</span>,
      },
      {
        accessorKey: 'transaction_type',
        header: ({ column }: { column: Column<IngresoType> }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="px-0 hover:bg-transparent hover:text-accent"
          >
            Tipo Transacción
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }: { row: Row<IngresoType> }) => <span className="text-muted-foreground">{row.getValue('transaction_type')}</span>,
      },
      {
        accessorKey: 'amount',
        header: () => <div className="text-right">Monto</div>,
        cell: ({ row }: { row: Row<IngresoType> }) => {
          // FIX: amount is already a number (IngresoType['amount']), remove parseFloat
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
        accessorKey: 'socio_titulares.localidad', // Access the nested locality
        header: 'Comunidad',
        cell: ({ row }: { row: Row<IngresoType> }) => (
          <span className="text-muted-foreground">
            {row.original.socio_titulares?.localidad || 'N/A'}
          </span>
        ),
      },
      {
        id: 'actions',
        enableHiding: false,
        cell: ({ row }: { row: Row<IngresoType> }) => {
          const income = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Abrir menú</span>
                  <Edit className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-card border-border rounded-lg shadow-lg">
                <DropdownMenuItem onClick={() => handleOpenDialog(income)} className="hover:bg-muted/50 cursor-pointer">
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDelete(income.id)} className="hover:bg-destructive/20 text-destructive cursor-pointer">
                  Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [roles, userLoading, fetchingRestrictedReceipts, receiptNumbersMap] // Dependencias para useMemo
  );

  // Custom global filter function for DataTable (now only handles text search)
  const customGlobalFilterFn = useCallback((row: Row<IngresoType>, _columnId: string, filterValue: any) => {
    const search = String(filterValue).toLowerCase();
    const income = row.original;

    const receiptNumber = income.receipt_number?.toLowerCase() || '';
    const dni = income.dni?.toLowerCase() || '';
    const fullName = income.full_name?.toLowerCase() || '';
    const account = income.account?.toLowerCase() || '';
    // FIX: Ensure numeroOperacion is a string before calling toLowerCase()
    const numeroOperacion = String(income.numeroOperacion || '').toLowerCase();
    const transactionType = income.transaction_type?.toLowerCase() || '';
    const locality = income.socio_titulares?.localidad?.toLowerCase() || ''; // Include locality in global search

    // Incluir el número de recibo restringido en la búsqueda global si está disponible
    const hasSpecialRole = roles?.some(role => ['engineer', 'files'].includes(role));
    const restrictedReceiptNum = hasSpecialRole ? receiptNumbersMap.get(income.id)?.toLowerCase() || '' : '';


    return (
      receiptNumber.includes(search) ||
      dni.includes(search) ||
      fullName.includes(search) ||
      account.includes(search) ||
      numeroOperacion.includes(search) ||
      transactionType.includes(search) ||
      locality.includes(search) ||
      restrictedReceiptNum.includes(search) // Incluir en la búsqueda global
    );
  }, [roles, receiptNumbersMap]); // Añadir roles y receiptNumbersMap a las dependencias

  if (loading || accountsLoading || userLoading) {
    return (
      <div className="min-h-screen bg-background text-text font-sans flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg">Cargando ingresos, cuentas y perfil de usuario...</p>
      </div>
    );
  }

  if (error) {
    return <div className="text-center text-destructive">Error al cargar ingresos: {error}</div>;
  }

  if (accountsError) {
    return <div className="text-center text-destructive">Error al cargar cuentas: {accountsError}</div>;
  }

  return (
    <div className="min-h-screen bg-background text-text font-sans p-4 md:p-6 w-full max-w-[100vw] overflow-x-hidden">
      
      {/* Header con Imagen */}
      <header className="relative h-40 md:h-64 flex items-center justify-center overflow-hidden bg-gradient-to-br from-primary to-secondary rounded-xl shadow-lg mb-8">
        <img
          src="https://images.pexels.com/photos/3184433/pexels-photo-3184433.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2"
          alt="Financial management"
          className="absolute inset-0 w-full h-full object-cover opacity-30"
        />
        <div className="relative z-10 text-center p-4">
          <h1 className="text-3xl md:text-5xl font-extrabold text-white drop-shadow-lg leading-tight">
            Gestión de Ingresos
          </h1>
          <p className="mt-2 text-sm md:text-xl text-white text-opacity-90 max-w-2xl mx-auto hidden md:block">
            Administra y visualiza todos los registros de ingresos.
          </p>
        </div>
      </header>

      <Card className="container mx-auto py-6 md:py-10 bg-surface rounded-xl shadow-lg p-4 md:p-6 w-full">
        <CardHeader className="mb-6 px-0 md:px-6">
          <CardTitle className="text-2xl md:text-3xl font-bold text-foreground">Resumen de Ingresos</CardTitle>
          <CardDescription className="text-muted-foreground">
            Gestiona y visualiza los ingresos de la organización.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          
          {/* Barra de Herramientas (Buscador + Filtros + Botón) */}
          <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between mb-6 gap-4">
            
            {/* Buscador */}
            <div className="relative flex items-center w-full xl:max-w-md">
              <Search className="absolute left-3 h-5 w-5 text-textSecondary" />
              <Input
                placeholder="Buscar..."
                value={globalFilter ?? ''}
                onChange={(event) => setGlobalFilter(event.target.value)}
                className="pl-10 pr-4 py-2 rounded-lg border-border bg-background text-foreground w-full"
              />
            </div>

            <div className="flex flex-col md:flex-row gap-3 w-full xl:w-auto">
              {/* Filtro de Localidad */}
              <Popover open={openLocalitiesFilterPopover} onOpenChange={setOpenLocalitiesFilterPopover}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full md:w-[220px] justify-between rounded-lg border-border"
                  >
                    <span className="truncate">
                      {selectedLocalidadFilter === 'all'
                        ? "Todas las Comunidades"
                        : uniqueLocalities.find(loc => loc.toLowerCase() === selectedLocalidadFilter.toLowerCase()) || selectedLocalidadFilter}
                    </span>
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[220px] p-0 bg-card border-border" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar..." className="h-9" />
                    <CommandList>
                      <CommandEmpty>No se encontró.</CommandEmpty>
                      <CommandGroup>
                        {uniqueLocalities.map((loc) => (
                          <CommandItem
                            value={loc}
                            key={loc}
                            onSelect={(currentValue) => {
                              setSelectedLocalidadFilter(currentValue === 'Todas las Comunidades' ? 'all' : currentValue);
                              setOpenLocalitiesFilterPopover(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedLocalidadFilter === (loc === 'Todas las Comunidades' ? 'all' : loc) ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {loc}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {/* Botón Añadir */}
              <Button onClick={() => handleOpenDialog()} className="flex items-center gap-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 w-full md:w-auto">
                <PlusCircle className="h-4 w-4" />
                <span className="whitespace-nowrap">Añadir Ingreso</span>
              </Button>
            </div>
          </div>

          {/* =======================================================
              VISTA ESCRITORIO: Tabla (Oculta en 'md' e inferior)
             ======================================================= */}
          <div className="hidden md:block overflow-hidden">
            <DataTable
              columns={incomeColumns}
              data={displayIncomeData}
              globalFilter={globalFilter}
              setGlobalFilter={setGlobalFilter}
              customGlobalFilterFn={customGlobalFilterFn}
            />
          </div>

          {/* =======================================================
              VISTA MÓVIL: Tarjetas (Visible solo en móvil)
             ======================================================= */}
          <div className="grid gap-4 md:hidden">
            {displayIncomeData.map((income) => {
              // FIX: income.amount is already a number
              const amount = income.amount;
              const formattedAmount = formatCurrency(amount);
              const colorClass = amount > 0 ? 'text-success' : amount < 0 ? 'text-error' : 'text-foreground';
              const formattedDate = format(parseISO(income.date), 'dd MMM yyyy', { locale: es });
              
              const hasSpecialRole = roles?.some(role => ['engineer', 'files'].includes(role));
              const receiptDisplay = hasSpecialRole 
                ? receiptNumbersMap.get(income.id) || 'N/A' 
                : income.receipt_number || 'Acceso Restringido';

              return (
                <Card key={income.id} className="w-full bg-card border-border shadow-sm overflow-hidden">
                  {/* Header de la Tarjeta: Fecha y Monto Grande */}
                  <div className="flex flex-row items-center justify-between p-4 bg-muted/30 border-b border-border/50">
                    <div className="flex flex-col">
                       <span className="text-xs font-bold text-textSecondary uppercase tracking-wider">Fecha</span>
                       <span className="text-sm font-medium text-foreground flex items-center gap-1">
                          <CalendarIcon className="h-3 w-3" /> {formattedDate}
                       </span>
                    </div>
                    <div className={cn("text-xl font-bold", colorClass)}>
                      {formattedAmount}
                    </div>
                  </div>

                  <CardContent className="p-4 space-y-3 text-sm">
                    {/* Fila: Socio (Permitimos que baje de línea con break-words) */}
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-textSecondary">Socio Titular:</span>
                      <span className="font-medium text-foreground break-words text-lg leading-snug">
                        {income.full_name}
                      </span>
                      <span className="text-xs text-muted-foreground">DNI: {income.dni}</span>
                    </div>
                    
                    <div className="border-t border-border/40 my-2" />

                    {/* Detalles en Grid de 2 columnas */}
                    <div className="grid grid-cols-2 gap-y-3 gap-x-2">
                       <div>
                          <span className="text-xs text-textSecondary block">Recibo:</span>
                          <span className="font-medium text-foreground">{receiptDisplay}</span>
                       </div>
                       <div>
                          <span className="text-xs text-textSecondary block">Cuenta:</span>
                          <span className="font-medium text-foreground truncate">{income.account}</span>
                       </div>
                       <div>
                          <span className="text-xs text-textSecondary block">Operación:</span>
                          <span className="font-medium text-foreground">{income.numeroOperacion || '-'}</span>
                       </div>
                       <div>
                          <span className="text-xs text-textSecondary block">Comunidad:</span>
                          <span className="font-medium text-foreground truncate">{income.socio_titulares?.localidad || 'N/A'}</span>
                       </div>
                    </div>

                    {/* Footer: Badge y Acciones */}
                    <div className="pt-3 flex justify-between items-center border-t border-border/50 mt-2">
                      <Badge className={cn(
                        "text-xs font-semibold px-2 py-1",
                        income.transaction_type === 'Ingreso' ? "bg-success/10 text-success border-success/20" : 
                        income.transaction_type === 'Devolucion' ? "bg-warning/10 text-warning border-warning/20" : "bg-error/10 text-error border-error/20"
                      )}>
                        {income.transaction_type}
                      </Badge>
                      
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="h-8 px-3 text-accent hover:bg-accent/10 border-accent/30" onClick={() => handleOpenDialog(income)}>
                          <Edit className="h-3.5 w-3.5 mr-1.5" /> Editar
                        </Button>
                        <Button variant="outline" size="sm" className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 border-destructive/30" onClick={() => handleDelete(income.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            
            {/* Mensaje si no hay datos en filtro */}
            {displayIncomeData.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                    No se encontraron ingresos con estos filtros.
                </div>
            )}
          </div>

        </CardContent>
      </Card>

      {/* Diálogos */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px] bg-card border-border rounded-xl shadow-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">{editingIncome ? 'Editar Ingreso' : 'Añadir Nuevo Ingreso'}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {editingIncome ? 'Realiza cambios en el ingreso existente aquí.' : 'Añade un nuevo registro de ingreso a tu sistema.'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="receipt_number" className="text-right text-textSecondary">
                  Nº Recibo
                </Label>
                <Input
                  id="receipt_number"
                  {...register('receipt_number')}
                  className="col-span-3 rounded-lg border-border bg-background text-foreground focus:ring-primary focus:border-primary transition-all duration-300"
                  placeholder="Ej: 001-2024"
                />
                {errors.receipt_number && <p className="col-span-4 text-right text-error text-sm">{errors.receipt_number.message}</p>}
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="dni" className="text-right text-textSecondary">
                  DNI
                </Label>
                <div className="col-span-3 relative">
                  <Input
                    id="dni"
                    {...register('dni')}
                    onBlur={() => searchSocioByDni(watchedDni)}
                    className="rounded-lg border-border bg-background text-foreground focus:ring-primary focus:border-primary transition-all duration-300 pr-10"
                    placeholder="Ej: 12345678"
                  />
                  {isDniSearching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary" />
                  )}
                </div>
                {errors.dni && <p className="col-span-4 text-right text-error text-sm">{errors.dni.message}</p>}
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="full_name" className="text-right text-textSecondary">
                  Nombre Completo
                </Label>
                <Input
                  id="full_name"
                  {...register('full_name')}
                  readOnly
                  className="col-span-3 rounded-lg border-border bg-background text-foreground focus:ring-primary focus:border-primary transition-all duration-300 cursor-not-allowed"
                  placeholder="Se auto-completa con el DNI"
                />
                {errors.full_name && <p className="col-span-4 text-right text-error text-sm">{errors.full_name.message}</p>}
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="amount" className="text-right text-textSecondary">
                  Monto
                </Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  {...register('amount')}
                  className="col-span-3 rounded-lg border-border bg-background text-foreground focus:ring-primary focus:border-primary transition-all duration-300"
                  placeholder="0.00"
                  readOnly={watchedTransactionType === 'Anulacion'}
                />
                {errors.amount && <p className="col-span-4 text-right text-error text-sm">{errors.amount.message}</p>}
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="account" className="text-right text-textSecondary">
                  Cuenta
                </Label>
                <Select onValueChange={(value) => setValue('account', value)} value={watch('account')}>
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
                {errors.account && <p className="col-span-4 text-right text-error text-sm">{errors.account.message}</p>}
              </div>

              {/* Numero de Operacion */}
              {['BBVA Empresa', 'Cuenta Fidel'].includes(watchedAccount) && (
                <div className="grid grid-cols-4 items-center gap-4 animate-fade-in">
                  <Label htmlFor="numeroOperacion" className="text-right text-textSecondary">
                    Nº Operación
                  </Label>
                  <Input
                    id="numeroOperacion"
                    {...register('numeroOperacion')}
                    className="col-span-3 rounded-lg border-border bg-background text-foreground focus:ring-primary focus:border-primary transition-all duration-300"
                    placeholder="Ej: 1234567890"
                  />
                  {errors.numeroOperacion && <p className="col-span-4 text-right text-error text-sm">{errors.numeroOperacion.message}</p>}
                </div>
              )}

              {/* Allow Duplicate Checkbox */}
              {['BBVA Empresa', 'Cuenta Fidel'].includes(watchedAccount) && watchedNumeroOperacion && (
                <div className="grid grid-cols-4 items-center gap-4 animate-fade-in">
                  <div className="col-start-2 col-span-3 flex items-center space-x-2">
                    <Checkbox
                      id="allow_duplicate_numero_operacion"
                      checked={watch('allow_duplicate_numero_operacion')}
                      onCheckedChange={(checked) => setValue('allow_duplicate_numero_operacion', checked as boolean)}
                      disabled={!isDuplicateNumeroOperacionDetected}
                      className="border-border data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                    />
                    <Label
                      htmlFor="allow_duplicate_numero_operacion"
                      className={cn(
                        "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-textSecondary",
                        isDuplicateNumeroOperacionDetected && "cursor-pointer"
                      )}
                    >
                      Permitir duplicado de Nº Operación
                    </Label>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="transaction_type" className="text-right text-textSecondary">
                  Tipo Transacción
                </Label>
                <Select onValueChange={(value) => setValue('transaction_type', value as IncomeFormInputValues['transaction_type'])} value={watch('transaction_type')}>
                  <SelectTrigger className="col-span-3 rounded-lg border-border bg-background text-foreground focus:ring-primary focus:border-primary transition-all duration-300">
                    <SelectValue placeholder="Selecciona un tipo de transacción" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border rounded-lg shadow-lg">
                    {transactionTypes.map(type => (
                      <SelectItem key={type} value={type} className="hover:bg-muted/50 cursor-pointer">
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.transaction_type && <p className="col-span-4 text-right text-error text-sm">{errors.transaction_type.message}</p>}
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
                  {editingIncome ? 'Guardar Cambios' : 'Añadir Ingreso'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        isOpen={isConfirmDialogOpen}
        onClose={handleCloseConfirmationOnly}
        onConfirm={handleConfirmSubmit}
        title={editingIncome ? 'Confirmar Edición de Ingreso' : 'Confirmar Nuevo Ingreso'}
        description="Por favor, revisa los detalles del ingreso antes de confirmar."
        data={dataToConfirm || {}}
        confirmButtonText={editingIncome ? 'Confirmar Actualización' : 'Confirmar Registro'}
        isConfirming={isConfirmingSubmission}
      />
    </div>
  );
}

export default Income;
