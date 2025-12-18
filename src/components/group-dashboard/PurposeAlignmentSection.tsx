import { SectionHeader } from "./SectionHeader";
import { KpiCard } from "./KpiCard";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from "recharts";
import { Button } from "@/components/ui/button";

interface PurposeAlignmentSectionProps {
  alignedPercent?: number;
  activePercent: number;
  recurringPercent: number;
  activeDaysPercent: number;
  lowEffortPercent: number;
  isLoading?: boolean;
  hasIkigai?: boolean;
  periodLabel?: string;
  onOpenIkigai?: () => void;
}

export function PurposeAlignmentSection({
  alignedPercent,
  activePercent,
  recurringPercent,
  activeDaysPercent,
  lowEffortPercent,
  isLoading,
  hasIkigai = false,
  periodLabel = "período",
  onOpenIkigai,
}: PurposeAlignmentSectionProps) {
  const helpText = "Este gráfico mostra como as conversas se distribuem em relação aos temas definidos para o grupo. Ele não mede qualidade ou desempenho. Alterar os temas pode mudar significativamente esta leitura.";

  const data = [
    { eixo: "Conversas alinhadas", valor: alignedPercent ?? 0 },
    { eixo: "Participação", valor: activePercent },
    { eixo: "Engajamento recorrente", valor: recurringPercent },
    { eixo: "Ritmo saudável", valor: activeDaysPercent },
    { eixo: "Baixo esforço", valor: lowEffortPercent },
  ];

  const chartConfig = {
    valor: { label: "Percentual" },
  };

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <SectionHeader
        title="Alinhamento com o Propósito"
        subtitle={`Leitura em 5 dimensões (${periodLabel})`}
        helpText={helpText}
      />

      {onOpenIkigai && (
        <div className="flex justify-end mb-4">
          <Button size="sm" variant="outline" onClick={onOpenIkigai}>
            Gerenciar temas
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="grid grid-cols-1 gap-4">
          <KpiCard
            title="Conversas alinhadas ao propósito"
            value={alignedPercent !== undefined ? `${alignedPercent}%` : "—"}
            subtitle="Com base nos temas atualmente definidos para o grupo."
            isLoading={isLoading}
          />
          {alignedPercent !== undefined && alignedPercent < 10 && (
            <p className="text-xs text-muted-foreground">Valores baixos não indicam problema. Ajustar os temas pode alterar esta leitura.</p>
          )}
        </div>

        <div>
          {isLoading ? (
            <Skeleton className="h-[280px] w-full" />
          ) : !hasIkigai || alignedPercent === undefined ? (
            <div className="h-[280px] flex items-center justify-center rounded-lg border border-border bg-secondary/30">
              <p className="text-sm text-muted-foreground">Defina os temas do grupo para visualizar o radar</p>
            </div>
          ) : (
            <ChartContainer config={chartConfig} className="h-[280px] w-full">
              <RadarChart data={data}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="eixo" tick={{ fontSize: 11 }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Radar dataKey="valor" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} />
              </RadarChart>
            </ChartContainer>
          )}
        </div>
      </div>
    </section>
  );
}
