"use client"

import { DailySummary } from "@/lib/types/invoicing"
import { ColumnDef } from "@tanstack/react-table"
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/components/ui/use-toast"
import { checkSummaryStatus, updateSummaryStatusInDb } from "@/lib/api/invoicingApi"
import { ArrowUpDown, MoreHorizontal, Loader2 } from "lucide-react"

const getStatusVariant = (status: string | null | undefined): "default" | "secondary" | "destructive" | "outline" => {
  switch (status?.toLowerCase()) {
    case 'aceptado':
      return 'default';
    case 'rechazado':
      return 'destructive';
    case 'pendiente':
      return 'secondary';
    default:
      return 'outline';
  }
};

const getStatusColorClass = (status: string | null | undefined): string => {
    switch (status?.toLowerCase()) {
      case 'aceptado':
        return 'bg-success/20 text-success-foreground border-success/40';
      case 'rechazado':
        return 'bg-error/20 text-error-foreground border-error/40';
      case 'pendiente':
        return 'bg-warning/20 text-warning-foreground border-warning/40';
      default:
        return 'bg-muted/50 text-muted-foreground border-border';
    }
  };

// Componente de celda para las acciones, para que pueda manejar su propio estado de carga.
const ActionsCell = ({ row, onStatusUpdate }: { row: any; onStatusUpdate: (summaryId: number, newStatus: string) => void }) => {
  const summary: DailySummary = row.original
  const { toast } = useToast()
  const [isChecking, setIsChecking] = useState(false)

  const handleCheckStatus = async () => {
    if (!summary.summary_api_id) {
      toast({
        variant: "destructive",
        title: "Error de Consulta",
        description: "Este resumen no tiene un ID de API para consultar.",
      })
      return
    }

    setIsChecking(true)
    try {
      const newStatus = await checkSummaryStatus(summary.summary_api_id)
      if (newStatus && newStatus !== summary.estado_sunat) {
        await updateSummaryStatusInDb(summary.id, newStatus)
        onStatusUpdate(summary.id, newStatus) // Notifica al componente padre para actualizar el estado de la UI
        toast({
          title: "Estado Actualizado",
          description: `El estado del resumen ahora es: ${newStatus}.`,
          className: "bg-success/20 border-success/40 text-success-foreground",
        })
      } else if (newStatus) {
        toast({
          title: "Sin Cambios",
          description: `El estado del resumen en SUNAT sigue siendo: ${newStatus}.`,
        })
      } else {
        toast({
          variant: "destructive",
          title: "Consulta Fallida",
          description: "No se pudo obtener un nuevo estado desde la API.",
        })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Ocurrió un error desconocido."
      toast({
        variant: "destructive",
        title: "Error al Consultar Ticket",
        description: errorMessage,
      })
    } finally {
      setIsChecking(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Abrir menú</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
        <DropdownMenuItem onClick={handleCheckStatus} disabled={isChecking}>
          {isChecking ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Consultando...
            </>
          ) : (
            "Consultar Ticket"
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// La exportación principal es ahora una función que genera el array de columnas.
// Esto nos permite pasarle la función para actualizar el estado.
export const getColumns = (onStatusUpdate: (summaryId: number, newStatus: string) => void): ColumnDef<DailySummary>[] => [
  {
    accessorKey: "fecha_resumen",
    header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Fecha de Resumen
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
    cell: ({ row }) => {
      const date = new Date(row.getValue("fecha_resumen"));
      date.setDate(date.getDate() + 1);
      return <div className="font-medium">{format(date, "dd 'de' MMMM, yyyy", { locale: es })}</div>;
    },
  },
  {
    accessorKey: "numero_completo",
    header: "Número de Resumen",
  },
  {
    accessorKey: "ticket",
    header: "Ticket SUNAT",
  },
  {
    accessorKey: "estado_sunat",
    header: "Estado SUNAT",
    cell: ({ row }) => {
      const status = row.getValue("estado_sunat") as string | null;
      const statusText = status || 'No disponible';
      return (
        <Badge variant={getStatusVariant(status)} className={`capitalize ${getStatusColorClass(status)}`}>
          {statusText}
        </Badge>
      );
    },
  },
  {
    id: "actions",
    cell: ({ row }) => <ActionsCell row={row} onStatusUpdate={onStatusUpdate} />,
  },
]
