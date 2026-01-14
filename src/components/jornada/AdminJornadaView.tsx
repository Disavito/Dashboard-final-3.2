import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { getAdminJornadas, getAllColaboradores, Jornada, Colaborador, calculateWorkedMinutesForJornada } from '@/lib/api/jornadaApi';
import { Calendar as CalendarIcon, Loader2, AlertCircle, Users, CalendarDays, GanttChartSquare, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn, formatCurrency } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import EditJornadaModal from './EditJornadaModal';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'; // Importar Card components

type JornadaWithColaborador = Jornada & { colaboradores: Colaborador | null };

const STANDARD_MONTHLY_HOURS = 160; // Default standard hours if manual not provided

const AdminJornadaView: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [filterType, setFilterType] = useState<'day' | 'week' | 'month'>('day');
  const [selectedColaboradorId, setSelectedColaboradorId] = useState<string>('todos');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedJornada, setSelectedJornada] = useState<JornadaWithColaborador | null>(null);

  // Estado para salarios base manuales por colaborador
  const [manualSalaries, setManualSalaries] = useState<Map<string, number>>(new Map());
  // Estado para horas mensuales manuales por colaborador y mes (en minutos)
  // Estas son las HORAS ESPERADAS/ESTÁNDAR para el mes, no las trabajadas.
  const [manualMonthlyWorkedMinutes, setManualMonthlyWorkedMinutes] = useState<Map<string, Map<string, number>>>(new Map());

  const { startDate, endDate } = useMemo(() => {
    const start =
      filterType === 'week'
        ? startOfWeek(selectedDate, { weekStartsOn: 1 })
        : filterType === 'month'
        ? startOfMonth(selectedDate)
        : selectedDate;
    const end =
      filterType === 'week'
        ? endOfWeek(selectedDate, { weekStartsOn: 1 })
        : filterType === 'month'
        ? endOfMonth(selectedDate)
        : selectedDate;
    return {
      startDate: format(start, 'yyyy-MM-dd'),
      endDate: format(end, 'yyyy-MM-dd'),
    };
  }, [selectedDate, filterType]);

  const currentMonthYear = useMemo(() => format(selectedDate, 'yyyy-MM'), [selectedDate]);

  const { data: colaboradores, isLoading: isLoadingColaboradores } = useQuery({
    queryKey: ['allColaboradores'],
    queryFn: getAllColaboradores,
  });

  const { data: jornadas, isLoading, isError, error } = useQuery({
    queryKey: ['adminJornadas', startDate, endDate, selectedColaboradorId],
    queryFn: () => getAdminJornadas({ startDate, endDate, colaboradorId: selectedColaboradorId }),
  });

  const handleEditClick = (jornada: JornadaWithColaborador) => {
    setSelectedJornada(jornada);
    setIsModalOpen(true);
  };

  const handleManualSalaryChange = (colaboradorId: string, value: string) => {
    const salary = parseFloat(value);
    setManualSalaries(prev => {
      const newMap = new Map(prev);
      if (!isNaN(salary) && value !== '') {
        newMap.set(colaboradorId, salary);
      } else {
        newMap.delete(colaboradorId);
      }
      return newMap;
    });
  };

  const handleManualMonthlyHoursChange = (colaboradorId: string, monthYear: string, value: string) => {
    const hours = parseFloat(value);
    const minutes = hours * 60; // Convert hours to minutes
    setManualMonthlyWorkedMinutes(prev => {
      const newMap = new Map(prev);
      const collaboratorMonths = new Map(newMap.get(colaboradorId) || new Map());
      if (!isNaN(minutes) && value !== '') {
        collaboratorMonths.set(monthYear, minutes);
      } else {
        collaboratorMonths.delete(monthYear);
      }
      newMap.set(colaboradorId, collaboratorMonths);
      return newMap;
    });
  };

  const getStatus = (jornada: JornadaWithColaborador): { text: string; variant: "default" | "secondary" | "destructive" | "outline" } => {
    if (jornada.hora_fin_jornada) return { text: 'Finalizada', variant: 'default' };
    if (jornada.hora_fin_almuerzo) return { text: 'Trabajando', variant: 'secondary' };
    if (jornada.hora_inicio_almuerzo) return { text: 'En Almuerzo', variant: 'outline' };
    if (jornada.hora_inicio_jornada) return { text: 'Trabajando', variant: 'secondary' };
    return { text: 'Ausente', variant: 'destructive' };
  };

  const formatTime = (isoString: string | null) => {
    if (!isoString) return '--:--';
    return format(parseISO(isoString), 'HH:mm');
  };

  const formatMinutesToHours = (totalMinutes: number): string => {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
  };

  const calculateWorkedHours = (jornada: Jornada): string => {
    const totalMinutes = calculateWorkedMinutesForJornada(jornada);
    return formatMinutesToHours(totalMinutes);
  };

  const calculateMonthlySalary = (colaboradorId: string, actualWorkedMinutes: number, baseSalary: number | undefined, monthYear: string): string => {
    if (baseSalary === undefined || baseSalary <= 0) {
      return formatCurrency(0);
    }

    // Obtener las horas mensuales manuales (esperadas) para el cálculo del costo por hora
    const manualExpectedMonthlyMinutes = manualMonthlyWorkedMinutes.get(colaboradorId)?.get(monthYear);

    // Determinar el divisor para la tarifa por hora: horas manuales esperadas o estándar
    const divisorMinutesForHourlyRate =
      manualExpectedMonthlyMinutes !== undefined && manualExpectedMonthlyMinutes > 0
        ? manualExpectedMonthlyMinutes
        : STANDARD_MONTHLY_HOURS * 60; // Usar horas estándar si no se proporcionan manuales

    // Calcular la tarifa por hora
    const hourlyRate = baseSalary / (divisorMinutesForHourlyRate / 60); // Dividir salario base por horas esperadas (en horas)

    // Calcular el salario basado en las horas reales trabajadas
    const calculatedSalary = hourlyRate * (actualWorkedMinutes / 60); // Multiplicar tarifa por hora por horas reales trabajadas (en horas)

    return formatCurrency(calculatedSalary);
  };

  const renderDateRange = () => {
    if (filterType === 'day') return format(selectedDate, "PPP", { locale: es });
    if (filterType === 'week') return `Semana del ${format(parseISO(startDate), "d 'de' LLL", { locale: es })} al ${format(parseISO(endDate), "d 'de' LLL, yyyy", { locale: es })}`;
    if (filterType === 'month') return format(selectedDate, "LLLL yyyy", { locale: es });
    return 'Elige una fecha';
  };

  const monthlySummary = useMemo(() => {
    if (filterType !== 'month' || !jornadas || !colaboradores) return [];

    const summary = new Map<string, { colaborador: Colaborador; totalMinutes: number; }>();

    // Initialize summary for all collaborators or just the selected one
    const collaboratorsToSummarize = selectedColaboradorId === 'todos'
      ? colaboradores
      : colaboradores.filter(col => col.id === selectedColaboradorId);

    collaboratorsToSummarize.forEach(col => {
      summary.set(col.id, { colaborador: col, totalMinutes: 0 });
    });

    jornadas.forEach(jornada => {
      if (jornada.colaboradores) {
        const currentSummary = summary.get(jornada.colaborador_id);
        if (currentSummary) {
          currentSummary.totalMinutes += calculateWorkedMinutesForJornada(jornada);
          summary.set(jornada.colaborador_id, currentSummary);
        }
      }
    });
    return Array.from(summary.values());
  }, [jornadas, colaboradores, filterType, selectedColaboradorId]);


  const selectedColaborador = useMemo(() => {
    return colaboradores?.find(c => c.id === selectedColaboradorId);
  }, [colaboradores, selectedColaboradorId]);

  const individualMonthlySummary = useMemo(() => {
    if (filterType === 'month' && selectedColaboradorId !== 'todos' && monthlySummary.length > 0) {
      return monthlySummary[0]; // Should only be one entry for the selected collaborator
    }
    return null;
  }, [filterType, selectedColaboradorId, monthlySummary]);


  return (
    <>
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg bg-card">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-muted-foreground">Colaborador</label>
            <Select
              value={selectedColaboradorId}
              onValueChange={setSelectedColaboradorId}
              disabled={isLoadingColaboradores}
            >
              <SelectTrigger className="w-full">
                <Users className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Seleccionar colaborador" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los colaboradores</SelectItem>
                {colaboradores?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} {c.apellidos}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-muted-foreground">Fecha de Referencia</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn("w-full justify-start text-left font-normal")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  <span>{renderDateRange()}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(d) => setSelectedDate(d || new Date())}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-muted-foreground">Agrupar por</label>
            <ToggleGroup
              type="single"
              value={filterType}
              onValueChange={(value) => {
                if (value) setFilterType(value as 'day' | 'week' | 'month');
              }}
              className="w-full grid grid-cols-3"
            >
              <ToggleGroupItem value="day" aria-label="Ver por día">
                <CalendarDays className="h-4 w-4 mr-2" /> Día
              </ToggleGroupItem>
              <ToggleGroupItem value="week" aria-label="Ver por semana">
                <GanttChartSquare className="h-4 w-4 mr-2" /> Semana
              </ToggleGroupItem>
              <ToggleGroupItem value="month" aria-label="Ver por mes">
                <CalendarIcon className="h-4 w-4 mr-2" /> Mes
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2">Cargando registros...</p>
          </div>
        )}

        {isError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error instanceof Error ? error.message : 'Ocurrió un error desconocido'}</AlertDescription>
          </Alert>
        )}

        {/* Sección de Resumen Mensual (aparece solo si filterType es 'month') */}
        {!isLoading && !isError && filterType === 'month' && (
          <>
            {/* Resumen para un colaborador individual (Card existente) */}
            {selectedColaboradorId !== 'todos' && individualMonthlySummary && (
              <Card className="p-4 border rounded-lg bg-card">
                <CardHeader>
                  <CardTitle>Resumen Mensual para {selectedColaborador?.name} {selectedColaborador?.apellidos}</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Display calculated hours */}
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-muted-foreground">Horas Trabajadas Reales del Mes ({format(selectedDate, "LLLL yyyy", { locale: es })})</label>
                    <p className="text-lg font-semibold">
                      {formatMinutesToHours(individualMonthlySummary.totalMinutes)}
                    </p>
                  </div>

                  {/* Manual Monthly Hours Input */}
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-muted-foreground">Horas Mensuales Esperadas (para costo/hora)</label>
                    <Input
                      type="number"
                      value={
                        (() => {
                          const collaboratorMonthlyHours = manualMonthlyWorkedMinutes.get(selectedColaboradorId);
                          const monthlyHoursValue = collaboratorMonthlyHours?.get(currentMonthYear);
                          return monthlyHoursValue !== undefined
                            ? (monthlyHoursValue / 60).toString()
                            : '';
                        })()
                      }
                      onChange={(e) => handleManualMonthlyHoursChange(selectedColaboradorId, currentMonthYear, e.target.value)}
                      className="w-full text-right bg-background border-border text-foreground"
                      placeholder={STANDARD_MONTHLY_HOURS.toString()} // Placeholder for standard hours
                    />
                  </div>

                  {/* Manual Base Salary Input */}
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-muted-foreground">Salario Base Manual</label>
                    <Input
                      type="number"
                      value={manualSalaries.get(selectedColaboradorId)?.toString() || ''}
                      onChange={(e) => handleManualSalaryChange(selectedColaboradorId, e.target.value)}
                      className="w-full text-right bg-background border-border text-foreground"
                      placeholder="0.00"
                    />
                  </div>

                  {/* Calculated Salary Display */}
                  <div className="flex flex-col gap-2 md:col-span-3">
                    <label className="text-sm font-medium text-muted-foreground">Salario Calculado para el Mes</label>
                    <p className="text-2xl font-bold text-primary">
                      {calculateMonthlySalary(
                        selectedColaboradorId,
                        individualMonthlySummary.totalMinutes, // Horas reales trabajadas
                        manualSalaries.get(selectedColaboradorId),
                        currentMonthYear
                      )}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Nueva tabla de resumen para TODOS los colaboradores (cuando filterType es 'month' y selectedColaboradorId es 'todos') */}
            {selectedColaboradorId === 'todos' && monthlySummary.length > 0 && (
              <Card className="p-4 border rounded-lg bg-card">
                <CardHeader>
                  <CardTitle>Resumen Mensual General ({format(selectedDate, "LLLL yyyy", { locale: es })})</CardTitle>
                </CardHeader>
                <CardContent className="p-0"> {/* Eliminar padding para que la tabla interna maneje el suyo */}
                  <div className="rounded-xl border border-border overflow-hidden shadow-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Colaborador</TableHead>
                          <TableHead className="text-right">Horas Trabajadas Reales</TableHead>
                          <TableHead className="text-right">Horas Esperadas (para costo/hora)</TableHead>
                          <TableHead className="text-right">Salario Base (Manual)</TableHead>
                          <TableHead className="text-right">Salario Calculado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {monthlySummary.map(({ colaborador, totalMinutes }) => (
                          <TableRow key={colaborador.id}>
                            <TableCell className="font-medium">{colaborador.name} {colaborador.apellidos}</TableCell>
                            <TableCell className="text-right font-mono">{formatMinutesToHours(totalMinutes)}</TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                value={
                                  (() => {
                                    const collaboratorMonthlyHours = manualMonthlyWorkedMinutes.get(colaborador.id);
                                    const monthlyHoursValue = collaboratorMonthlyHours?.get(currentMonthYear);
                                    return monthlyHoursValue !== undefined
                                      ? (monthlyHoursValue / 60).toString()
                                      : '';
                                  })()
                                }
                                onChange={(e) => handleManualMonthlyHoursChange(colaborador.id, currentMonthYear, e.target.value)}
                                className="w-32 text-right bg-background border-border text-foreground"
                                placeholder={STANDARD_MONTHLY_HOURS.toString()}
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                value={manualSalaries.get(colaborador.id)?.toString() || ''}
                                onChange={(e) => handleManualSalaryChange(colaborador.id, e.target.value)}
                                className="w-32 text-right bg-background border-border text-foreground"
                                placeholder="0.00"
                              />
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {calculateMonthlySalary(colaborador.id, totalMinutes, manualSalaries.get(colaborador.id), currentMonthYear)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
            {/* Mensaje de no resumen para "Todos" si no hay datos */}
            {selectedColaboradorId === 'todos' && monthlySummary.length === 0 && (
              <Alert variant="default" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Sin Resumen Mensual</AlertTitle>
                <AlertDescription>No se encontraron datos de jornada para el mes seleccionado para ningún colaborador.</AlertDescription>
              </Alert>
            )}
          </>
        )}

        {/* Tabla Principal de Registros Diarios (siempre visible) */}
        {!isLoading && !isError && (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-center">Inicio Jornada</TableHead>
                  <TableHead className="text-center">Inicio Almuerzo</TableHead>
                  <TableHead className="text-center">Fin Almuerzo</TableHead>
                  <TableHead className="text-center">Fin Jornada</TableHead>
                  <TableHead className="text-right">Horas Trab.</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jornadas && jornadas.length > 0 ? (
                  jornadas.map((jornada) => (
                    <TableRow key={jornada.id}>
                      <TableCell className="font-medium">{jornada.colaboradores?.name} {jornada.colaboradores?.apellidos}</TableCell>
                      <TableCell>{format(parseISO(jornada.fecha), "EEEE, PPP", { locale: es })}</TableCell> {/* CAMBIO AQUÍ */}
                      <TableCell><Badge variant={getStatus(jornada).variant}>{getStatus(jornada).text}</Badge></TableCell>
                      <TableCell className="text-center">{formatTime(jornada.hora_inicio_jornada)}</TableCell>
                      <TableCell className="text-center">{formatTime(jornada.hora_inicio_almuerzo)}</TableCell>
                      <TableCell className="text-center">{formatTime(jornada.hora_fin_almuerzo)}</TableCell>
                      <TableCell className="text-center">{formatTime(jornada.hora_fin_jornada)}</TableCell>
                      <TableCell className="text-right font-mono">{calculateWorkedHours(jornada)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleEditClick(jornada)}>
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Editar Jornada</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center">
                      No se encontraron registros para los filtros seleccionados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
      {selectedJornada && (
        <EditJornadaModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          jornada={selectedJornada}
          onSuccess={() => {
            setIsModalOpen(false);
          }}
        />
      )}
    </>
  );
};

export default AdminJornadaView;
