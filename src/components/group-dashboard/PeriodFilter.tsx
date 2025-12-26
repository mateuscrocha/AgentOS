import { useState } from "react";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, subDays, subWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type PeriodType = 
  | 'today' 
  | 'yesterday' 
  | 'this_week' 
  | 'last_week' 
  | 'this_month'
  | '7d' 
  | '14d' 
  | '30d' 
  | '90d'
  | 'custom';

export interface DateRange {
  from: Date;
  to: Date;
}

interface PeriodFilterProps {
  value: PeriodType;
  customRange?: DateRange;
  onChange: (period: PeriodType, range: DateRange) => void;
}

const periodOptions: { value: PeriodType; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: 'yesterday', label: 'Ontem' },
  { value: 'this_week', label: 'Esta semana' },
  { value: 'last_week', label: 'Semana passada' },
  { value: 'this_month', label: 'Este mês' },
  { value: '7d', label: 'Últimos 7 dias' },
  { value: '14d', label: 'Últimos 14 dias' },
  { value: '30d', label: 'Últimos 30 dias' },
  { value: '90d', label: 'Últimos 90 dias' },
  { value: 'custom', label: 'Personalizado' },
];

export function getDateRange(period: PeriodType, customRange?: DateRange): DateRange {
  const now = new Date();
  
  switch (period) {
    case 'today':
      return {
        from: startOfDay(now),
        to: endOfDay(now),
      };
    case 'yesterday': {
      const yesterday = subDays(now, 1);
      return {
        from: startOfDay(yesterday),
        to: endOfDay(yesterday),
      };
    }
    case 'this_week':
      return {
        from: startOfWeek(now, { weekStartsOn: 1 }),
        to: endOfDay(now),
      };
    case 'this_month':
      return {
        from: startOfMonth(now),
        to: endOfDay(now),
      };
    case 'last_week': {
      const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
      const lastWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
      return {
        from: lastWeekStart,
        to: lastWeekEnd,
      };
    }
    case '7d':
      return {
        from: startOfDay(subDays(now, 6)),
        to: endOfDay(now),
      };
    case '14d':
      return {
        from: startOfDay(subDays(now, 13)),
        to: endOfDay(now),
      };
    case '30d':
      return {
        from: startOfDay(subDays(now, 29)),
        to: endOfDay(now),
      };
    case '90d':
      return {
        from: startOfDay(subDays(now, 89)),
        to: endOfDay(now),
      };
    case 'custom':
      return customRange || {
        from: startOfDay(subDays(now, 6)),
        to: endOfDay(now),
      };
    default:
      return {
        from: startOfDay(subDays(now, 6)),
        to: endOfDay(now),
      };
  }
}

export function PeriodFilter({ value, customRange, onChange }: PeriodFilterProps) {
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const [tempRange, setTempRange] = useState<{ from?: Date; to?: Date }>({
    from: customRange?.from,
    to: customRange?.to,
  });

  const handlePeriodChange = (newPeriod: PeriodType) => {
    if (newPeriod === 'custom') {
      setIsCustomOpen(true);
      return;
    }
    const range = getDateRange(newPeriod);
    onChange(newPeriod, range);
  };

  const handleCustomApply = () => {
    if (tempRange.from && tempRange.to) {
      onChange('custom', {
        from: startOfDay(tempRange.from),
        to: endOfDay(tempRange.to),
      });
      setIsCustomOpen(false);
    }
  };

  const formatRangeLabel = () => {
    if (value === 'custom' && customRange) {
      return `${format(customRange.from, 'dd/MM', { locale: ptBR })} - ${format(customRange.to, 'dd/MM', { locale: ptBR })}`;
    }
    return periodOptions.find(o => o.value === value)?.label || 'Período';
  };

  return (
    <div className="flex items-center gap-2">
      <Popover open={isCustomOpen} onOpenChange={setIsCustomOpen}>
        <Select value={value} onValueChange={(v) => handlePeriodChange(v as PeriodType)}>
          <SelectTrigger className="w-[180px] bg-card border-border">
            <SelectValue placeholder="Período">
              {formatRangeLabel()}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {periodOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className={cn(
              "shrink-0",
              value === 'custom' && "border-primary text-primary"
            )}
            onClick={() => setIsCustomOpen(true)}
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-auto p-0" align="end">
          <div className="p-3 border-b border-border">
            <p className="text-sm font-medium">Selecione o período</p>
            <p className="text-xs text-muted-foreground mt-1">
              {tempRange.from && tempRange.to 
                ? `${format(tempRange.from, 'dd/MM/yyyy', { locale: ptBR })} - ${format(tempRange.to, 'dd/MM/yyyy', { locale: ptBR })}`
                : 'Selecione as datas'
              }
            </p>
          </div>
          <Calendar
            mode="range"
            selected={{ from: tempRange.from, to: tempRange.to }}
            onSelect={(range) => setTempRange({ from: range?.from, to: range?.to })}
            numberOfMonths={2}
            locale={ptBR}
            disabled={(date) => date > new Date()}
            className="p-3 pointer-events-auto"
          />
          <div className="p-3 border-t border-border flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCustomOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleCustomApply}
              disabled={!tempRange.from || !tempRange.to}
            >
              Aplicar
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
