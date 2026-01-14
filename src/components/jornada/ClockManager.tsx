import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Colaborador, Jornada, getJornadaByDate, clockIn, startLunch, endLunch, clockOut } from '@/lib/api/jornadaApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Play, Coffee, Pause, LogOut, CheckCircle, AlertCircle } from 'lucide-react';
import { format, parseISO, differenceInMinutes } from 'date-fns';
import { useToast } from "@/components/ui/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ClockManagerProps {
  colaborador: Colaborador;
  bypassTimeRestrictions?: boolean;
}

const ClockManager: React.FC<ClockManagerProps> = ({ colaborador, bypassTimeRestrictions = false }) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const intervalId = setInterval(() => setNow(new Date()), 30 * 1000);
    return () => clearInterval(intervalId);
  }, []);

  const { data: jornada, isLoading, refetch } = useQuery({
    queryKey: ['jornadaHoy', colaborador.id],
    queryFn: () => getJornadaByDate(colaborador.id),
    enabled: !!colaborador.id,
  });

  useEffect(() => {
    refetch();
  }, [colaborador.id, refetch]);

  const mutationOptions = {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jornadaHoy', colaborador.id] });
      queryClient.invalidateQueries({ queryKey: ['adminJornadas'] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error en la operación",
        description: error.message,
      });
    },
  };

  const clockInMutation = useMutation({ mutationFn: () => clockIn(colaborador.id), ...mutationOptions,
    onSuccess: () => {
      mutationOptions.onSuccess();
      toast({ title: "Jornada Iniciada", description: `Se ha iniciado la jornada para ${colaborador.name}.` });
    }
  });
  const startLunchMutation = useMutation({ mutationFn: () => startLunch(jornada!.id), ...mutationOptions,
    onSuccess: () => {
      mutationOptions.onSuccess();
      toast({ title: "Descanso Iniciado", description: "¡Buen provecho!" });
    }
  });
  const endLunchMutation = useMutation({ mutationFn: () => endLunch(jornada!.id), ...mutationOptions,
    onSuccess: () => {
      mutationOptions.onSuccess();
      toast({ title: "Descanso Finalizado", description: "¡De vuelta al trabajo!" });
    }
  });
  const clockOutMutation = useMutation({ mutationFn: () => clockOut(jornada!.id), ...mutationOptions,
    onSuccess: () => {
      mutationOptions.onSuccess();
      toast({ title: "Jornada Finalizada", description: `Se ha finalizado la jornada para ${colaborador.name}.` });
    }
  });

  const renderStatus = (jornada: Jornada | null | undefined) => {
    if (!jornada) return { text: 'Fuera de servicio', color: 'text-gray-500' };
    if (jornada.hora_fin_jornada) return { text: 'Jornada finalizada', color: 'text-green-500' };
    if (jornada.hora_fin_almuerzo) return { text: 'Trabajando', color: 'text-blue-500' };
    if (jornada.hora_inicio_almuerzo) return { text: 'En almuerzo', color: 'text-yellow-500' };
    if (jornada.hora_inicio_jornada) return { text: 'Trabajando', color: 'text-blue-500' };
    return { text: 'Fuera de servicio', color: 'text-gray-500' };
  };

  const status = renderStatus(jornada);

  const renderButtons = (jornada: Jornada | null | undefined) => {
    const isMutating = clockInMutation.isPending || startLunchMutation.isPending || endLunchMutation.isPending || clockOutMutation.isPending;

    // --- Business Rules ---
    const canClockIn = bypassTimeRestrictions || (now.getHours() > 9 || (now.getHours() === 9 && now.getMinutes() >= 30));
    const canStartLunch = bypassTimeRestrictions || (now.getHours() >= 13 && now.getHours() < 15); // 1:00 PM to 2:59 PM
    // ----------------------

    const renderButtonWithTooltip = (
      button: React.ReactElement,
      tooltipContent: string,
      isDisabled: boolean
    ) => {
      if (!isDisabled) return button;
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0} className="w-full block">{button}</span>
            </TooltipTrigger>
            <TooltipContent>
              <p className="flex items-center"><AlertCircle className="h-4 w-4 mr-2" /> {tooltipContent}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    };

    if (!jornada) {
      const clockInButton = <Button onClick={() => clockInMutation.mutate()} disabled={isMutating || !canClockIn} className="w-full bg-green-500 hover:bg-green-600"><Play className="mr-2 h-4 w-4" /> Iniciar Jornada</Button>;
      return renderButtonWithTooltip(clockInButton, "Solo se puede iniciar jornada a partir de las 9:30 AM.", !canClockIn);
    }
    if (!jornada.hora_inicio_almuerzo) {
      const startLunchButton = <Button onClick={() => startLunchMutation.mutate()} disabled={isMutating || !canStartLunch} className="w-full bg-yellow-500 hover:bg-yellow-600"><Coffee className="mr-2 h-4 w-4" /> Iniciar Almuerzo</Button>;
      return (
        <div className="flex gap-2">
          {renderButtonWithTooltip(startLunchButton, "El almuerzo solo puede iniciar entre la 1:00 PM y 3:00 PM.", !canStartLunch)}
          <Button onClick={() => clockOutMutation.mutate()} disabled={isMutating} className="w-full bg-red-500 hover:bg-red-600"><LogOut className="mr-2 h-4 w-4" /> Finalizar Jornada</Button>
        </div>
      );
    }
    if (!jornada.hora_fin_almuerzo) {
      const lunchStartTime = parseISO(jornada.hora_inicio_almuerzo!);
      const minutesOnLunch = differenceInMinutes(now, lunchStartTime);
      const isLunchBreakTooShort = minutesOnLunch < 30;

      const endLunchButton = <Button onClick={() => endLunchMutation.mutate()} disabled={isMutating || isLunchBreakTooShort} className="w-full bg-blue-500 hover:bg-blue-600"><Pause className="mr-2 h-4 w-4" /> Finalizar Almuerzo</Button>;
      return renderButtonWithTooltip(endLunchButton, `El descanso debe durar al menos 30 minutos. Podrás finalizar en ${30 - minutesOnLunch} min.`, isLunchBreakTooShort);
    }
    if (!jornada.hora_fin_jornada) {
      return <Button onClick={() => clockOutMutation.mutate()} disabled={isMutating} className="w-full bg-red-500 hover:bg-red-600"><LogOut className="mr-2 h-4 w-4" /> Finalizar Jornada</Button>;
    }
    return <div className="text-center text-green-600 font-semibold flex items-center justify-center"><CheckCircle className="mr-2 h-5 w-5" /> Jornada completada.</div>;
  };

  const formatTime = (isoString: string | null) => {
    if (!isoString) return '--:--';
    return format(parseISO(isoString), 'HH:mm:ss');
  };



  if (isLoading) {
    return <div className="flex justify-center items-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <Card className="w-full max-w-md mx-auto shadow-lg">
      <CardHeader>
        <CardTitle>Registro de: {colaborador.name} {colaborador.apellidos}</CardTitle>
        <CardDescription>Estado actual: <span className={`font-bold ${status.color}`}>{status.text}</span></CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4 text-sm">
        <div className="font-semibold">Inicio Jornada:</div><div>{formatTime(jornada?.hora_inicio_jornada ?? null)}</div>
        <div className="font-semibold">Inicio Almuerzo:</div><div>{formatTime(jornada?.hora_inicio_almuerzo ?? null)}</div>
        <div className="font-semibold">Fin Almuerzo:</div><div>{formatTime(jornada?.hora_fin_almuerzo ?? null)}</div>
        <div className="font-semibold">Fin Jornada:</div><div>{formatTime(jornada?.hora_fin_jornada ?? null)}</div>
      </CardContent>
      <CardFooter>
        {renderButtons(jornada)}
      </CardFooter>
    </Card>
  );
};

export default ClockManager;
