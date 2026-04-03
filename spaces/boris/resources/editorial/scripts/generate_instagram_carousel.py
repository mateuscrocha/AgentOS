#!/usr/bin/env python3

from __future__ import annotations

import os
from pathlib import Path
from textwrap import wrap
from xml.sax.saxutils import escape


WIDTH = 1080
HEIGHT = 1350
MARGIN_X = 88
TOP_Y = 130
BOTTOM_Y = 1180
BRAND = "BORIS"
ACCENT = "#E9FF66"
TEXT = "#F5F6F7"
TEXT_MUTED = "#BFC6D1"


SLIDES = [
    {
        "eyebrow": "POST TESTE",
        "title": [
            "O problema nao e",
            "falta de conversa.",
            "E falta de leitura.",
        ],
        "body": [],
        "footer": "Menos ruido, mais clareza",
    },
    {
        "eyebrow": "SINAL 1",
        "title": [
            "Tem grupo que fala",
            "o dia inteiro.",
        ],
        "body": [
            "Mesmo assim, ninguem consegue dizer",
            "o que realmente importou.",
        ],
        "footer": "Movimento sem sintese",
    },
    {
        "eyebrow": "SINAL 2",
        "title": [
            "Tem mensagem.",
            "Tem movimento.",
            "Tem atividade.",
        ],
        "body": [
            "Mas nao tem clareza.",
        ],
        "footer": "Volume nao e leitura",
    },
    {
        "eyebrow": "SEM LEITURA",
        "title": [
            "Os mesmos temas voltam.",
            "Os sinais passam batido.",
            "A decisao chega tarde.",
        ],
        "body": [],
        "footer": "O custo e silencioso",
    },
    {
        "eyebrow": "PONTO CENTRAL",
        "title": [
            "Ler tudo nao resolve.",
            "Entender o que",
            "importa resolve.",
        ],
        "body": [],
        "footer": "Leitura acionavel",
    },
    {
        "eyebrow": "CTA",
        "title": [
            "Seu grupo gera",
            "clareza ou so volume?",
        ],
        "body": [
            "Salve este post se isso acontece",
            "na sua operacao.",
        ],
        "footer": "BORIS",
    },
]


def bg_shapes(index: int) -> str:
    variants = [
        """
        <circle cx="920" cy="190" r="220" fill="#13314F" opacity="0.78"/>
        <circle cx="170" cy="1120" r="280" fill="#1D2540" opacity="0.95"/>
        <path d="M780 840C920 760 1010 680 1080 580V1350H570C600 1120 650 940 780 840Z" fill="#0C1930" opacity="0.85"/>
        """,
        """
        <circle cx="900" cy="320" r="250" fill="#1E315B" opacity="0.8"/>
        <circle cx="120" cy="170" r="170" fill="#202A47" opacity="0.8"/>
        <path d="M0 960C160 840 340 840 510 960C700 1090 860 1110 1080 1010V1350H0Z" fill="#0C1730" opacity="0.88"/>
        """,
        """
        <circle cx="840" cy="180" r="200" fill="#163C6A" opacity="0.7"/>
        <circle cx="260" cy="1090" r="320" fill="#1B2144" opacity="0.9"/>
        <rect x="650" y="740" width="520" height="700" rx="120" fill="#0C1A34" opacity="0.8"/>
        """,
    ]
    return variants[index % len(variants)]


def build_text_lines(lines: list[str], x: int, y: int, size: int, color: str, weight: int, line_gap: int) -> tuple[str, int]:
    parts: list[str] = []
    cursor = y
    for line in lines:
        parts.append(
            f'<text x="{x}" y="{cursor}" fill="{color}" '
            f'font-family="Avenir Next, Avenir, Helvetica, Arial, sans-serif" '
            f'font-size="{size}" font-weight="{weight}" letter-spacing="-0.8">{escape(line)}</text>'
        )
        cursor += line_gap
    return "\n".join(parts), cursor


def body_paragraph(lines: list[str], x: int, y: int) -> tuple[str, int]:
    out: list[str] = []
    cursor = y
    for line in lines:
        wrapped = wrap(line, width=28) or [line]
        for sub in wrapped:
            out.append(
                f'<text x="{x}" y="{cursor}" fill="{TEXT_MUTED}" '
                f'font-family="Avenir Next, Avenir, Helvetica, Arial, sans-serif" '
                f'font-size="42" font-weight="500" letter-spacing="-0.4">{escape(sub)}</text>'
            )
            cursor += 56
        cursor += 18
    return "\n".join(out), cursor


def svg_for_slide(index: int, slide: dict[str, list[str] | str]) -> str:
    eyebrow = escape(str(slide["eyebrow"]))
    title_svg, next_y = build_text_lines(slide["title"], MARGIN_X, TOP_Y + 170, 82, TEXT, 800, 96)
    body_svg, _ = body_paragraph(slide["body"], MARGIN_X, next_y + 35)
    footer = escape(str(slide["footer"]))
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{WIDTH}" height="{HEIGHT}" viewBox="0 0 {WIDTH} {HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#09111F"/>
      <stop offset="55%" stop-color="#101B33"/>
      <stop offset="100%" stop-color="#182640"/>
    </linearGradient>
  </defs>
  <rect width="{WIDTH}" height="{HEIGHT}" fill="url(#bg)"/>
  {bg_shapes(index)}
  <rect x="{MARGIN_X}" y="{TOP_Y}" width="230" height="44" rx="22" fill="{ACCENT}" opacity="0.96"/>
  <text x="{MARGIN_X + 24}" y="{TOP_Y + 31}" fill="#0B1020"
    font-family="Avenir Next, Avenir, Helvetica, Arial, sans-serif"
    font-size="24" font-weight="800" letter-spacing="1.4">{eyebrow}</text>
  {title_svg}
  {body_svg}
  <line x1="{MARGIN_X}" y1="{BOTTOM_Y}" x2="{WIDTH - MARGIN_X}" y2="{BOTTOM_Y}" stroke="#344055" stroke-width="2" opacity="0.9"/>
  <text x="{MARGIN_X}" y="{BOTTOM_Y + 54}" fill="{ACCENT}"
    font-family="Avenir Next, Avenir, Helvetica, Arial, sans-serif"
    font-size="30" font-weight="800" letter-spacing="3">{BRAND}</text>
  <text x="{WIDTH - MARGIN_X}" y="{BOTTOM_Y + 54}" text-anchor="end" fill="{TEXT_MUTED}"
    font-family="Avenir Next, Avenir, Helvetica, Arial, sans-serif"
    font-size="28" font-weight="600" letter-spacing="0.4">{footer}</text>
</svg>
"""


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    out_dir = root / "editorial" / "assets" / "teste-piloto-problema-nao-e-falta-de-conversa"
    out_dir.mkdir(parents=True, exist_ok=True)

    for idx, slide in enumerate(SLIDES, start=1):
        svg_path = out_dir / f"slide-{idx:02d}.svg"
        svg_path.write_text(svg_for_slide(idx - 1, slide), encoding="utf-8")

    print(out_dir)


if __name__ == "__main__":
    main()
