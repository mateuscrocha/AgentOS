import { Activity, Filter, Image, Mic, Video, FileText, MapPin, Smile, Search, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilterChips } from "@/components/ui/filter-chips";
import { FilterTriggerButton } from "@/components/ui/filter-trigger-button";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { translateMessageType } from "@/lib/messages";

type MessageFiltersProps = {
  search: string;
  onSearchChange: (next: string) => void;
  onClearSearch: () => void;
  fromDate: string;
  toDate: string;
  onFromDateChange: (next: string) => void;
  onToDateChange: (next: string) => void;
  typeFilter: string;
  onTypeFilterChange: (next: string) => void;
  hasActiveFilters: boolean;
  filtersOpen: boolean;
  setFiltersOpen: (open: boolean) => void;
  onClearAll: () => void;
  isFetching?: boolean;
};

const MAIN_TYPES = ["text", "image", "audio", "video", "document"] as const;
const OTHER_TYPES = ["poll", "poll_vote", "location", "sticker"] as const;

export function MessageFilters({
  search,
  onSearchChange,
  onClearSearch,
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  typeFilter,
  onTypeFilterChange,
  hasActiveFilters,
  filtersOpen,
  setFiltersOpen,
  onClearAll,
  isFetching,
}: MessageFiltersProps) {
  const activeFilterCount = Number(!!search.trim()) + Number(!!typeFilter) + Number(!!fromDate) + Number(!!toDate);

  const formatDatePt = (value: string) => {
    if (!value) return "";
    const d = new Date(`${value}T00:00:00`);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString("pt-BR");
  };

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar no conteúdo..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Buscar mensagens por conteúdo"
            className="w-full pl-10 pr-10 h-11 rounded-xl border border-border/80 bg-card/95 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />

          {isFetching ? (
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </span>
          ) : search ? (
            <button
              onClick={onClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label="Limpar busca"
              type="button"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          ) : null}
        </div>

        <div className="sm:hidden">
          <FilterTriggerButton
            className="w-auto"
            onClick={() => setFiltersOpen(true)}
            icon={Filter}
            activeCount={hasActiveFilters ? activeFilterCount || 1 : undefined}
          />
        </div>
      </div>

      {hasActiveFilters ? (
        <FilterChips
          items={[
            ...(search.trim()
              ? [{
                  key: "search",
                  label: `Busca: ${search.trim()}`,
                  onRemove: onClearSearch,
                  ariaLabel: "Remover filtro de busca",
                }]
              : []),
            ...(typeFilter
              ? [{
                  key: "type",
                  label: `Tipo: ${translateMessageType(typeFilter)}`,
                  onRemove: () => onTypeFilterChange(""),
                  ariaLabel: "Remover filtro de tipo",
                }]
              : []),
            ...(fromDate
              ? [{
                  key: "from",
                  label: `De: ${formatDatePt(fromDate)}`,
                  onRemove: () => onFromDateChange(""),
                  ariaLabel: "Remover data inicial",
                }]
              : []),
            ...(toDate
              ? [{
                  key: "to",
                  label: `Até: ${formatDatePt(toDate)}`,
                  onRemove: () => onToDateChange(""),
                  ariaLabel: "Remover data final",
                }]
              : []),
          ]}
        />
      ) : null}

      <div className="hidden sm:flex items-center gap-2">
        <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Filter className="h-4 w-4" />
          Tipo
        </span>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => onTypeFilterChange("")}
            aria-pressed={!typeFilter}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              !typeFilter ? "bg-primary text-primary-foreground" : "border border-border/70 bg-card/80 text-foreground hover:bg-secondary/35",
            )}
            type="button"
          >
            Todos
          </button>

          {MAIN_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => onTypeFilterChange(t)}
              aria-pressed={typeFilter === t}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                typeFilter === t ? "bg-primary text-primary-foreground" : "border border-border/70 bg-card/80 text-foreground hover:bg-secondary/35",
              )}
              type="button"
            >
              {translateMessageType(t)}
            </button>
          ))}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-pressed={OTHER_TYPES.includes(typeFilter as any)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  OTHER_TYPES.includes(typeFilter as any)
                    ? "bg-primary text-primary-foreground"
                    : "border border-border/70 bg-card/80 text-foreground hover:bg-secondary/35",
                )}
              >
                Outros
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {OTHER_TYPES.map((t) => (
                <DropdownMenuItem key={t} onSelect={() => onTypeFilterChange(t)}>
                  {translateMessageType(t)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="hidden sm:grid sm:grid-cols-2 gap-2">
        <label className="flex items-center gap-2 rounded-xl border border-border/70 bg-card/80 px-3 h-11 text-sm">
          <span className="text-xs text-muted-foreground shrink-0">De</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => onFromDateChange(e.target.value)}
            className="w-full bg-transparent text-sm focus:outline-none"
            aria-label="Filtrar mensagens a partir da data"
          />
        </label>
        <label className="flex items-center gap-2 rounded-xl border border-border/70 bg-card/80 px-3 h-11 text-sm">
          <span className="text-xs text-muted-foreground shrink-0">Até</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => onToDateChange(e.target.value)}
            className="w-full bg-transparent text-sm focus:outline-none"
            aria-label="Filtrar mensagens até a data"
          />
        </label>
      </div>

      <Drawer open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DrawerContent className="bg-card border-border">
          <DrawerHeader className="text-left">
            <DrawerTitle>Filtros</DrawerTitle>
            <DrawerDescription>Refine por tipo de mensagem.</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-2">
            <div className="space-y-3">
              <div className="space-y-2">
                <div className="text-sm font-medium text-foreground">Período</div>
                <div className="grid grid-cols-1 gap-2">
                  <label className="space-y-1">
                    <span className="text-xs text-muted-foreground">De</span>
                    <input
                      type="date"
                      value={fromDate}
                      onChange={(e) => onFromDateChange(e.target.value)}
                      className="w-full h-10 rounded-xl border border-border/80 bg-card/90 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      aria-label="Filtrar mensagens a partir da data"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-muted-foreground">Até</span>
                    <input
                      type="date"
                      value={toDate}
                      onChange={(e) => onToDateChange(e.target.value)}
                      className="w-full h-10 rounded-xl border border-border/80 bg-card/90 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      aria-label="Filtrar mensagens até a data"
                    />
                  </label>
                </div>
              </div>

              <div className="text-sm font-medium text-foreground">Tipo</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    onTypeFilterChange("");
                    setFiltersOpen(false);
                  }}
                  aria-pressed={!typeFilter}
                  className={cn(
                    "px-3 py-2 rounded-xl text-sm font-medium transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    !typeFilter ? "bg-primary text-primary-foreground border-transparent" : "bg-card/90 border-border/80 text-foreground hover:bg-secondary/25",
                  )}
                  type="button"
                >
                  Todos
                </button>

                {[...MAIN_TYPES, ...OTHER_TYPES].map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      onTypeFilterChange(t);
                      setFiltersOpen(false);
                    }}
                    aria-pressed={typeFilter === t}
                    className={cn(
                      "px-3 py-2 rounded-xl text-sm font-medium transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      typeFilter === t ? "bg-primary text-primary-foreground border-transparent" : "bg-card/90 border-border/80 text-foreground hover:bg-secondary/25",
                    )}
                    type="button"
                  >
                    {translateMessageType(t)}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DrawerFooter>
            {hasActiveFilters ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  onClearAll();
                  setFiltersOpen(false);
                }}
              >
                Limpar filtros
              </Button>
            ) : null}
            <DrawerClose asChild>
              <Button type="button">Ver resultados</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
