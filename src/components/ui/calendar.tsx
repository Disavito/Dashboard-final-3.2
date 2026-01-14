"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker" // Removed useDayPicker
import { format, setMonth, setYear, getMonth, getYear } from "date-fns"
import { es } from "date-fns/locale"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Define props for CustomCaption
interface CustomCaptionProps {
  displayMonth: Date;
  onMonthChange: (month: Date) => void; // Explicitly pass this down
  fromYear: number;
  toYear: number;
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  month: controlledMonth, // Accept controlled month prop
  onMonthChange: controlledOnMonthChange, // Accept controlled onMonthChange prop
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  const fromYear = new Date().getFullYear() - 100;
  const toYear = new Date().getFullYear();

  // Manage internal month state if not controlled from outside
  const [internalMonth, setInternalMonth] = React.useState(controlledMonth || props.defaultMonth || new Date());

  // Use the controlled month if provided, otherwise use internal state
  const currentMonth = controlledMonth || internalMonth;
  const handleMonthChange = controlledOnMonthChange || setInternalMonth;

  const CustomCaption = ({ displayMonth, onMonthChange: captionOnMonthChange, fromYear, toYear }: CustomCaptionProps) => {
    const handleMonthSelectChange = (value: string) => {
      const newMonth = parseInt(value, 10);
      captionOnMonthChange(setMonth(displayMonth, newMonth));
    };

    const handleYearSelectChange = (value: string) => {
      const newYear = parseInt(value, 10);
      captionOnMonthChange(setYear(displayMonth, newYear));
    };

    const monthValue = getMonth(displayMonth);
    const yearValue = getYear(displayMonth);

    const months = Array.from({ length: 12 }, (_, i) => ({
      value: i,
      label: format(setMonth(new Date(), i), 'MMM', { locale: es }),
    }));

    const years = Array.from(
      { length: toYear - fromYear + 1 },
      (_, i) => ({
        value: fromYear + i,
        label: String(fromYear + i),
      })
    );

    return (
      <div className="flex justify-center gap-2 p-2">
        <Select onValueChange={handleMonthSelectChange} value={String(monthValue)}>
          <SelectTrigger className="w-[110px] h-8 text-sm">
            <SelectValue placeholder="Mes" />
          </SelectTrigger>
          <SelectContent>
            {months.map((month) => (
              <SelectItem key={month.value} value={String(month.value)}>
                {month.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select onValueChange={handleYearSelectChange} value={String(yearValue)}>
          <SelectTrigger className="w-[80px] h-8 text-sm">
            <SelectValue placeholder="Año" />
          </SelectTrigger>
          <SelectContent>
            {years.map((year) => (
              <SelectItem key={year.value} value={String(year.value)}>
                {year.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  };

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-between pt-1 relative items-center",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell:
          "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-success text-success-foreground hover:bg-success hover:text-success-foreground focus:bg-success focus:text-success-foreground",
        day_today: "bg-success text-success-foreground",
        day_outside:
          "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      month={currentMonth} // Pass the controlled/internal month
      onMonthChange={handleMonthChange} // Pass the controlled/internal onMonthChange
      fromYear={fromYear}
      toYear={toYear}
      components={{
        IconLeft: () => <ChevronLeft className="h-4 w-4" />,
        IconRight: () => <ChevronRight className="h-4 w-4" />,
        Caption: (captionProps) => (
          <CustomCaption
            {...captionProps}
            onMonthChange={handleMonthChange} // Pass the handler to CustomCaption
            fromYear={fromYear}
            toYear={toYear}
          />
        ),
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
