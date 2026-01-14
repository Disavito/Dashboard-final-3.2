import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';

interface UseSupabaseDataOptions {
  tableName: string;
  initialFilters?: Record<string, any>;
  initialSort?: { column: string; ascending: boolean };
  enabled?: boolean; // To conditionally fetch data
  selectQuery?: string; // New optional parameter for custom select queries
}

export function useSupabaseData<T>(options: UseSupabaseDataOptions) {
  const { tableName, initialFilters = {}, initialSort, enabled = true, selectQuery = '*' } = options;
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Record<string, any>>(initialFilters);
  const [sort, setSort] = useState(initialSort);

  const fetchData = useCallback(async () => {
    if (!enabled) return;

    setLoading(true);
    setError(null);

    let query = supabase.from(tableName).select(selectQuery); // Use selectQuery here

    // Apply filters
    for (const key in filters) {
      if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
        query = query.eq(key, filters[key]);
      }
    }

    // Apply sorting
    if (sort) {
      query = query.order(sort.column, { ascending: sort.ascending });
    } else {
      // Default sort by created_at descending if no sort is provided
      // Check if 'created_at' column exists in the type T
      // This is a simplification; a more robust solution might query schema or handle errors
      if (tableName === 'ingresos') { // Ingresos has 'created_at'
        query = query.order('created_at', { ascending: false });
      } else if (tableName === 'gastos') { // Gastos has 'created_at'
        query = query.order('created_at', { ascending: false });
      } else if (tableName === 'colaboradores') { // Colaboradores has 'created_at'
        query = query.order('created_at', { ascending: false });
      } else if (tableName === 'socio_titulares') { // SocioTitulares has 'created_at'
        query = query.order('created_at', { ascending: false });
      }
    }

    const { data: fetchedData, error: fetchError } = await query;

    if (fetchError) {
      console.error(`Error fetching data from ${tableName}:`, fetchError);
      setError(fetchError.message);
      toast.error(`Error al cargar ${tableName}`, { description: fetchError.message });
    } else {
      setData(fetchedData as T[]);
    }
    setLoading(false);
  }, [tableName, filters, sort, enabled, selectQuery]); // Add selectQuery to dependencies

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const addRecord = useCallback(async (record: Partial<T>) => {
    setLoading(true);
    const { data: newRecord, error: insertError } = await supabase
      .from(tableName)
      .insert(record)
      .select()
      .single();

    if (insertError) {
      setError(insertError.message);
      toast.error(`Error al añadir ${tableName}`, { description: insertError.message });
      setLoading(false);
      return null;
    } else {
      setData((prev) => (newRecord ? [newRecord as T, ...prev] : prev));
      toast.success(`${tableName} añadido correctamente.`);
      setLoading(false);
      return newRecord as T;
    }
  }, [tableName]);

  // Updated id type to accept string or number
  const updateRecord = useCallback(async (id: string | number, record: Partial<T>) => {
    setLoading(true);
    const { data: updatedRecord, error: updateError } = await supabase
      .from(tableName)
      .update(record)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      setError(updateError.message);
      toast.error(`Error al actualizar ${tableName}`, { description: updateError.message });
      setLoading(false);
      return null;
    } else {
      setData((prev) =>
        prev.map((item) => ((item as any).id === id ? (updatedRecord as T) : item))
      );
      toast.success(`${tableName} actualizado correctamente.`);
      setLoading(false);
      return updatedRecord as T;
    }
  }, [tableName]);

  // Updated id type to accept string or number
  const deleteRecord = useCallback(async (id: string | number) => {
    setLoading(true);
    const { error: deleteError } = await supabase
      .from(tableName)
      .delete()
      .eq('id', id);

    if (deleteError) {
      setError(deleteError.message);
      toast.error(`Error al eliminar ${tableName}`, { description: deleteError.message });
      setLoading(false);
      return false;
    } else {
      setData((prev) => (prev as any[]).filter((item) => item.id !== id));
      toast.success(`${tableName} eliminado correctamente.`);
      setLoading(false);
      return true;
    }
  }, [tableName]);

  return {
    data,
    loading,
    error,
    filters,
    setFilters,
    sort,
    setSort,
    refreshData: fetchData, // Exponer fetchData como refreshData
    addRecord,
    updateRecord,
    deleteRecord,
  };
}
