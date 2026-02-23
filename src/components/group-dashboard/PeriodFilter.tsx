import { useState, useEffect } from "react";
import { format, addDays } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
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
import { getDateRange, type PeriodType, type DateRange } from "./period-utils";
import { SAO_PAULO_TZ, isValidDate } from "@/lib/date";
import { useIsMobile } from "@/hooks/use-mobile";

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

export function PeriodFilter({ value, customRange, onChange }: PeriodFilterProps) {
  const isMobile = useIsMobile();
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const [tempRange, setTempRange] = useState<{ from?: Date; to?: Date }>({
    from: customRange?.from,
    to: customRange?.to,
  });

  useEffect(() => {
    setTempRange({ from: customRange?.from, to: customRange?.to });
  }, [customRange?.from, customRange?.to]);

  const handlePeriodChange = (newPeriod: PeriodType) => {
    if (newPeriod === 'custom') {
      const initial = getDateRange('custom', customRange);
      onChange('custom', initial);
      setIsCustomOpen(true);
      return;
    }
    const range = getDateRange(newPeriod);
    onChange(newPeriod, range);
  };

  const handleCustomApply = () => {
    if (tempRange.from && tempRange.to) {
      const fromStr = formatInTimeZone(tempRange.from, SAO_PAULO_TZ, 'yyyy-MM-dd');
      const toStr = formatInTimeZone(tempRange.to, SAO_PAULO_TZ, 'yyyy-MM-dd');
      const from = fromZonedTime(`${fromStr}T00:00:00`, SAO_PAULO_TZ);
      const toNextStart = addDays(fromZonedTime(`${toStr}T00:00:00`, SAO_PAULO_TZ), 1);
      const to = new Date(toNextStart.getTime() - 1);
      onChange('custom', { from, to });
      setIsCustomOpen(false);
    }
  };

  const formatRangeLabel = () => {
    if (
      value === "custom" &&
      customRange &&
      isValidDate(customRange.from) &&
      isValidDate(customRange.to)
    ) {
      return `${format(customRange.from, 'dd/MM', { locale: ptBR })} - ${format(customRange.to, 'dd/MM', { locale: ptBR })}`;
    }
    return periodOptions.find(o => o.value === value)?.label || 'Período';
  };

  return (
    <div className="flex items-center gap-2">
      <Popover open={isCustomOpen} onOpenChange={setIsCustomOpen}>
        <Select value={value} onValueChange={(v) => handlePeriodChange(v as PeriodType)}>
          <SelectTrigger className="w-[200px] bg-card border-border" aria-label="Mostrar dados de">
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
            aria-label="Selecionar período personalizado"
            onClick={() => setIsCustomOpen(true)}
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-auto p-0" align="end">
          <div className="p-3 border-b border-border">
            <p className="text-sm font-medium">Escolha as datas</p>
            <p className="text-[13px] text-muted-foreground mt-1">
              {tempRange.from && tempRange.to 
                ? `${format(tempRange.from, 'dd/MM/yyyy', { locale: ptBR })} - ${format(tempRange.to, 'dd/MM/yyyy', { locale: ptBR })}`
                : 'Selecione as datas'
              }
            </p>
            <p className="mt-1 text-xs text-muted-foreground/90">
              Comparação: o painel usa o período anterior equivalente.
            </p>
          </div>
          <Calendar
            mode="range"
            selected={{ from: tempRange.from, to: tempRange.to }}
            onSelect={(range) => setTempRange({ from: range?.from, to: range?.to })}
            numberOfMonths={isMobile ? 1 : 2}
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
