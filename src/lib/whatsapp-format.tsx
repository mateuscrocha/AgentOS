import { type ReactNode } from "react";

type Marker = "*" | "_" | "~";

function isMarker(ch: string): ch is Marker {
  return ch === "*" || ch === "_" || ch === "~";
}

function wrap(marker: Marker, key: string, children: ReactNode[]) {
  if (marker === "*") return <strong key={key}>{children}</strong>;
  if (marker === "_") return <em key={key}>{children}</em>;
  return <s key={key}>{children}</s>;
}

type Block =
  | { type: "paragraph"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "code"; content: string };

function splitFencedCodeBlocks(input: string): Array<{ type: "text"; value: string } | { type: "code"; value: string }> {
  const text = (input ?? "").toString();
  const out: Array<{ type: "text"; value: string } | { type: "code"; value: string }> = [];
  let i = 0;

  while (i < text.length) {
    const start = text.indexOf("```", i);
    if (start === -1) {
      out.push({ type: "text", value: text.slice(i) });
      break;
    }

    if (start > i) {
      out.push({ type: "text", value: text.slice(i, start) });
    }

    const end = text.indexOf("```", start + 3);
    if (end === -1) {
      out.push({ type: "text", value: text.slice(start) });
      break;
    }

    const codeRaw = text.slice(start + 3, end);
    const code = codeRaw.replace(/^\n/, "").replace(/\n$/, "");
    out.push({ type: "code", value: code });
    i = end + 3;
  }

  return out;
}

function parseBlocks(input: string): Block[] {
  const chunks = splitFencedCodeBlocks(input);
  const blocks: Block[] = [];

  const flushParagraph = (lines: string[]) => {
    const raw = lines.join("\n").trimEnd();
    if (!raw.trim()) return;
    blocks.push({ type: "paragraph", text: raw });
  };

  for (const chunk of chunks) {
    if (chunk.type === "code") {
      blocks.push({ type: "code", content: chunk.value });
      continue;
    }

    const lines = chunk.value.split(/\r?\n/);
    let paragraphLines: string[] = [];
    let listType: "ul" | "ol" | null = null;
    let listItems: string[] = [];

    const flushList = () => {
      if (!listType || listItems.length === 0) return;
      if (listType === "ul") blocks.push({ type: "ul", items: listItems });
      if (listType === "ol") blocks.push({ type: "ol", items: listItems });
      listType = null;
      listItems = [];
    };

    for (const line of lines) {
      const isBlank = !line.trim();
      if (isBlank) {
        flushList();
        flushParagraph(paragraphLines);
        paragraphLines = [];
        continue;
      }

      const ulMatch = line.match(/^\s*(?:[-•])\s+(.*)$/);
      const olMatch = line.match(/^\s*(?:\d+)\.\s+(.*)$/);

      if (ulMatch?.[1]) {
        flushParagraph(paragraphLines);
        paragraphLines = [];
        if (listType && listType !== "ul") flushList();
        listType = "ul";
        listItems.push(ulMatch[1]);
        continue;
      }

      if (olMatch?.[1]) {
        flushParagraph(paragraphLines);
        paragraphLines = [];
        if (listType && listType !== "ol") flushList();
        listType = "ol";
        listItems.push(olMatch[1]);
        continue;
      }

      flushList();
      paragraphLines.push(line);
    }

    flushList();
    flushParagraph(paragraphLines);
  }

  return blocks;
}

function linkify(text: string, keyBase: string): Array<string | JSX.Element> {
  const parts = (text || "").split(/(https?:\/\/[^\s)\]}>,]+)/gi);
  const out: Array<string | JSX.Element> = [];
  for (let idx = 0; idx < parts.length; idx++) {
    const part = parts[idx] || "";
    if (/^https?:\/\//i.test(part)) {
      const href = part.replace(/[),.;:]+$/g, "");
      out.push(
        <a
          key={`${keyBase}-u-${idx}-${href}`}
          href={href}
          target="_blank"
          rel="noreferrer"
          className="text-primary underline underline-offset-2 break-all"
        >
          {href}
        </a>
      );
    } else {
      out.push(part);
    }
  }
  return out;
}

