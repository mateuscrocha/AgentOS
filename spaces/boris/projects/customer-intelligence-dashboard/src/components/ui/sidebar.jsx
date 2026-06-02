import * as React from "react";

import { cn } from "@/lib/utils";

const SidebarContext = React.createContext(null);

function useSidebar() {
  const context = React.useContext(SidebarContext);

  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.");
  }

  return context;
}

function SidebarProvider({ children, className }) {
  const value = React.useMemo(
    () => ({
      collapsible: "none"
    }),
    []
  );

  return (
    <SidebarContext.Provider value={value}>
      <div className={cn("flex min-h-screen w-full gap-4", className)}>{children}</div>
    </SidebarContext.Provider>
  );
}

function Sidebar({ children, className, inset = false }) {
  return (
    <aside
      className={cn(
        "w-full shrink-0 xl:sticky xl:top-4 xl:h-[calc(100vh-2rem)] xl:w-[268px]",
        inset && "xl:w-[280px]",
        className
      )}
    >
      <div className="flex h-full flex-col rounded-[1.6rem] border border-white/80 bg-white/94 p-5 shadow-[0_24px_70px_-42px_rgba(29,34,28,0.42)]">
        {children}
      </div>
    </aside>
  );
}

function SidebarHeader({ children, className }) {
  return <div className={cn("flex flex-col gap-4 pb-5", className)}>{children}</div>;
}

function SidebarContent({ children, className }) {
  return <div className={cn("flex min-h-0 flex-1 flex-col gap-5 pt-5", className)}>{children}</div>;
}

function SidebarFooter({ children, className }) {
  return <div className={cn("mt-auto", className)}>{children}</div>;
}

function SidebarGroup({ children, className }) {
  return <div className={cn("flex flex-col gap-3", className)}>{children}</div>;
}

function SidebarGroupLabel({ children, className }) {
  return (
    <p className={cn("text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground", className)}>
      {children}
    </p>
  );
}

function SidebarGroupContent({ children, className }) {
  return <div className={cn("flex flex-col gap-2", className)}>{children}</div>;
}

function SidebarMenu({ children, className }) {
  return <div className={cn("grid gap-2", className)}>{children}</div>;
}

function SidebarMenuItem({ children, className }) {
  return <div className={cn(className)}>{children}</div>;
}

const SidebarMenuButton = React.forwardRef(({ className, isActive, children, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "flex w-full items-center justify-between gap-3 rounded-[1rem] border px-4 py-3 text-left transition",
      isActive
        ? "border-primary/25 bg-primary text-primary-foreground shadow-[0_18px_40px_-30px_color-mix(in_oklch,var(--primary)_45%,transparent)]"
        : "border-border bg-secondary/35 text-foreground hover:border-primary/20 hover:bg-white",
      className
    )}
    {...props}
  >
    {children}
  </button>
));
SidebarMenuButton.displayName = "SidebarMenuButton";

function SidebarInset({ children, className }) {
  return <main className={cn("min-w-0 flex-1 py-1", className)}>{children}</main>;
}

export {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  useSidebar
};
