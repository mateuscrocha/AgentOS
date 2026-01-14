import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getAppUrl() {
  const envValue = (import.meta.env.VITE_APP_URL ?? "").trim();
  const runtimeOrigin = typeof window !== "undefined" ? window.location.origin : "";

  const base = (envValue || runtimeOrigin).trim().replace(/\/+$/, "");

  if (!base) {
    throw new Error("VITE_APP_URL não configurada e origem indisponível.");
  }

  return base;
}
