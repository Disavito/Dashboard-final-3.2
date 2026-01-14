import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  SortingState,
  getSortedRowModel,
  ColumnFiltersState,
  getFilteredRowModel,
  RowSelectionState,
  PaginationState,
  FilterFn, // Import FilterFn type
  Row, // Import Row type
} from '@tanstack/react-table';
import { useState, useEffect } from 'react';
import { LucideIcon, ChevronLeft, ChevronRight } from 'lucide-react'; // Added LucideIcon for typing

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import EmptyState from '../ui-custom/EmptyState'; // Import EmptyState

// Define el tipo para la función de filtro global personalizada
type CustomGlobalFilterFn<TData> = (row: Row<TData>, columnId: string, filterValue: string) => boolean;

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  // Opcional: Estado de paginación controlado
  pagination?: PaginationState;
  onPaginationChange?: (updater: PaginationState | ((old: PaginationState) => PaginationState)) => void;
  // Opcional: Estado de selección de filas
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: (updater: RowSelectionState | ((old: RowSelectionState) => RowSelectionState)) => void;
  // Opcional: Render prop para contenido encima de la tabla (ej. acciones masivas)
  renderAboveTable?: (tableInstance: ReturnType<typeof useReactTable<TData>>) => React.ReactNode;
  // Props para el filtro global (TS2322 Fix)
  globalFilter?: string;
  setGlobalFilter?: (filter: string) => void;
  customGlobalFilterFn?: CustomGlobalFilterFn<TData>;
  // Nuevas props para el estado vacío
  emptyTitle?: string;
  emptyDescription?: string;
  EmptyIcon?: LucideIcon | React.ForwardRefExoticComponent<any>;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  pagination: controlledPagination,
  onPaginationChange: setControlledPagination,
  rowSelection: controlledRowSelection,
  onRowSelectionChange: setControlledRowSelection,
  renderAboveTable,
  globalFilter,
  setGlobalFilter,
  customGlobalFilterFn,
  emptyTitle = 'No hay resultados.',
  emptyDescription = 'Ajusta tus filtros o verifica la fuente de datos.',
  EmptyIcon,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  
  // Estados internos si no son controlados
  const [internalPagination, setInternalPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [internalRowSelection, setInternalRowSelection] = useState<RowSelectionState>({});

  // Usar estados controlados si se proporcionan, sino usar internos
  const pagination = controlledPagination ?? internalPagination;
  const setPagination = setControlledPagination ?? setInternalPagination;
  const rowSelection = controlledRowSelection ?? internalRowSelection;
  const setRowSelection = setControlledRowSelection ?? setInternalRowSelection; 

  // Reset page index if data changes significantly (e.g., filtering applied)
  useEffect(() => {
    if (data.length > 0 && pagination.pageIndex * pagination.pageSize >= data.length) {
      setPagination(old => ({ ...old, pageIndex: 0 }));
    }
  }, [data, pagination.pageSize, setPagination]);


  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    state: {
      sorting,
      columnFilters,
      rowSelection,
      pagination,
      // Añadir filtro global al estado si se proporciona
      globalFilter: globalFilter,
    },
    // Configuración del filtro global
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: customGlobalFilterFn as FilterFn<TData> | undefined,
  });

  return (
    <div className="w-full">
      {/* Renderizar contenido encima de la tabla (ej. Bulk Actions) */}
      {renderAboveTable && renderAboveTable(table)}

      {/* CRITICAL: Added overflow-x-auto for mobile responsiveness */}
      <div className="rounded-xl border border-border overflow-x-auto shadow-xl">
        <Table className="min-w-full">
          <TableHeader className="bg-background/50 sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="border-border hover:bg-background/50">
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} className="text-textSecondary font-semibold text-sm whitespace-nowrap">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className="border-border/50 hover:bg-background/70 transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-3 align-top">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                {/* Render EmptyState spanning all columns */}
                <TableCell colSpan={columns.length} className="p-0">
                  <div className="py-12">
                    <EmptyState
                      Icon={EmptyIcon}
                      title={emptyTitle}
                      description={emptyDescription}
                    />
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      
      {/* Only show pagination if there are rows */}
      {table.getRowModel().rows?.length > 0 && (
        <div className="flex items-center justify-between space-x-2 py-4 flex-wrap gap-y-2">
          <div className="flex-1 text-sm text-textSecondary min-w-[150px]">
            {table.getFilteredSelectedRowModel().rows.length} de{' '}
            {table.getFilteredRowModel().rows.length} fila(s) seleccionada(s).
          </div>
          <div className="flex items-center space-x-6 lg:space-x-8">
            <div className="flex items-center space-x-2">
              <p className="text-sm font-medium text-textSecondary whitespace-nowrap">Filas por página</p>
              <Select
                value={`${table.getState().pagination.pageSize}`}
                onValueChange={(value) => {
                  table.setPageSize(Number(value));
                }}
              >
                <SelectTrigger className="h-8 w-[70px] bg-background border-border">
                  <SelectValue placeholder={table.getState().pagination.pageSize} />
                </SelectTrigger>
                <SelectContent side="top" className="bg-surface border-border">
                  {[10, 20, 30, 40, 50].map((pageSize) => (
                    <SelectItem key={pageSize} value={`${pageSize}`}>
                      {pageSize}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex w-[100px] items-center justify-center text-sm font-medium text-textSecondary whitespace-nowrap">
              Página {table.getState().pagination.pageIndex + 1} de{' '}
              {table.getPageCount()}
            </div>
            <div className="flex items-center space-x-2">
              {/* CRITICAL FIX: Changed h-8 w-8 to h-11 w-11 (44px) for minimum touch target compliance */}
              <Button
                variant="outline"
                className="h-11 w-11 p-0 bg-background border-border hover:bg-surface"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Ir a la página anterior</span>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {/* CRITICAL FIX: Changed h-8 w-8 to h-11 w-11 (44px) for minimum touch target compliance */}
              <Button
                variant="outline"
                className="h-11 w-11 p-0 bg-background border-border hover:bg-surface"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Ir a la página siguiente</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
