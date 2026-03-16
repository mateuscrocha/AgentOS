import type { ReactNode } from "react";

type FilterBarRowProps = {
  desktopFilters: ReactNode;
  mobileTrigger: ReactNode;
  rightActions?: ReactNode;
};

export function FilterBarRow({ desktopFilters, mobileTrigger, rightActions }: FilterBarRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)]">
      <div className="hidden flex-wrap items-center gap-2 md:flex">{desktopFilters}</div>
      <div className="w-full md:hidden">{mobileTrigger}</div>
      {rightActions ? <div className="hidden items-center gap-2 md:flex">{rightActions}</div> : null}
    </div>
  );
}
