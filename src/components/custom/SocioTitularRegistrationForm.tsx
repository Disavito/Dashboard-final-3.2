import { useState, useEffect, useCallback } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { SocioTitular, EconomicSituationOption } from '@/lib/types';
import { Loader2, CalendarIcon, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, parseISO, differenceInYears } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import ConfirmationDialog from '@/components/ui-custom/ConfirmationDialog';
import { DialogFooter } from '@/components/ui/dialog';
import axios from 'axios';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';


// --- Zod Schemas ---
const personalDataSchema = z.object({
  dni: z.string().min(8, { message: 'El DNI debe tener 8 dígitos.' }).max(8, { message: 'El DNI debe tener 8 dígitos.' }).regex(/^\d{8}$/, { message: 'El DNI debe ser 8 dígitos numéricos.' }),
  nombres: z.string().min(1, { message: 'Los nombres son requeridos.' }).max(255, { message: 'Los nombres son demasiado largos.' }),
  apellidoPaterno: z.string().min(1, { message: 'El apellido paterno es requerido.' }).max(255, { message: 'El apellido paterno es demasiado largo.' }),
  apellidoMaterno: z.string().min(1, { message: 'El apellido materno es requerido.' }).max(255, { message: 'El apellido materno es demasiado largo.' }),
  fechaNacimiento: z.string().min(1, { message: 'La fecha de nacimiento es requerida.' }),
  edad: z.number().int().min(0, { message: 'La edad no puede ser negativa.' }).optional().nullable(),
  celular: z.string()
    .max(15, { message: 'El celular es demasiado largo.' })
    .optional()
    .nullable()
    .refine((val) => {
      if (val === null || val === undefined || val === '') {
        return true; // Permite null, undefined o cadena vacía
      }
      return /^\d+$/.test(val); // Aplica regex solo si hay un valor
    }, {
      message: 'El celular debe contener solo números si está presente.',
    }),
  situacionEconomica: z.enum(['Pobre', 'Extremo Pobre'], { message: 'La situación económica es requerida.' }),
  direccionDNI: z.string().min(1, { message: 'La dirección DNI es requerida.' }).max(255, { message: 'La dirección DNI es demasiado larga.' }),
  regionDNI: z.string().min(1, { message: 'La región DNI es requerida.' }).max(255, { message: 'La región DNI es demasiado larga.' }),
  provinciaDNI: z.string().min(1, { message: 'La provincia DNI es requerida.' }).max(255, { message: 'La provincia DNI es demasiado larga.' }),
  distritoDNI: z.string().min(1, { message: 'El distrito DNI es requerido.' }).max(255, { message: 'El distrito DNI es demasiado larga.' }),
  localidad: z.string().min(1, { message: 'La localidad es requerida.' }).max(255, { message: 'La localidad es demasiado larga.' }),
  
  // NUEVOS CAMPOS DE OBSERVACIÓN
  isObservado: z.boolean().default(false),
  observacion: z.string().max(1000, { message: 'La observación es demasiado larga.' }).optional().nullable(),
}).superRefine((data, ctx) => {
  // Validación condicional: Si isObservado es true, observacion debe estar presente
  if (data.isObservado && (!data.observacion || data.observacion.trim() === '')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'La observación es requerida si el socio está marcado como "Observado".',
      path: ['observacion'],
    });
  }
});

const addressDataSchema = z.object({
  regionVivienda: z.string().optional().nullable(),
  provinciaVivienda: z.string().optional().nullable(),
  distritoVivienda: z.string().optional().nullable(),
  direccionVivienda: z.string().optional().nullable(),
  mz: z.string().optional().nullable(),
  lote: z.string().optional().nullable(),
});

const formSchema = z.intersection(personalDataSchema, addressDataSchema);

type SocioTitularFormValues = z.infer<typeof formSchema>;

interface SocioTitularRegistrationFormProps {
  socioId?: string; 
  onClose: () => void;
  onSuccess: () => void;
}

const economicSituationOptions: EconomicSituationOption[] = [
  { value: 'Pobre', label: 'Pobre' },
  { value: 'Extremo Pobre', label: 'Extremo Pobre' },
];

