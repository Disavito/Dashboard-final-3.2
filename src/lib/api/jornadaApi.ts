import { supabase } from '../supabaseClient';
import { Tables, TablesInsert, TablesUpdate } from '../database.types';
import { format, parseISO, differenceInMinutes } from 'date-fns';

export type Jornada = Tables<'registros_jornada'>;
export type Colaborador = Tables<'colaboradores'>; // Eliminado salario_mensual

/**
 * Helper para calcular los minutos trabajados de una jornada individual.
 */
export const calculateWorkedMinutesForJornada = (jornada: Jornada): number => {
  const { hora_inicio_jornada, hora_fin_jornada, hora_inicio_almuerzo, hora_fin_almuerzo } = jornada;

  if (!hora_inicio_jornada || !hora_fin_jornada) {
    return 0;
  }

  const startWork = parseISO(hora_inicio_jornada);
  const endWork = parseISO(hora_fin_jornada);
  let totalMinutes = differenceInMinutes(endWork, startWork);

  if (hora_inicio_almuerzo && hora_fin_almuerzo) {
    const startLunch = parseISO(hora_inicio_almuerzo);
    const endLunch = parseISO(hora_fin_almuerzo);
    const lunchMinutes = differenceInMinutes(endLunch, startLunch);
    totalMinutes -= lunchMinutes;
  }

  return totalMinutes > 0 ? totalMinutes : 0;
};

/**
 * Obtiene el perfil de colaborador asociado a un user_id de auth.
 */
export const getColaboradorProfile = async (userId: string): Promise<Colaborador | null> => {
  const { data, error } = await supabase
    .from('colaboradores')
    .select('*') // Eliminado salario_mensual
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116: No rows found
    console.error("Error fetching colaborador profile:", error);
    throw new Error(error.message);
  }
  return data;
};

/**
 * Obtiene el registro de jornada de un colaborador para una fecha específica (por defecto, hoy).
 */
export const getJornadaByDate = async (colaboradorId: string, date: Date = new Date()): Promise<Jornada | null> => {
  const fecha = format(date, 'yyyy-MM-dd');
  const { data, error } = await supabase
    .from('registros_jornada')
    .select('*')
    .eq('colaborador_id', colaboradorId)
    .eq('fecha', fecha)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error("Error fetching today's jornada:", error);
    throw new Error(error.message);
  }
  return data;
};

/**
 * Inicia la jornada laboral para un colaborador.
 * Crea un nuevo registro para el día actual.
 */
export const clockIn = async (colaboradorId: string): Promise<Jornada> => {
  const now = new Date();
  const newJornada: TablesInsert<'registros_jornada'> = {
    colaborador_id: colaboradorId,
    fecha: format(now, 'yyyy-MM-dd'),
    hora_inicio_jornada: now.toISOString(),
  };

  const { data, error } = await supabase
    .from('registros_jornada')
    .insert(newJornada)
    .select()
    .single();

  if (error || !data) {
    console.error("Error clocking in:", error);
    throw new Error(error?.message || "Could not clock in.");
  }
  return data;
};

/**
 * Actualiza un registro de jornada existente.
 */
const updateJornada = async (jornadaId: number, updateData: TablesUpdate<'registros_jornada'>): Promise<Jornada> => {
  const { data, error } = await supabase
    .from('registros_jornada')
    .update(updateData)
    .eq('id', jornadaId)
    .select()
    .single();

  if (error || !data) {
    console.error("Error updating jornada:", error);
    throw new Error(error?.message || "Could not update jornada.");
  }
  return data;
};

/**
 * Inicia el descanso para el almuerzo.
 */
export const startLunch = (jornadaId: number) =>
  updateJornada(jornadaId, { hora_inicio_almuerzo: new Date().toISOString() });

/**
 * Finaliza el descanso del almuerzo.
 */
export const endLunch = (jornadaId: number) =>
  updateJornada(jornadaId, { hora_fin_almuerzo: new Date().toISOString() });

/**
 * Finaliza la jornada laboral.
 */
export const clockOut = (jornadaId: number) =>
  updateJornada(jornadaId, { hora_fin_jornada: new Date().toISOString() });


/**
 * Obtiene el historial de jornadas de un colaborador.
 */
export const getJornadaHistory = async (colaboradorId: string, page = 1, pageSize = 10): Promise<Jornada[]> => {
    const { data, error } = await supabase
        .from('registros_jornada')
        .select('*')
        .eq('colaborador_id', colaboradorId)
        .order('fecha', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

    if (error) {
        console.error("Error fetching jornada history:", error);
        throw new Error(error.message);
    }
    return data || [];
};

/**
 * (Admin) Obtiene todos los registros de jornada para un rango de fechas y/o colaborador.
 */
export const getAdminJornadas = async ({
  colaboradorId,
  startDate,
  endDate,
}: {
  colaboradorId?: string;
  startDate: string; // yyyy-MM-dd
  endDate: string; // yyyy-MM-dd
}): Promise<(Jornada & { colaboradores: Colaborador | null })[]> => {
  let query = supabase
    .from('registros_jornada')
    .select('*, colaboradores(*)')
    .gte('fecha', startDate)
    .lte('fecha', endDate)
    .order('fecha', { ascending: false })
    .order('colaborador_id', { ascending: true });

  if (colaboradorId && colaboradorId !== 'todos') {
    query = query.eq('colaborador_id', colaboradorId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching admin jornadas:", error);
    throw new Error(error.message);
  }
  return data || [];
};

/**
 * (Admin) Obtiene la lista de todos los colaboradores.
 */
export const getAllColaboradores = async (): Promise<Colaborador[]> => {
  const { data, error } = await supabase
    .from('colaboradores')
    .select('*') // Eliminado salario_mensual
    .order('name', { ascending: true });

  if (error) {
    console.error("Error fetching all colaboradores:", error);
    throw new Error(error.message);
  }
  return data || [];
};

/**
 * (Admin) Actualiza manualmente un registro de jornada.
 */
export const adminUpdateJornada = async (
  jornadaId: number,
  updates: Partial<Pick<Jornada, 'hora_inicio_jornada' | 'hora_inicio_almuerzo' | 'hora_fin_almuerzo' | 'hora_fin_jornada'>>
): Promise<Jornada> => {
  const { data, error } = await supabase
    .from('registros_jornada')
    .update(updates)
    .eq('id', jornadaId)
    .select()
    .single();

  if (error || !data) {
    console.error("Error manually updating jornada:", error);
    throw new Error(error?.message || "Could not update jornada record.");
  }
  return data;
};

// Eliminada la función updateColaboradorSalary
