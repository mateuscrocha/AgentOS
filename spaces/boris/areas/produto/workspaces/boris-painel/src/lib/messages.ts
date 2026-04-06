export function translateMessageType(type: string): string {
  const map: Record<string, string> = {
    text: "Texto",
    image: "Imagem",
    audio: "Áudio",
    video: "Vídeo",
    document: "Documento",
    sticker: "Figurinha",
    location: "Localização",
    poll: "Enquete",
    poll_vote: "Voto",
    system: "Sistema",
  };

  return map[type] || type;
}

export function extractLinkDomains(text: string, limit = 2): string[] {
  const raw = (text || "").toString();
  const rx = /(https?:\/\/[^\s)\]}>,]+)/gi;
  const out: string[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = rx.exec(raw)) !== null) {
    const candidate = (match[1] || "").replace(/[),.;:]+$/g, "");
    try {
      const hostname = new URL(candidate).hostname.replace(/^www\./i, "");
      if (!hostname) continue;
      if (seen.has(hostname)) continue;
      seen.add(hostname);
      out.push(hostname);
      if (out.length >= limit) break;
    } catch {
      continue;
    }
  }

  return out;
}
