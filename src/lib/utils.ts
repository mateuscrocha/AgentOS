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

export type MemberAccessLevel = "superadmin" | "admin" | "member";

export function getMemberAccessLevel(m: { is_super_admin?: boolean | null; is_admin?: boolean | null }): MemberAccessLevel {
  if (m.is_super_admin) return "superadmin";
  if (m.is_admin) return "admin";
  return "member";
}

export function isMemberAdmin(m: { is_super_admin?: boolean | null; is_admin?: boolean | null }): boolean {
  const level = getMemberAccessLevel(m);
  return level === "superadmin" || level === "admin";
}

export function isMemberSuperAdmin(m: { is_super_admin?: boolean | null }): boolean {
  return !!m.is_super_admin;
}