function renderInline(text: string, keyBase: string): ReactNode[] {
  const raw = (text ?? "").toString();
  if (!raw) return [""];

  const out: ReactNode[] = [];
  let cursor = 0;
  let codeId = 0;
  const rx = /`([^`]+?)`/g;
  let m: RegExpExecArray | null;

  while ((m = rx.exec(raw)) !== null) {
    const idx = m.index ?? 0;
    if (idx > cursor) {
      const before = raw.slice(cursor, idx);
      const parts = linkify(before, `${keyBase}-${cursor}`);
      out.push(...applyWhatsAppStylesToParts(parts));
    }
    const code = m[1] ?? "";
    out.push(
      <code
        key={`${keyBase}-code-${codeId++}`}
        className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]"
      >
        {code}
      </code>
    );
    cursor = idx + m[0].length;
  }

  if (cursor < raw.length) {
    const rest = raw.slice(cursor);
    const parts = linkify(rest, `${keyBase}-${cursor}`);
    out.push(...applyWhatsAppStylesToParts(parts));
  }

  return out;
}

export function formatWhatsAppRichText(input: string): JSX.Element {
  const blocks = parseBlocks(input);
  return (
    <div className="space-y-3">
      {blocks.map((b, idx) => {
        if (b.type === "code") {
          return (
            <pre
              key={`wa-block-${idx}`}
              className="rounded-lg border border-border bg-muted/20 p-3 overflow-x-auto"
            >
              <code className="whitespace-pre font-mono text-[12px] text-card-foreground">{b.content}</code>
            </pre>
          );
        }

        if (b.type === "ul") {
          return (
            <ul key={`wa-block-${idx}`} className="list-disc pl-5 space-y-1">
              {b.items.map((item, itemIdx) => (
                <li key={`wa-li-${idx}-${itemIdx}`} className="break-words">
                  {renderInline(item, `wa-ul-${idx}-${itemIdx}`)}
                </li>
              ))}
            </ul>
          );
        }

        if (b.type === "ol") {
          return (
            <ol key={`wa-block-${idx}`} className="list-decimal pl-5 space-y-1">
              {b.items.map((item, itemIdx) => (
                <li key={`wa-li-${idx}-${itemIdx}`} className="break-words">
                  {renderInline(item, `wa-ol-${idx}-${itemIdx}`)}
                </li>
              ))}
            </ol>
          );
        }

        return (
          <p key={`wa-block-${idx}`} className="whitespace-pre-wrap break-words leading-relaxed">
            {renderInline(b.text, `wa-p-${idx}`)}
          </p>
        );
      })}
    </div>
  );
}

export function formatWhatsAppStyles(input: string): ReactNode[] {
  const text = (input ?? "").toString();
  const stack: Array<{ marker: Marker | null; children: ReactNode[] }> = [{ marker: null, children: [] }];
  let buf = "";
  let keyId = 0;

  const flush = () => {
    if (!buf) return;
    stack[stack.length - 1]?.children.push(buf);
    buf = "";
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i] as string;
    if (!isMarker(ch)) {
      buf += ch;
      continue;
    }

    flush();

    const top = stack[stack.length - 1];
    if (top?.marker === ch) {
      const frame = stack.pop();
      if (!frame) continue;
      const el = wrap(ch, `wa-${keyId++}`, frame.children);
      stack[stack.length - 1]?.children.push(el);
      continue;
    }

    stack.push({ marker: ch, children: [] });
  }

  flush();

  while (stack.length > 1) {
    const frame = stack.pop();
    if (!frame?.marker) continue;
    stack[stack.length - 1]?.children.push(frame.marker, ...frame.children);
  }

  return stack[0]?.children ?? [];
}

export function applyWhatsAppStylesToParts(parts: Array<string | ReactNode>): ReactNode[] {
  const out: ReactNode[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      out.push(...formatWhatsAppStyles(part));
    } else {
      out.push(part);
    }
  }
  return out;
}

export function renderWhatsappToReact(rawText: string): JSX.Element {
  return formatWhatsAppRichText(rawText);
}
