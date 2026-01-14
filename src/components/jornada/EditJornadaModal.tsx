import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO, setHours, setMinutes, setSeconds } from 'date-fns';
import { es } from 'date-fns/locale'; // Importar el locale aquí
import { Jornada, Colaborador, adminUpdateJornada } from '@/lib/api/jornadaApi';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface EditJornadaModalProps {
  isOpen: boolean;
  onClose: () => void;
  jornada: Jornada & { colaboradores: Colaborador | null };
  onSuccess: () => void;
}

type TimeState = {
  inicioJornada: string;
  inicioAlmuerzo: string;
  finAlmuerzo: string;
  finJornada: string;
};

const EditJornadaModal: React.FC<EditJornadaModalProps> = ({ isOpen, onClose, jornada, onSuccess }) => {
  const queryClient = useQueryClient();
  const [times, setTimes] = useState<TimeState>({
    inicioJornada: '',
    inicioAlmuerzo: '',
    finAlmuerzo: '',
    finJornada: '',
  });

  useEffect(() => {
    if (jornada) {
      const formatToTimeInput = (isoString: string | null) => 
        isoString ? format(parseISO(isoString), 'HH:mm') : '';
      
      setTimes({
        inicioJornada: formatToTimeInput(jornada.hora_inicio_jornada),
        inicioAlmuerzo: formatToTimeInput(jornada.hora_inicio_almuerzo),
        finAlmuerzo: formatToTimeInput(jornada.hora_fin_almuerzo),
        finJornada: formatToTimeInput(jornada.hora_fin_jornada),
      });
    }
  }, [jornada]);

  const mutation = useMutation({
    mutationFn: (updatedTimes: Parameters<typeof adminUpdateJornada>[1]) => 
      adminUpdateJornada(jornada.id, updatedTimes),
    onSuccess: () => {
      toast.success('Registro de jornada actualizado correctamente.');
      queryClient.invalidateQueries({ queryKey: ['adminJornadas'] });
      onSuccess();
    },
    onError: (error) => {
      toast.error(`Error al actualizar: ${error.message}`);
    },
  });

  const handleTimeChange = (field: keyof TimeState, value: string) => {
    setTimes(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    const jornadaDate = parseISO(jornada.fecha);

    const toISOString = (time: string): string | null => {
      if (!time) return null;
      const [hours, minutes] = time.split(':').map(Number);
      let date = setHours(jornadaDate, hours);
      date = setMinutes(date, minutes);
      date = setSeconds(date, 0);
      return date.toISOString();
    };

    const updatedData = {
      hora_inicio_jornada: toISOString(times.inicioJornada),
      hora_inicio_almuerzo: toISOString(times.inicioAlmuerzo),
      hora_fin_almuerzo: toISOString(times.finAlmuerzo),
      hora_fin_jornada: toISOString(times.finJornada),
    };
    
    mutation.mutate(updatedData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar Registro de Jornada</DialogTitle>
          <DialogDescription>
            Ajusta los horarios para {jornada.colaboradores?.name} {jornada.colaboradores?.apellidos} del día {format(parseISO(jornada.fecha), 'PPP', { locale: es })}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="inicioJornada" className="text-right">Inicio Jornada</Label>
            <Input id="inicioJornada" type="time" value={times.inicioJornada} onChange={(e) => handleTimeChange('inicioJornada', e.target.value)} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="inicioAlmuerzo" className="text-right">Inicio Almuerzo</Label>
            <Input id="inicioAlmuerzo" type="time" value={times.inicioAlmuerzo} onChange={(e) => handleTimeChange('inicioAlmuerzo', e.target.value)} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="finAlmuerzo" className="text-right">Fin Almuerzo</Label>
            <Input id="finAlmuerzo" type="time" value={times.finAlmuerzo} onChange={(e) => handleTimeChange('finAlmuerzo', e.target.value)} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="finJornada" className="text-right">Fin Jornada</Label>
            <Input id="finJornada" type="time" value={times.finJornada} onChange={(e) => handleTimeChange('finJornada', e.target.value)} className="col-span-3" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>Cancelar</Button>
          <Button onClick={handleSave} disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Guardar Cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditJornadaModal;
