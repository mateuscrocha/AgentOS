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

export function isProbablyPhone(value?: string | null) {
  const v = (value || "").trim();
  if (!v) return false;
  if (/[A-Za-zÀ-ÿ]/.test(v)) return false;
  const digits = v.replace(/\D/g, "");
  return digits.length >= 8;
}

export function formatPhoneE164BR(input?: string | null) {
  const raw = (input || "").trim();
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  const d = digits.startsWith("55") ? digits.slice(2) : digits;
  if (!d) return raw;
  const ddd = d.slice(0, 2);
  const rest = d.slice(2);
  if (rest.length === 8) {
    return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  }
  if (rest.length === 9) {
    return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
  }
  return raw;
}

export function getInitialsFromName(name?: string | null) {
  const n = (name || "").trim();
  if (!n) return "";
  const parts = n.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || "";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] || "" : "";
  return (a + b).toUpperCase();
}

export function getPhoneFallback(phone?: string | null) {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "";
  const d = digits.startsWith("55") ? digits.slice(2) : digits;
  return d.slice(-2);
}

export function buildPagination(current: number, total: number): Array<number | "ellipsis"> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set<number>();
  pages.add(1);
  pages.add(total);
  for (let p = current - 1; p <= current + 1; p++) {
    if (p >= 1 && p <= total) pages.add(p);
  }
  if (current <= 3) {
    pages.add(2);
    pages.add(3);
    pages.add(4);
  }
  if (current >= total - 2) {
    pages.add(total - 1);
    pages.add(total - 2);
    pages.add(total - 3);
  }

  const sorted = Array.from(pages)
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b);
  const out: Array<number | "ellipsis"> = [];
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i] as number;
    const prev = sorted[i - 1];
    if (i > 0 && prev && p - prev > 1) out.push("ellipsis");
    out.push(p);
  }
  return out;
}