// Helper function to calculate age
const calculateAge = (dobString: string): number | null => {
  if (!dobString) return null;
  try {
    const dob = parseISO(dobString);
    return differenceInYears(new Date(), dob);
  } catch (e) {
    console.error("Error calculating age:", e);
    return null;
  }
};

function SocioTitularRegistrationForm({ socioId, onClose, onSuccess }: SocioTitularRegistrationFormProps) {
  const [activeTab, setActiveTab] = useState<'personal' | 'address'>('personal'); 
  const [isDniSearching, setIsDniSearching] = useState(false);
  const [isReniecSearching, setIsReniecSearching] = useState(false); 

  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [dataToConfirm, setDataToConfirm] = useState<SocioTitularFormValues | null>(null);
  const [isConfirmingSubmission, setIsConfirmingSubmission] = useState(false);

  // State for locality auto-suggestion
  const [localitiesSuggestions, setLocalitiesSuggestions] = useState<string[]>([]);
  const [isLocalitiesLoading, setIsLocalitiesLoading] = useState(false);
  const [openLocalitiesPopover, setOpenLocalitiesPopover] = useState(false);


  const form = useForm<SocioTitularFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      dni: '',
      nombres: '',
      apellidoPaterno: '',
      apellidoMaterno: '',
      fechaNacimiento: '',
      edad: null,
      celular: '',
      situacionEconomica: undefined,
      direccionDNI: '',
      regionDNI: '',
      provinciaDNI: '',
      distritoDNI: '',
      localidad: '',
      
      // DEFAULTS PARA OBSERVACIÓN
      isObservado: false,
      observacion: '',

      regionVivienda: '',
      provinciaVivienda: '',
      distritoVivienda: '',
      direccionVivienda: '',
      mz: '',
      lote: '',
    },
  });

  const { handleSubmit, setValue, watch, reset, register, control, formState: { errors } } = form;
  const watchedDni = watch('dni');
  const watchedFechaNacimiento = watch('fechaNacimiento');
  const watchedLocalidad = watch('localidad'); 
  const watchedIsObservado = watch('isObservado'); // Nuevo watch para observación

  useEffect(() => {
    if (watchedFechaNacimiento) {
      const calculatedAge = calculateAge(watchedFechaNacimiento);
      setValue('edad', calculatedAge);
    } else {
      setValue('edad', null);
    }
  }, [watchedFechaNacimiento, setValue]);

  // Fetch unique localities for auto-suggestion
  const fetchUniqueLocalities = useCallback(async () => {
    setIsLocalitiesLoading(true);
    const { data, error } = await supabase
      .from('socio_titulares')
      .select('localidad')
      .neq('localidad', '') // Exclude empty strings
      .order('localidad', { ascending: true });

    if (error) {
      console.error('Error fetching unique localities:', error.message);
      toast.error('Error al cargar localidades', { description: error.message });
    } else if (data) {
      const uniqueLocalities = Array.from(new Set(data.map(item => item.localidad))).filter(Boolean) as string[];
      setLocalitiesSuggestions(uniqueLocalities);
    }
    setIsLocalitiesLoading(false);
  }, []);

  useEffect(() => {
    fetchUniqueLocalities();
  }, [fetchUniqueLocalities]);


  const renderInputField = (
    id: keyof SocioTitularFormValues,
    label: string,
    placeholder: string,
    type: string = 'text',
    readOnly: boolean = false,
    isSearching: boolean = false,
    onBlur?: () => void
  ) => {
    return (
      <div className="flex flex-col sm:grid sm:grid-cols-4 sm:items-center gap-2 sm:gap-4">
        <Label htmlFor={id} className="sm:text-right text-textSecondary">
          {label}
        </Label>
        <div className="col-span-full sm:col-span-3 relative">
          <Input
            id={id}
            type={type}
            {...register(id, { valueAsNumber: id === 'edad' ? true : false })}
            className="rounded-lg border-border bg-background text-foreground focus:ring-primary focus:border-primary transition-all duration-300"
            placeholder={placeholder}
            readOnly={readOnly}
            onBlur={onBlur}
          />
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y/1/2 h-4 w-4 animate-spin text-primary" />
          )}
        </div>
        {errors[id] && <p className="col-span-full sm:col-span-4 text-right text-error text-sm">{errors[id]?.message}</p>}
      </div>
    );
  };

  const renderTextareaField = (
    id: keyof SocioTitularFormValues,
    label: string,
    placeholder: string,
    readOnly: boolean = false,
    isSearching: boolean = false
  ) => {
    return (
      <div className="flex flex-col sm:grid sm:grid-cols-4 sm:items-center gap-2 sm:gap-4">
        <Label htmlFor={id} className="sm:text-right text-textSecondary">
          {label}
        </Label>
        <div className="col-span-full sm:col-span-3 relative">
          <Textarea
            id={id}
            {...register(id)}
            className="flex-grow rounded-lg border-border bg-background text-foreground focus:ring-primary focus:border-primary transition-all duration-300"
            placeholder={placeholder}
            readOnly={readOnly}
          />
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y/1/2 h-4 w-4 animate-spin text-primary" />
          )}
        </div>
        {errors[id] && <p className="col-span-full sm:col-span-4 text-right text-error text-sm">{errors[id]?.message}</p>}
      </div>
    );
  };

  const renderRadioGroupField = (
    id: keyof SocioTitularFormValues,
    label: string,
    options: { value: string; label: string }[]
  ) => {
    return (
      <FormField
        control={control}
        name={id}
        render={({ field }) => (
          <FormItem className="flex flex-col sm:grid sm:grid-cols-4 sm:items-center gap-2 sm:gap-4">
            <FormLabel className="sm:text-right text-textSecondary">{label}</FormLabel>
            <FormControl className="col-span-full sm:col-span-3">
              <RadioGroup
                onValueChange={field.onChange}
                value={field.value as string}
                className="flex flex-row space-x-4"
              >
                {options.map(option => (
                  <div key={option.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={option.value} id={`${id}-${option.value}`} />
                    <Label htmlFor={`${id}-${option.value}`}>{option.label}</Label>
                  </div>
                ))}
              </RadioGroup>
            </FormControl>
            {errors[id] && <FormMessage className="col-span-full sm:col-span-4 text-right">{errors[id]?.message}</FormMessage>}
          </FormItem>
        )}
      />
    );
  };

  // Helper function to fetch Reniec data and populate fields
  const fetchReniecDataAndPopulate = useCallback(async (dni: string): Promise<boolean> => {
    if (!dni || dni.length !== 8) {
      return false; // Invalid DNI, no data fetched
    }

    setIsReniecSearching(true);
    let dataFound = false;

    // --- 1. Attempt Primary API Call (Consultas Peru) ---
    try {
      const token = import.meta.env.VITE_CONSULTAS_PERU_API_TOKEN;
      if (!token) {
        throw new Error('VITE_CONSULTAS_PERU_API_TOKEN no está configurado en el archivo .env');
      }

      const apiUrl = `https://api.consultasperu.com/api/v1/query`;
      const requestBody = {
        token: token,
        type_document: "dni",
        document_number: dni,
      };

      const response = await axios.post(apiUrl, requestBody, {
        headers: { 'Content-Type': 'application/json' },
      });
      const data = response.data.data;

      if (response.data?.success && data) {
        setValue('nombres', data.name || '');
        const surnames = data.surname ? data.surname.split(' ') : [];
        setValue('apellidoPaterno', surnames[0] || '');
        setValue('apellidoMaterno', surnames[1] || '');
        setValue('fechaNacimiento', data.date_of_birth || '');
        setValue('direccionDNI', data.address || '');
        setValue('regionDNI', data.department || '');
        setValue('provinciaDNI', data.province || '');
        setValue('distritoDNI', data.district || '');
        dataFound = true;
        toast.success('Datos Reniec encontrados (API Principal)', { description: `Nombre: ${data.name} ${data.surname}` });
      } else {
        toast.warning('DNI no encontrado en API Principal', { description: response.data.message || 'No se encontraron datos para el DNI proporcionado.' });
      }
    } catch (error: any) {
      console.error('Error al consultar Reniec (API Principal):', error);
      if (axios.isAxiosError(error) && error.response) {
        console.error('Axios Error Response Data (Primary API):', error.response.data);
      }
      toast.error('Error al consultar Reniec (API Principal)', { description: error.message || 'Hubo un problema al conectar con el servicio Reniec principal.' });
    }

    // --- 2. Attempt Secondary API Call (miapi.cloud) if primary failed to fill essential fields or no data found yet ---
    const fieldsToCheckForEmptiness = [
      'nombres', 'apellidoPaterno', 'apellidoMaterno', 'fechaNacimiento',
      'direccionDNI', 'regionDNI', 'provinciaDNI', 'distritoDNI'
    ];
    const anyEssentialFieldStillEmpty = fieldsToCheckForEmptiness.some(field => !watch(field as keyof SocioTitularFormValues));

    if (!dataFound || anyEssentialFieldStillEmpty) { // Only try secondary if primary failed or didn't fill essential fields
      try {
        const secondaryApiToken = import.meta.env.VITE_MIAPI_CLOUD_API_TOKEN;
        if (!secondaryApiToken) {
          throw new Error('VITE_MIAPI_CLOUD_API_TOKEN no está configurado en el archivo .env');
        }

        const secondaryApiUrl = `https://miapi.cloud/v1/dni/${dni}`;
        const secondaryResponse = await axios.get(secondaryApiUrl, {
          headers: {
            'Authorization': `Bearer ${secondaryApiToken}`,
          },
        });
        const secondaryData = secondaryResponse.data.datos;

        if (secondaryResponse.data?.success && secondaryData) {
          // Only fill fields that are currently empty
          if (!watch('nombres') && secondaryData.nombres) setValue('nombres', secondaryData.nombres);
          if (!watch('apellidoPaterno') && secondaryData.ape_paterno) setValue('apellidoPaterno', secondaryData.ape_paterno);
          if (!watch('apellidoMaterno') && secondaryData.ape_materno) setValue('apellidoMaterno', secondaryData.ape_materno);
          // fechaNacimiento is not available in miapi.cloud JSON, so it will remain empty if primary API didn't provide it.
          if (!watch('direccionDNI') && secondaryData.domiciliado?.direccion) setValue('direccionDNI', secondaryData.domiciliado.direccion);
          if (!watch('regionDNI') && secondaryData.domiciliado?.departamento) setValue('regionDNI', secondaryData.domiciliado.departamento);
          if (!watch('provinciaDNI') && secondaryData.domiciliado?.provincia) setValue('provinciaDNI', secondaryData.domiciliado.provincia);
          if (!watch('distritoDNI') && secondaryData.domiciliado?.distrito) setValue('distritoDNI', secondaryData.domiciliado.distrito);
          dataFound = true; // Mark as found if secondary API provided data
          toast.info('Datos complementados con API Secundaria', { description: 'Algunos campos vacíos fueron llenados.' });
        } else {
          toast.warning('DNI no encontrado en API Secundaria', { description: secondaryResponse.data.message || 'No se encontraron datos adicionales para el DNI.' });
        }
      } catch (error: any) {
        console.error('Error al consultar Reniec (API Secundaria):', error);
        if (axios.isAxiosError(error) && error.response) {
          console.error('Axios Error Response Data (Secondary API):', error.response.data);
        }
        toast.error('Error al consultar Reniec (API Secundaria)', { description: error.message || 'Hubo un problema al conectar con el servicio Reniec secundario.' });
      }
    }

    setIsReniecSearching(false);
    return dataFound;
  }, [setValue, watch]); // Dependencies for useCallback

  // MODIFIED: searchSocioByDni now orchestrates both local DB and Reniec API searches
  const searchSocioByDni = useCallback(async (dni: string) => {
    if (!dni || dni.length !== 8) {
      // Clear fields if DNI is invalid or empty
      setValue('nombres', '');
      setValue('apellidoPaterno', '');
      setValue('apellidoMaterno', '');
      setValue('fechaNacimiento', '');
      setValue('edad', null);
      setValue('celular', '');
      setValue('direccionDNI', '');
      setValue('regionDNI', '');
      setValue('provinciaDNI', '');
      setValue('distritoDNI', '');
      setValue('localidad', '');
      // No clear for isObservado/observacion here, as they are administrative fields
      return;
    }

    setIsDniSearching(true);

    // Clear all relevant fields initially to ensure a clean slate for population
    setValue('nombres', '');
    setValue('apellidoPaterno', '');
    setValue('apellidoMaterno', '');
    setValue('fechaNacimiento', '');
    setValue('edad', null);
    setValue('celular', '');
    setValue('direccionDNI', '');
    setValue('regionDNI', '');
    setValue('provinciaDNI', '');
    setValue('distritoDNI', '');
    // 'localidad' should not be cleared by API search, it's a manual field.

    let dataFoundInDb = false;
    let dataFoundInReniec = false;

    // --- 1. Search Local Database ---
    try {
      // Solo buscamos datos personales, no estado administrativo
      const { data, error } = await supabase
        .from('socio_titulares')
        .select('nombres, apellidoPaterno, apellidoMaterno, fechaNacimiento, edad, celular, direccionDNI, regionDNI, provinciaDNI, distritoDNI, localidad') 
        .eq('dni', dni)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 means "no rows found"
        console.error('Error searching socio by DNI in DB:', error.message);
        toast.error('Error al buscar DNI en la base de datos', { description: error.message });
      } else if (data) {
        setValue('nombres', data.nombres);
        setValue('apellidoPaterno', data.apellidoPaterno);
        setValue('apellidoMaterno', data.apellidoMaterno);
        setValue('fechaNacimiento', data.fechaNacimiento ? format(parseISO(data.fechaNacimiento), 'yyyy-MM-dd') : '');
        setValue('edad', data.edad);
        setValue('celular', data.celular);
        setValue('direccionDNI', data.direccionDNI);
        setValue('regionDNI', data.regionDNI);
        setValue('provinciaDNI', data.provinciaDNI);
        setValue('distritoDNI', data.distritoDNI);
        setValue('localidad', data.localidad);
        
        dataFoundInDb = true;
        toast.success('Socio encontrado en la base de datos', { description: `Nombre: ${data.nombres} ${data.apellidoPaterno}` });
      }
    } catch (dbError: any) {
      console.error('Unexpected error during DB search:', dbError);
      toast.error('Error inesperado al buscar en la base de datos', { description: dbError.message });
    }

    // --- 2. If not found in local DB, try Reniec APIs ---
    if (!dataFoundInDb) {
      dataFoundInReniec = await fetchReniecDataAndPopulate(dni);
    }

    if (!dataFoundInDb && !dataFoundInReniec) {
      toast.warning('DNI no encontrado', { description: 'No se encontró un socio con este DNI en la base de datos ni en Reniec.' });
    }

    setIsDniSearching(false);
  }, [setValue, fetchReniecDataAndPopulate]); // Add fetchReniecDataAndPopulate to dependencies


  useEffect(() => {
    const fetchSocio = async () => {
      if (socioId !== undefined) { // Check for undefined, not just truthiness
        // Ahora solo necesitamos isObservado y observacion, is_lote_medido se maneja aparte
        const { data, error } = await supabase
          .from('socio_titulares')
          .select('*, isObservado, observacion') 
          .eq('id', socioId)
          .single();

        if (error) {
          console.error('Error fetching socio:', error.message);
          toast.error('Error al cargar socio', { description: error.message });
        } else if (data) {
          reset({
            ...data,
            fechaNacimiento: data.fechaNacimiento ? format(parseISO(data.fechaNacimiento), 'yyyy-MM-dd') : '',
            situacionEconomica: data.situacionEconomica || undefined,
            mz: data.mz || '',
            lote: data.lote || '',
            regionVivienda: data.regionVivienda || '',
            provinciaVivienda: data.provinciaVivienda || '',
            distritoVivienda: data.distritoVivienda || '',
            localidad: data.localidad || '',
            direccionDNI: data.direccionDNI || '',
            regionDNI: data.regionDNI || '',
            provinciaDNI: data.provinciaDNI || '',
            distritoDNI: data.distritoDNI || '',
            edad: data.edad || null,
            
            // Cargar campos de observación
            isObservado: data.isObservado || false,
            observacion: data.observacion || '',
          });
        }
      }
    };
    fetchSocio();
  }, [socioId, reset]);

  const handleCloseConfirmationOnly = () => {
    setIsConfirmDialogOpen(false);
    setDataToConfirm(null);
    setIsConfirmingSubmission(false);
  };

  const onSubmit = async (values: SocioTitularFormValues, event?: React.BaseSyntheticEvent) => {
    event?.preventDefault();

    // Si isObservado es falso, limpiamos el campo de observacion antes de la validación final
    if (!values.isObservado) {
      setValue('observacion', null, { shouldValidate: true });
    }

    const result = await form.trigger();

    if (!result) {
      // If validation fails, show a toast and focus on the first error field
      toast.error('Error de validación', { description: 'Por favor, corrige los campos marcados.' });
      const firstErrorField = Object.keys(errors)[0] as keyof SocioTitularFormValues;
      if (firstErrorField) {
        form.setFocus(firstErrorField);
        // Switch tab if the error is in the other tab
        if (['regionVivienda', 'provinciaVivienda', 'distritoVivienda', 'direccionVivienda', 'mz', 'lote'].includes(firstErrorField)) {
          setActiveTab('address');
        } else {
          setActiveTab('personal');
        }
      }
      return;
    }

    setDataToConfirm(values);
    setIsConfirmDialogOpen(true);
  };

  const handleConfirmSubmit = async () => {
    if (!dataToConfirm) return;

    setIsConfirmingSubmission(true);
    try {
      // --- DNI Uniqueness Check ---
      const { data: existingSocios, error: dniCheckError } = await supabase
        .from('socio_titulares')
        .select('id')
        .eq('dni', dataToConfirm.dni);

      if (dniCheckError) {
        throw new Error(`Error al verificar DNI: ${dniCheckError.message}`);
      }

      const isDuplicateDni = existingSocios && existingSocios.length > 0 &&
                             (socioId === undefined || existingSocios[0].id !== socioId);

      if (isDuplicateDni) {
        toast.error('DNI Duplicado', { description: 'Ya existe un socio registrado con este DNI.' });
        form.setError('dni', { type: 'manual', message: 'Este DNI ya está registrado.' });
        form.setFocus('dni');
        setIsConfirmDialogOpen(false); // Close confirmation dialog
        setIsConfirmingSubmission(false);
        return; // Stop submission
      }
      // --- End DNI Uniqueness Check ---

      const dataToSave: Partial<SocioTitular> = {
        ...dataToConfirm,
        // Aseguramos que observacion sea null si isObservado es false
        observacion: dataToConfirm.isObservado ? dataToConfirm.observacion : null,
      };
      
      if (socioId !== undefined) { // Check for undefined
        const { error } = await supabase
          .from('socio_titulares')
          .update(dataToSave)
          .eq('id', socioId);

        if (error) throw error;
        toast.success('Socio actualizado', { description: 'El socio titular ha sido actualizado exitosamente.' });
        onSuccess();
        onClose();
      } else {
        const { error } = await supabase
          .from('socio_titulares')
          .insert(dataToSave);

        if (error) throw error;
        toast.success('Socio registrado', { description: 'El nuevo socio titular ha sido registrado exitosamente.' });

        reset({
          dni: '',
          nombres: '',
          apellidoPaterno: '',
          apellidoMaterno: '',
          fechaNacimiento: '',
          edad: null,
          celular: '',
          situacionEconomica: undefined,
          direccionDNI: '',
          regionDNI: '',
          provinciaDNI: '',
          distritoDNI: '',
          localidad: '',
          
          // Reset campos de observación
          isObservado: false,
          observacion: '',

          regionVivienda: '',
          provinciaVivienda: '',
          distritoVivienda: '',
          direccionVivienda: '',
          mz: '',
          lote: '',
        });
        handleCloseConfirmationOnly();
        setActiveTab('personal');
      }
    } catch (submitError: any) {
      console.error('Error al guardar el socio:', submitError.message);
      toast.error('Error al guardar socio', { description: submitError.message });
    } finally {
      setIsConfirmingSubmission(false);
    }
  };

  return (
    <FormProvider {...form}>
      <Form {...form}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="flex border-b border-border">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setActiveTab('personal')}
              className={cn(
                "py-2 px-4 text-lg font-semibold transition-colors duration-300",
                activeTab === 'personal' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              )}
            >
              Datos Personales
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setActiveTab('address')}
              className={cn(
                "py-2 px-4 text-lg font-semibold transition-colors duration-300",
                activeTab === 'address' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              )}
            >
              Datos de Vivienda
            </Button>
          </div>

          <div className="p-4 space-y-4 overflow-y-auto max-h-[70vh]">
            {activeTab === 'personal' && (
              <>
                <div className="flex flex-col sm:grid sm:grid-cols-4 sm:items-center gap-2 sm:gap-4">
                  <Label htmlFor="dni" className="sm:text-right text-textSecondary">
                    DNI
                  </Label>
                  <div className="col-span-full sm:col-span-3 relative flex items-center gap-2">
                    <Input
                      id="dni"
                      type="text"
                      {...register('dni')}
                      className="flex-grow rounded-lg border-border bg-background text-foreground focus:ring-primary focus:border-primary transition-all duration-300"
                      placeholder="Ej: 12345678"
                      // DNI input is read-only during any search
                      readOnly={isDniSearching || isReniecSearching}
                      // Triggers combined DB and Reniec search
                      onBlur={() => searchSocioByDni(watchedDni)}
                    />
                    {(isDniSearching || isReniecSearching) && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary" />
                    )}
                  </div>
                  {errors.dni && <p className="col-span-full sm:col-span-4 text-right text-error text-sm">{errors.dni?.message}</p>}
                </div>
                {renderInputField('nombres', 'Nombres', 'Ej: Juan Carlos', 'text', isReniecSearching)}
                {renderInputField('apellidoPaterno', 'Apellido Paterno', 'Ej: García', 'text', isReniecSearching)}
                {renderInputField('apellidoMaterno', 'Apellido Materno', 'Ej: Pérez', 'text', isReniecSearching)}
                <FormField
                  control={form.control}
                  name="fechaNacimiento"
                  render={({ field }) => (
                    <FormItem className="flex flex-col sm:grid sm:grid-cols-4 sm:items-center gap-2 sm:gap-4">
                      <FormLabel className="sm:text-right text-textSecondary">Fecha Nacimiento</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "col-span-full sm:col-span-3 w-full justify-start text-left font-normal rounded-lg border-border bg-background text-foreground focus:ring-primary focus:border-primary transition-all duration-300",
                                !field.value && "text-muted-foreground",
                                "hover:bg-success/10 hover:text-success"
                              )}
                              disabled={isReniecSearching}
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
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage className="col-span-full sm:col-span-4 text-right" />
                    </FormItem>
                  )}
                />
                {renderInputField('edad', 'Edad', 'Ej: 35', 'number', true)}

                {/* Localidad with auto-suggestion and new entry capability */}
                <FormField
                  control={form.control}
                  name="localidad"
                  render={({ field }) => (
                    <FormItem className="flex flex-col sm:grid sm:grid-cols-4 sm:items-center gap-2 sm:gap-4">
                      <FormLabel className="sm:text-right text-textSecondary">Localidad</FormLabel>
                      <Popover open={openLocalitiesPopover} onOpenChange={setOpenLocalitiesPopover}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={openLocalitiesPopover}
                              className="col-span-full sm:col-span-3 w-full justify-between rounded-lg border-border bg-background text-foreground focus:ring-primary focus:border-primary transition-all duration-300"
                              disabled={isReniecSearching || isLocalitiesLoading}
                            >
                              {field.value
                                ? field.value // Display the current value, whether selected or typed
                                : "Selecciona o escribe una localidad..."}
                              <Loader2 className={cn("ml-2 h-4 w-4 shrink-0 opacity-0", isLocalitiesLoading && "animate-spin opacity-100")} />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-card border-border rounded-xl shadow-lg">
                          <Command>
                            <CommandInput
                              placeholder="Buscar localidad..."
                              className="h-9"
                              value={field.value} // Bind CommandInput value to form field value
                              onValueChange={(search) => {
                                field.onChange(search); // Update form field value as user types
                              }}
                            />
                            <CommandList>
                              <CommandEmpty>No se encontró localidad.</CommandEmpty>
                              <CommandGroup>
                                {localitiesSuggestions
                                  .filter(loc => loc.toLowerCase().includes(watchedLocalidad.toLowerCase()))
                                  .map((loc) => (
                                    <CommandItem
                                      value={loc}
                                      key={loc}
                                      onSelect={(currentValue) => {
                                        field.onChange(currentValue); // Set the selected value
                                        setOpenLocalitiesPopover(false);
                                      }}
                                      className="cursor-pointer hover:bg-muted/50"
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          field.value === loc ? "opacity-100" : "opacity-0"
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
                      <FormMessage className="col-span-full sm:col-span-4 text-right" />
                    </FormItem>
                  )}
                />

                {renderTextareaField('direccionDNI', 'Dirección DNI', 'Ej: Av. Los Girasoles 123', isReniecSearching, isReniecSearching)}
                {renderInputField('regionDNI', 'Región DNI', 'Ej: Lima', 'text', isReniecSearching)}
                {renderInputField('provinciaDNI', 'Provincia DNI', 'Ej: Lima', 'text', isReniecSearching)}
                {renderInputField('distritoDNI', 'Distrito DNI', 'Ej: Miraflores', 'text', isReniecSearching)}
                {renderInputField('celular', 'Celular (Opcional)', 'Ej: 987654321', 'tel', isReniecSearching)}
                {renderRadioGroupField('situacionEconomica', 'Situación Económica', economicSituationOptions)}
                
                {/* --- SECCIÓN DE OBSERVACIÓN ADMINISTRATIVA (MOVIMIENTO) --- */}
                <div className="space-y-4 pt-6 border-t border-border mt-6">
                  <h3 className="text-xl font-semibold text-primary">Estado de Observación Administrativa</h3>
                  <FormField
                    control={control}
                    name="isObservado"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-xl border border-primary/50 p-4 shadow-lg bg-primary/10 transition-all duration-300">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            className="mt-1 h-5 w-5 border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="text-lg font-semibold text-primary">
                            Marcar como Socio Observado
                          </FormLabel>
                          <p className="text-sm text-textSecondary">
                            Active esta opción si hay alguna discrepancia o nota importante sobre el socio.
                          </p>
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />

                  {watchedIsObservado && (
                    <div className="mt-4 transition-all duration-300 ease-in-out">
                      <FormField
                        control={control}
                        name="observacion"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-textSecondary">Detalle de Observación</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Escribe aquí la razón de la observación..."
                                className="min-h-[100px] rounded-lg border-border bg-background text-foreground focus:ring-primary focus:border-primary"
                                {...field}
                                value={field.value || ''}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </div>
                {/* --- FIN SECCIÓN DE OBSERVACIÓN ADMINISTRATIVA --- */}
                
                <div className="flex justify-end mt-6">
                  <Button
                    type="button"
                    onClick={() => setActiveTab('address')}
                    className="rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/90 transition-all duration-300"
                  >
                    Siguiente: Datos de Vivienda
                  </Button>
                </div>
              </>
            )}

            {activeTab === 'address' && (
              <>
                <h3 className="text-xl font-bold text-primary mb-4 border-b border-border pb-2">
                  Ubicación de la Vivienda
                </h3>
                {renderTextareaField('direccionVivienda', 'Dirección (Vivienda) (Opcional)', 'Ej: Calle Las Flores 456')}
                {renderInputField('mz', 'MZ (Manzana) (Opcional)', 'Ej: A')}
                {renderInputField('lote', 'Lote (Opcional)', 'Ej: 15')}
                {renderInputField('regionVivienda', 'Región (Vivienda) (Opcional)', 'Ej: Lima')}
                {renderInputField('provinciaVivienda', 'Provincia (Vivienda) (Opcional)', 'Ej: Lima')}
                {renderInputField('distritoVivienda', 'Distrito (Vivienda) (Opcional)', 'Ej: San Juan de Lurigancho')}
              </>
            )}
          </div>

          <DialogFooter className="p-6 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-lg border-border hover:bg-muted/50 transition-all duration-300">
              Cancelar
            </Button>
            <Button type="submit" className="rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-300">
              {socioId !== undefined ? 'Guardar Cambios' : 'Registrar Socio Titular'}
            </Button>
          </DialogFooter>
        </form>
      </Form>

      <ConfirmationDialog
        isOpen={isConfirmDialogOpen}
        onClose={handleCloseConfirmationOnly}
        onConfirm={handleConfirmSubmit}
        title={socioId !== undefined ? 'Confirmar Edición de Socio' : 'Confirmar Registro de Socio'}
        description="Por favor, revisa los detalles del socio antes de confirmar."
        data={dataToConfirm || {}}
        confirmButtonText={socioId !== undefined ? 'Confirmar Actualización' : 'Confirmar Registro'}
        isConfirming={isConfirmingSubmission}
      />
    </FormProvider>
  );
}

export default SocioTitularRegistrationForm;
