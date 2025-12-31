import { SectionHeader } from "./SectionHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, Feather, Info, Repeat, Target, Users } from "lucide-react";

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
  const helpText = "Leitura interpretativa baseada nos temas definidos para o grupo. Valores baixos não indicam problema: podem refletir temas pouco específicos ou conversas naturais fora do escopo.";

  const periodText = (() => {
    if (!periodLabel || periodLabel === "período") return "últimos 7 dias";
    if (/^últimos\s+/i.test(periodLabel)) return periodLabel;
    if (/^\d+\s+dias$/i.test(periodLabel)) return `últimos ${periodLabel}`;
    return periodLabel;
  })();

  const canEvaluate = hasIkigai && alignedPercent !== undefined;

  const interpret = () => {
    if (!canEvaluate) {
      return {
        label: "Não foi possível avaliar",
        tone: "muted" as const,
        summary: "Defina temas do grupo para gerar esta leitura de forma confiável.",
        meaning:
          "Sem temas definidos, o painel não tem uma referência clara para identificar conexões. Ao cadastrar temas, a leitura passa a refletir o que o grupo considera relevante.",
      };
    }

    const p = Math.max(0, Math.min(100, Math.round(alignedPercent)));

    if (p >= 50) {
      return {
        label: "Bom alinhamento",
        tone: "success" as const,
        summary: "As conversas estão, em geral, conectadas aos temas definidos neste período.",
        meaning:
          "O grupo tende a voltar aos temas do propósito com frequência. Se quiser refinar ainda mais, ajuste os temas para ficarem mais específicos e próximos do vocabulário real das pessoas.",
      };
    }

    if (p >= 20) {
      return {
        label: "Alinhamento moderado",
        tone: "warning" as const,
        summary: "Há conexões com os temas, mas uma parte relevante das conversas segue outros assuntos.",
        meaning:
          "O propósito aparece, mas compete com pautas paralelas do dia a dia. Isso pode ser natural; se a intenção é focar mais, revise os temas para refletirem melhor como o grupo fala.",
      };
    }

    return {
      label: "Baixo alinhamento",
      tone: "muted" as const,
      summary: "Poucas conversas tocaram nos temas definidos neste período.",
      meaning:
        "Esse resultado não indica problema. Pode significar que os temas estão genéricos, muito amplos ou distantes do cotidiano do grupo — e isso reduz a precisão da leitura.",
    };
  };

  const status = interpret();

  const toneClasses =
    status.tone === "success"
      ? "border-success/20 bg-success/10 text-success"
      : status.tone === "warning"
        ? "border-warning/25 bg-warning/10 text-warning"
        : "border-border bg-muted/40 text-muted-foreground";

  const data = [
    { eixo: "Alinhadas", valor: alignedPercent ?? 0 },
    { eixo: "Participação", valor: activePercent },
    { eixo: "Recorrência", valor: recurringPercent },
    { eixo: "Ritmo", valor: activeDaysPercent },
    { eixo: "Baixo esforço", valor: lowEffortPercent },
  ];

  const chartConfig = {
    valor: { label: "Percentual" },
  };

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <SectionHeader
        title="Alinhamento com o Propósito"
        subtitle={`Leitura interpretativa das conversas — ${periodText}`}
        helpText={helpText}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-secondary/20 p-4">
            <div className="flex items-start justify-between gap-3">
              <Badge className={toneClasses}>
                <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />
                {status.label}
              </Badge>
              {onOpenIkigai ? (
                <Button size="sm" variant="outline" onClick={onOpenIkigai}>
                  Gerenciar temas
                </Button>
              ) : null}
            </div>

            {isLoading ? (
              <div className="mt-3 space-y-2">
                <Skeleton className="h-4 w-11/12" />
                <Skeleton className="h-4 w-9/12" />
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                {status.summary}
              </p>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs font-medium text-muted-foreground">Percentual de alinhamento</div>
            {isLoading ? (
              <div className="mt-2 space-y-2">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-4 w-10/12" />
              </div>
            ) : (
              <div className="mt-2 space-y-2">
                <div className="text-3xl font-bold tabular-nums text-card-foreground">
                  {canEvaluate ? `${Math.round(alignedPercent)}%` : "—"}
                </div>
                <p className="text-sm text-muted-foreground">
                  {canEvaluate
                    ? `${Math.round(alignedPercent)}% das mensagens analisadas se conectam com os temas do grupo.`
                    : "Sem temas definidos, não há base para calcular este percentual."}
                </p>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-secondary/20 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
              <Info className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <span>O que isso significa?</span>
            </div>

            {isLoading ? (
              <div className="mt-3 space-y-2">
                <Skeleton className="h-4 w-11/12" />
                <Skeleton className="h-4 w-10/12" />
                <Skeleton className="h-4 w-8/12" />
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                {status.meaning}
              </p>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card/50 p-4">
            <div className="text-sm font-semibold text-card-foreground">Sobre esta leitura</div>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              <li>A leitura é baseada nos temas definidos para o grupo.</li>
              <li>Valores baixos não indicam problema por si só.</li>
              <li>Tema mal definido ou genérico reduz a precisão.</li>
            </ul>
          </div>
        </div>

        <div>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-[280px] w-full" />
              <Skeleton className="h-4 w-10/12" />
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-9/12" />
            </div>
          ) : !canEvaluate ? (
            <div className="rounded-xl border border-border bg-secondary/20 p-4">
              <div className="text-sm font-semibold text-card-foreground">Radar do período</div>
              <p className="mt-2 text-sm text-muted-foreground">
                Para visualizar o radar, defina temas do grupo. O gráfico ajuda a comparar dimensões, sem julgar qualidade.
              </p>
              {onOpenIkigai ? (
                <div className="mt-3">
                  <Button size="sm" variant="outline" onClick={onOpenIkigai}>
                    Gerenciar temas
                  </Button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="text-sm font-semibold text-card-foreground">Radar do período</div>
                <p className="mt-1 text-xs text-muted-foreground">Comparação em 5 dimensões (0 a 100)</p>
                <div className="mt-3">
                  <ChartContainer config={chartConfig} className="h-[260px] w-full">
                    <RadarChart data={data}>
                      <PolarGrid stroke="hsl(var(--border))" />
                      <PolarAngleAxis dataKey="eixo" tick={{ fontSize: 11 }} />
                      <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Radar
                        dataKey="valor"
                        stroke="hsl(var(--primary))"
                        fill="hsl(var(--primary))"
                        fillOpacity={0.14}
                      />
                    </RadarChart>
                  </ChartContainer>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card/50 p-4">
                <div className="text-sm font-semibold text-card-foreground">Como ler os eixos</div>
                <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <Target className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <div>
                      <div className="text-card-foreground font-medium">Alinhadas</div>
                      <div>Percentual de mensagens que se conectam com os temas do grupo.</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Users className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <div>
                      <div className="text-card-foreground font-medium">Participação</div>
                      <div>Quanto da base falou no período.</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Repeat className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <div>
                      <div className="text-card-foreground font-medium">Recorrência</div>
                      <div>Presença de pessoas que voltam a conversar em vários dias.</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Activity className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <div>
                      <div className="text-card-foreground font-medium">Ritmo</div>
                      <div>Consistência de atividade ao longo do período (menos picos, mais constância).</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Feather className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <div>
                      <div className="text-card-foreground font-medium">Baixo esforço</div>
                      <div>Sinais de conversa fluida (menos ruído e menos “custo” para participar).</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
