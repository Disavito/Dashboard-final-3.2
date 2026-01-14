"use client"

import * as React from "react"
import {
  CartesianGrid,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
  type TooltipProps,
  type LegendProps,
} from "recharts"
import { cn } from "@/lib/utils"

// --- ChartConfig (Type Definition) ---
export type ChartConfig = {
  [k: string]: {
    label?: string
    color?: string
    icon?: React.ComponentType<{ className?: string }>
  }
}

// --- ChartContext ---
type ChartContextProps = {
  config: ChartConfig
}

const ChartContext = React.createContext<ChartContextProps | null>(null)

function useChart() {
  const context = React.useContext(ChartContext)
  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer>")
  }
  return context
}

// --- ChartContainer (wrapper for the entire chart) ---
export const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<"div"> & {
    config: ChartConfig
  }
>(({ config, className, children, ...props }, ref) => (
  <ChartContext.Provider value={{ config }}>
    <div
      ref={ref}
      className={cn("flex h-[300px] w-full flex-col items-center justify-center", className)}
      {...props}
    >
      {children}
    </div>
  </ChartContext.Provider>
))
ChartContainer.displayName = "ChartContainer"

// --- ChartTooltipContent (renders the actual tooltip content) ---
export const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<"div"> &
  TooltipProps<number, string> &
  {
    hideLabel?: boolean;
    hideIndicator?: boolean;
  }
>(({ active, payload, className, hideLabel = false, hideIndicator = false, ...props }, ref) => {
  const { config } = useChart()

  if (!active || !payload || payload.length === 0) {
    return null
  }

  const relevantPayload = payload.filter((item) => item.dataKey && config[item.dataKey as string])

  return (
    <div
      ref={ref}
      className={cn(
        "rounded-lg border border-border bg-card p-2 text-sm shadow-md",
        className
      )}
      {...props}
    >
      {!hideLabel && payload[0].name && (
        <div className="mb-1 text-muted-foreground">{payload[0].name}</div>
      )}
      <div className="grid gap-1">
        {relevantPayload.map((item, index) => {
          const key = item.dataKey as keyof ChartConfig
          const itemConfig = config[key]
          const value = item.value
          const formattedValue = typeof value === "number" ? new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(value) : value // Changed to es-PE and PEN

          return (
            <div
              key={String(item.dataKey) || `item-${index}`}
              className="flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-2">
                {!hideIndicator && (
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{
                      backgroundColor: itemConfig?.color || item.color,
                    }}
                  />
                )}
                <span className="text-muted-foreground">
                  {itemConfig?.label || item.name}
                </span>
              </div>
              <span className="font-medium text-foreground">{formattedValue}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
})
ChartTooltipContent.displayName = "ChartTooltipContent"

// --- ChartTooltip (wrapper for Recharts Tooltip) ---
export const ChartTooltip = React.forwardRef<
  Tooltip<number, string>,
  TooltipProps<number, string>
>(({ content, ...props }, ref) => {
  return (
    <Tooltip
      ref={ref}
      content={content || <ChartTooltipContent />}
      {...props}
    />
  )
})
ChartTooltip.displayName = "ChartTooltip"

// --- ChartLegendContent (renders the actual legend content) ---

// Define a local type for the legend payload to avoid depending on non-exported types.
type ChartLegendPayloadItem = {
  dataKey: any
  color?: string
  value?: React.ReactNode
}

interface ChartLegendContentProps extends React.ComponentPropsWithoutRef<"div"> {
  payload?: ChartLegendPayloadItem[]
  [key: string]: any // Allow any other props passed by Recharts' Legend
}

export const ChartLegendContent = React.forwardRef<
  HTMLDivElement,
  ChartLegendContentProps
>(({ payload, className, ...props }, ref) => {
  const { config } = useChart()

  if (!payload || payload.length === 0) {
    return null
  }

  return (
    <div
      ref={ref}
      className={cn(
        "flex flex-wrap items-center justify-center gap-4 p-2",
        className
      )}
      {...props}
    >
      {payload.map((item: ChartLegendPayloadItem) => {
        const key = item.dataKey as keyof ChartConfig
        const itemConfig = config[key]
        const Icon = itemConfig?.icon

        return (
          <div
           key={String(item.dataKey)}
            className="flex items-center gap-1.5"
          >
            {Icon && <Icon className="h-3 w-3 shrink-0" />}
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{
                backgroundColor: itemConfig?.color || item.color,
              }}
            />
            <span className="text-xs text-muted-foreground">
              {itemConfig?.label || item.value}
            </span>
          </div>
        )
      })}
    </div>
  )
})
ChartLegendContent.displayName = "ChartLegendContent"

// --- ChartLegend (wrapper for Recharts Legend) ---
export const ChartLegend = React.forwardRef<
  Legend,
  LegendProps
>(({ content, ...props }, ref) => {
  return (
    <Legend
      ref={ref as any}
      content={content || <ChartLegendContent />}
      {...props}
    />
  )
})
ChartLegend.displayName = "ChartLegend"

// --- Main Chart Component (from user's original file, adapted) ---
interface ChartProps extends React.ComponentProps<typeof ChartContainer> {
  data: Record<string, any>[]
  config: ChartConfig
}

export const Chart = React.forwardRef<HTMLDivElement, ChartProps>(
  ({ data, config, className, children, ...props }, ref) => {
    return (
      <ChartContainer
        ref={ref}
        config={config}
        className={className}
        {...props}
      >
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            accessibilityLayer
            data={data}
            margin={{
              top: 5,
              right: 10,
              left: 10,
              bottom: 0,
            }}
          >
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => {
                // Assuming value is already formatted as 'MMM yy' or similar for chartData
                return value;
              }}
              className="text-xs text-muted-foreground"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', notation: 'compact' }).format(value)} // Changed to es-PE and PEN
              className="text-xs text-muted-foreground"
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <ChartLegend content={<ChartLegendContent />} />
            {children}
          </LineChart>
        </ResponsiveContainer>
      </ChartContainer>
    )
  }
)

Chart.displayName = "Chart"
