import { BarChart3, LucideIcon } from "lucide-react";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { type MetricHelpContent } from "@/components/ui/metric-help";
import { buildMetricHelpFallback } from "@/components/ui/metric-help-fallback";

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  helpText?: string;
  help?: MetricHelpContent;
  valueClassName?: string;
  trend?: {
    value: number;
    label?: string;
    isAbsolute?: boolean; // For absolute change display (+3 instead of +3%)
  };
  isLoading?: boolean;
  className?: string;
}

export function KpiCard({ 
  title, 
  value, 
  subtitle,
  icon: Icon, 
  helpText,
  help,
  valueClassName,
  trend, 
  isLoading,
  className 
}: KpiCardProps) {
  const resolvedHelp = help ?? buildMetricHelpFallback(title, helpText);

  const formatTrendValue = () => {
    if (!trend) return undefined;
    const prefix = trend.value > 0 ? "+" : "";
    const suffix = trend.isAbsolute ? "" : "%";
    const label = trend.label ? ` ${trend.label}` : "";
    return `${prefix}${trend.value}${suffix}${label}`;
  };

  return (
    <StatsCard
      title={title}
      value={value}
      help={resolvedHelp}
      change={formatTrendValue()}
      changeType={
        !trend ? "neutral" : trend.value > 0 ? "positive" : trend.value < 0 ? "negative" : "neutral"
      }
      icon={Icon ?? BarChart3}
      description={subtitle}
      isLoading={isLoading}
      variant="kpi"
      className={className}
      valueClassName={valueClassName}
    />
  );
}
