export function normalizePhoneE164Admin(phone: string): string {
  const raw = (phone || "").trim();
  if (!raw) return "";
  if (raw.startsWith("+")) {
    return raw.replace(/\s+/g, "");
  }
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55") && digits.length >= 10) {
    return "+" + digits;
  }
  return "+55" + digits;
}

