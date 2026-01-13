import { describe, expect, it } from "vitest";
import { isValidElement, type ReactNode } from "react";
import { applyWhatsAppStylesToParts, formatWhatsAppRichText, formatWhatsAppStyles } from "./whatsapp-format";

function serialize(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(serialize).join("");
  if (isValidElement(node)) {
    const type = typeof node.type === "string" ? node.type : "component";
    const children = (node.props as any)?.children as ReactNode;
    return `<${type}>${serialize(children)}</${type}>`;
  }
  return "";
}

function serializeNodes(nodes: ReactNode[]): string {
  return nodes.map(serialize).join("");
}

describe("formatWhatsAppStyles", () => {
  it("converte *texto* para strong", () => {
    expect(serializeNodes(formatWhatsAppStyles("*texto*"))).toBe("<strong>texto</strong>");
  });

  it("converte _texto_ para em", () => {
    expect(serializeNodes(formatWhatsAppStyles("_texto_"))).toBe("<em>texto</em>");
  });

  it("converte ~texto~ para s", () => {
    expect(serializeNodes(formatWhatsAppStyles("~texto~"))).toBe("<s>texto</s>");
  });

  it("mantém hierarquia em *_texto_*", () => {
    expect(serializeNodes(formatWhatsAppStyles("*_texto_*"))).toBe("<strong><em>texto</em></strong>");
  });

  it("não altera mensagem sem formatação", () => {
    expect(serializeNodes(formatWhatsAppStyles("sem formatacao"))).toBe("sem formatacao");
  });

  it("preserva espaços em branco", () => {
    expect(serializeNodes(formatWhatsAppStyles("* texto *"))).toBe("<strong> texto </strong>");
  });

  it("mantém caracteres especiais", () => {
    expect(serializeNodes(formatWhatsAppStyles("*ação* _coração_ ~não~"))).toBe(
      "<strong>ação</strong> <em>coração</em> <s>não</s>"
    );
  });

  it("suporta múltiplas formatações na mesma linha", () => {
    expect(serializeNodes(formatWhatsAppStyles("*a* e _b_ e ~c~"))).toBe(
      "<strong>a</strong> e <em>b</em> e <s>c</s>"
    );
  });
});

describe("formatWhatsAppRichText", () => {
  it("renderiza inline code com backticks", () => {
    expect(serialize(formatWhatsAppRichText("Use `npm run dev` agora"))).toContain("<code>npm run dev</code>");
  });

  it("renderiza bloco de código com triple backticks", () => {
    expect(serialize(formatWhatsAppRichText("```\nconst a = 1\n```"))).toBe(
      "<div><pre><code>const a = 1</code></pre></div>"
    );
  });

  it("renderiza lista não ordenada com - e •", () => {
    expect(serialize(formatWhatsAppRichText("- item 1\n• item 2"))).toBe("<div><ul><li>item 1</li><li>item 2</li></ul></div>");
  });

  it("renderiza lista ordenada com 1.", () => {
    expect(serialize(formatWhatsAppRichText("1. primeiro\n2. segundo"))).toBe(
      "<div><ol><li>primeiro</li><li>segundo</li></ol></div>"
    );
  });
});

describe("applyWhatsAppStylesToParts", () => {
  it("aplica formatação apenas em partes string", () => {
    const parts: Array<string | ReactNode> = [
      "*oi* ",
      <a key="x" href="https://example.com">https://example.com</a>,
      " _tchau_",
    ];

    const out = applyWhatsAppStylesToParts(parts);
    expect(serializeNodes(out)).toBe(
      "<strong>oi</strong> <a>https://example.com</a> <em>tchau</em>"
    );
  });
});
