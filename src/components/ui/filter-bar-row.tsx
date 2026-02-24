import type { ReactNode } from "react";

type FilterBarRowProps = {
  desktopFilters: ReactNode;
  mobileTrigger: ReactNode;
  rightActions?: ReactNode;
};

export function FilterBarRow({ desktopFilters, mobileTrigger, rightActions }: FilterBarRowProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="hidden md:flex flex-wrap items-center gap-2">{desktopFilters}</div>
      <div className="md:hidden w-full">{mobileTrigger}</div>
      {rightActions ? <div className="hidden md:flex items-center gap-2">{rightActions}</div> : null}
    </div>
  );
}
