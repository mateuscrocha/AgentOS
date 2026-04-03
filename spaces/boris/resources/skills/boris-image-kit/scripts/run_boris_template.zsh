#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKDIR="$(pwd)"
PY="$WORKDIR/.venv-imagegen/bin/python"
CLI="${CODEX_HOME:-$HOME/.codex}/skills/imagegen/scripts/image_gen.py"
REF="$SKILL_DIR/../boris-image-agent/assets/boris-body-reference.png"

usage() {
  cat <<'EOF'
Uso:
  zsh "$CODEX_HOME/skills/boris-image-kit/scripts/run_boris_template.zsh" <prompt-file> <output-file> [size] [quality] [background]

Exemplos:
  zsh "$CODEX_HOME/skills/boris-image-kit/scripts/run_boris_template.zsh" \
    tmp/imagegen/prompts/boris-teste.txt \
    output/imagegen/boris/testes/thumbnail-01.png \
    1536x1024 \
    high

  zsh "$CODEX_HOME/skills/boris-image-kit/scripts/run_boris_template.zsh" \
    tmp/imagegen/prompts/boris-transparente.txt \
    output/imagegen/boris/testes/personagem-01.png \
    1024x1024 \
    high \
    transparent
EOF
}

if [[ $# -lt 2 ]]; then
  usage
  exit 1
fi

PROMPT_FILE="$1"
OUT_FILE="$2"
SIZE="${3:-1024x1536}"
QUALITY="${4:-high}"
BACKGROUND="${5:-}"

if [[ ! -f "$PROMPT_FILE" ]]; then
  echo "Prompt nao encontrado: $PROMPT_FILE" >&2
  exit 1
fi

if [[ ! -f "$REF" ]]; then
  echo "Referencia do Bóris nao encontrada: $REF" >&2
  exit 1
fi

if [[ ! -x "$PY" ]]; then
  echo "Python da .venv-imagegen nao encontrado ou nao executavel em: $PY" >&2
  exit 1
fi

mkdir -p "$(dirname "$OUT_FILE")"

CMD=(
  "$PY" "$CLI" edit
  --image "$REF"
  --prompt-file "$PROMPT_FILE"
  --size "$SIZE"
  --quality "$QUALITY"
  --input-fidelity high
  --output-format png
  --out "$OUT_FILE"
)

if [[ "$BACKGROUND" == "transparent" ]]; then
  CMD+=(--background transparent)
fi

"${CMD[@]}"
