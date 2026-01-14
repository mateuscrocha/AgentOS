import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

const DEFAULT_APP_URL = "http://localhost:8080";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getAppUrl() {
  const envValue = (process.env.APP_URL ?? "").trim();
  return (envValue || DEFAULT_APP_URL).replace(/\/+$/, "");
}
