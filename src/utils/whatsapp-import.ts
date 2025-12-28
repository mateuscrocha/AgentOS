import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { SAO_PAULO_TZ } from "@/lib/date";

export interface ParsedMessage {
  createdAtISO: string;
  senderPhone: string;
  text: string;
}

export interface ParseResult {
  messages: ParsedMessage[];
  errors: string[];
  periodFrom?: string;
  periodTo?: string;
}

const headerRegex = /^\[(\d{2}):(\d{2}),\s*(\d{2})\/(\d{2})\/(\d{4})\]\s+(.+?):\s*(.*)$/;

export function normalizePhoneE164(input: string): string {
  const raw = (input || "").trim();
  if (!raw) return "+55";
  const cleaned = raw.replace(/[\s\-()]/g, "");
  if (cleaned.startsWith("+")) {
    const digits = cleaned.replace(/[^+\d]/g, "");
    return digits || "+55";
  }
  const digits = cleaned.replace(/\D/g, "");
  return digits ? `+55${digits}` : "+55";
}

export async function sha256Hex(text: string): Promise<string> {
  const enc = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", enc);
  const bytes = Array.from(new Uint8Array(hash));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function parseWhatsAppExport(raw: string): ParseResult {
  const errors: string[] = [];
  const messages: ParsedMessage[] = [];
  if (!raw || !raw.trim()) {
    return { messages: [], errors: ["Bloco vazio" ] };
  }
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  let current: { hh: string; mm: string; dd: string; MM: string; yyyy: string; sender: string; content: string } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(headerRegex);
    if (m) {
      if (current) {
        const tsStr = `${current.yyyy}-${current.MM}-${current.dd}T${current.hh}:${current.mm}:00`;
        const dt = fromZonedTime(tsStr, SAO_PAULO_TZ);
        messages.push({
          createdAtISO: dt.toISOString(),
          senderPhone: normalizePhoneE164(current.sender),
          text: current.content,
        });
      }
      const hh = m[1];
      const mm = m[2];
      const dd = m[3];
      const MM = m[4];
      const yyyy = m[5];
      const sender = m[6];
      const content = m[7] || "";
      current = { hh, mm, dd, MM, yyyy, sender, content };
    } else {
      if (current) {
        current.content = current.content ? `${current.content}\n${line}` : line;
      } else if (line.trim()) {
        errors.push(`Linha ${i + 1}: formato inválido`);
      }
    }
  }

  if (current) {
    const tsStr = `${current.yyyy}-${current.MM}-${current.dd}T${current.hh}:${current.mm}:00`;
    const dt = fromZonedTime(tsStr, SAO_PAULO_TZ);
    messages.push({
      createdAtISO: dt.toISOString(),
      senderPhone: normalizePhoneE164(current.sender),
      text: current.content,
    });
  }

  if (messages.length > 0) {
    const times = messages.map((m) => new Date(m.createdAtISO).getTime());
    const min = new Date(Math.min(...times));
    const max = new Date(Math.max(...times));
    const periodFrom = formatInTimeZone(min, SAO_PAULO_TZ, "yyyy-MM-dd'T'HH:mm:ssXXX");
    const periodTo = formatInTimeZone(max, SAO_PAULO_TZ, "yyyy-MM-dd'T'HH:mm:ssXXX");
    return { messages, errors, periodFrom, periodTo };
  }

  return { messages, errors };
}

export function buildImportKey(groupId: string, senderPhone: string, createdAtISO: string, textHash: string): string {
  return `${groupId}:${senderPhone}:${createdAtISO}:${textHash}`;
}
