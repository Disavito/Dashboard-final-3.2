import { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CardHeader, CardTitle, CardDescription, Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Calendar as CalendarIcon, FileDown, Loader2, Terminal, Send, CheckCircle, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { fetchDailySummaries, createDailySummary, sendSummaryToSunat, saveDailySummaryResult } from '@/lib/api/invoicingApi';
import { DailySummary, ResumenDiarioSchema, ResumenDiarioFormValues, SummaryData } from '@/lib/types/invoicing';
import { useToast } from '@/components/ui/use-toast';
import { Label } from '@/components/ui/label';
import ResumenDiarioResult from '@/components/invoicing/ResumenDiarioResult';
import { DataTable } from '@/components/ui-custom/DataTable';
import { getColumns } from '@/components/invoicing/columns';
import { Skeleton } from '@/components/ui/skeleton';

function ResumenDiarioPage() {
  const [allSummaries, setAllSummaries] = useState<DailySummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State for summary creation
  const [isCreating, setIsCreating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [finalMessage, setFinalMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  
  const { toast } = useToast();

  const form = useForm<ResumenDiarioFormValues>({
    resolver: zodResolver(ResumenDiarioSchema),
    defaultValues: {
      fecha_resumen: new Date().toISOString().split('T')[0],
    },
  });

  const loadSummaries = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchDailySummaries();
      setAllSummaries(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Ocurrió un error desconocido al cargar los resúmenes.';
      setError(errorMessage);
      toast({ variant: "destructive", title: "Error al Cargar", description: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSummaries();
  }, []);

  const handleCreateSummary = async (values: ResumenDiarioFormValues) => {
    setIsCreating(true);
    setSummaryData(null);
    setFinalMessage(null);
    try {
      const response = await createDailySummary(values.fecha_resumen);
      if (response.success) {
        setSummaryData(response.data);
        toast({
          title: "Resumen Generado",
          description: "El resumen diario ha sido creado. Revise y proceda a enviarlo.",
          variant: "default",
        });
      } else {
        throw new Error(response.message);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error desconocido.';
      toast({
        title: "Error al Generar Resumen",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleSendSummary = async () => {
    if (!summaryData) return;
    setIsSending(true);
    setFinalMessage(null);
    try {
      const response = await sendSummaryToSunat(summaryData.id);
      if (response.success) {
        await saveDailySummaryResult(response.data);
        toast({
          title: "Éxito",
          description: "Resumen enviado a SUNAT y registrado en la base de datos.",
          className: "bg-success text-white",
        });
        setFinalMessage({ type: 'success', message: `Resumen enviado con éxito. Ticket: ${response.data.ticket}` });
        setSummaryData(null);
        await loadSummaries(); // Refresh the list
      } else {
        throw new Error(response.message);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error desconocido.';
      toast({
        title: "Error al Enviar a SUNAT",
        description: errorMessage,
        variant: "destructive",
      });
      setFinalMessage({ type: 'error', message: `Error al enviar a SUNAT: ${errorMessage}` });
    } finally {
      setIsSending(false);
    }
  };

  const handleStatusUpdate = useCallback((summaryId: number, newStatus: string) => {
    setAllSummaries(currentSummaries =>
      currentSummaries.map(s =>
        s.id === summaryId ? { ...s, estado_sunat: newStatus } : s
      )
    );
  }, []);

  const columns = useMemo(() => getColumns(handleStatusUpdate), [handleStatusUpdate]);

  return (
    <div className="space-y-6 animate-fade-in">
      <CardHeader className="p-0">
        <CardTitle className="text-2xl font-bold text-primary">Resúmenes Diarios y Bajas</CardTitle>
        <CardDescription className="text-textSecondary">
          Genere, envíe y consulte el estado de los resúmenes diarios de boletas y comunicaciones de baja.
        </CardDescription>
      </CardHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleCreateSummary)} className="space-y-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 border border-border rounded-lg bg-card/50">
            <FormField
              control={form.control}
              name="fecha_resumen"
              render={({ field }) => (
                <FormItem className="flex flex-col gap-1.5">
                  <Label className="text-sm font-medium text-textSecondary">
                    Fecha para Generar Resumen
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-[280px] justify-start text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value ? format(new Date(field.value + 'T00:00:00'), "PPP", { locale: es }) : <span>Seleccione una fecha</span>}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-card border-border">
                      <Calendar
                        mode="single"
                        selected={field.value ? new Date(field.value + 'T00:00:00') : undefined}
                        onSelect={(date) => field.onChange(date ? format(date, 'yyyy-MM-dd') : '')}
                        initialFocus
                        locale={es}
                        toDate={new Date()}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isCreating || !!summaryData} className="self-end md:self-center">
              {isCreating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="mr-2 h-4 w-4" />
              )}
              Generar Resumen del Día
            </Button>
          </div>
        </form>
      </Form>

      {summaryData && (
        <Card className="mt-6 border-primary shadow-lg animate-fade-in">
          <CardContent className="pt-6">
            <ResumenDiarioResult data={summaryData} />
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button onClick={handleSendSummary} disabled={isSending} variant="default" className="bg-success hover:bg-success/90">
              {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Enviar Resumen a SUNAT
            </Button>
          </CardFooter>
        </Card>
      )}

      {finalMessage && (
        <Alert variant={finalMessage.type === 'success' ? 'default' : 'destructive'} className={`mt-6 ${finalMessage.type === 'success' ? 'bg-success/10 border-success' : ''}`}>
          {finalMessage.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          <AlertTitle>{finalMessage.type === 'success' ? 'Operación Completada' : 'Ocurrió un Problema'}</AlertTitle>
          <AlertDescription>
            {finalMessage.message}
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        <h3 className="text-xl font-semibold tracking-tight">Historial de Resúmenes Enviados</h3>
        {error && !isLoading && (
          <Alert variant="destructive" className="bg-error/10 border-error/30 text-error-foreground">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Error al Cargar Resúmenes</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {isLoading ? (
           <div className="space-y-4">
             <Skeleton className="h-12 w-full rounded-lg" />
             <Skeleton className="h-48 w-full rounded-xl" />
             <div className="flex justify-end space-x-2">
               <Skeleton className="h-9 w-24 rounded-lg" />
               <Skeleton className="h-9 w-24 rounded-lg" />
             </div>
           </div>
        ) : (
          <DataTable columns={columns} data={allSummaries} />
        )}
      </div>
    </div>
  );
}

export default ResumenDiarioPage;
