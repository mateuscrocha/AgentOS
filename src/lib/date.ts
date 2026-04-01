import { fromZonedTime } from "date-fns-tz";

export const SAO_PAULO_TZ = "America/Sao_Paulo";
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDateInput(input: string | Date): Date {
  if (input instanceof Date) return input;
  if (DATE_ONLY_RE.test(input)) {
    return fromZonedTime(`${input}T12:00:00`, SAO_PAULO_TZ);
  }
  return new Date(input);
}

export function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

export function formatDateKeySP(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: SAO_PAULO_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function formatDateTickBR(input: string | Date): string {
  const d = parseDateInput(input);
  return d.toLocaleDateString("pt-BR", { timeZone: SAO_PAULO_TZ, day: "2-digit", month: "2-digit" });
}

export function formatDateSimpleBR(input: string | Date): string {
  const d = parseDateInput(input);
  return d.toLocaleDateString("pt-BR", { timeZone: SAO_PAULO_TZ, day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatDateDescriptiveBR(input: string | Date): string {
  const d = parseDateInput(input);
  return d.toLocaleDateString("pt-BR", { timeZone: SAO_PAULO_TZ, day: "2-digit", month: "long", year: "numeric" });
}

export function getHourSP(dateStr: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: SAO_PAULO_TZ }).formatToParts(new Date(dateStr));
  const hour = parts.find(p => p.type === "hour")?.value;
  return hour ? parseInt(hour, 10) : new Date(dateStr).getUTCHours();
}

export function formatPeriodRangeBR(from: Date, to: Date): string {
  const a = formatDateSimpleBR(from);
  const b = formatDateSimpleBR(to);
  return `${a} a ${b}`;
}

export function formatDateTimeBR(input: string | Date): string {
  const d = parseDateInput(input);
  return new Intl.DateTimeFormat("pt-BR", { timeZone: SAO_PAULO_TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(d);
}

export function formatDateTimeSecondsBR(input: string | Date): string {
  const d = parseDateInput(input);
  return new Intl.DateTimeFormat("pt-BR", { timeZone: SAO_PAULO_TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(d);
}
