#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SEARCH_DIR="$SCRIPT_DIR"
while [[ "$SEARCH_DIR" != "/" && ! -f "$SEARCH_DIR/KERNEL.md" ]]; do
  SEARCH_DIR="$(dirname "$SEARCH_DIR")"
done

if [[ ! -f "$SEARCH_DIR/KERNEL.md" ]]; then
  echo "Nao foi possivel localizar a raiz do AgentOS a partir de $SCRIPT_DIR" >&2
  exit 1
fi

ROOT_DIR="$SEARCH_DIR"
ENV_FILE="$ROOT_DIR/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Arquivo .env nao encontrado em $ROOT_DIR" >&2
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

: "${CPANEL_BASE_URL:?CPANEL_BASE_URL ausente no .env}"
: "${CPANEL_USER:?CPANEL_USER ausente no .env}"
: "${CPANEL_API_TOKEN:?CPANEL_API_TOKEN ausente no .env}"

if [[ $# -lt 1 ]]; then
  echo "Uso: $0 MODULO/FUNCAO [chave=valor ...]" >&2
  exit 1
fi

endpoint="$1"
shift

query=""
for pair in "$@"; do
  if [[ -n "$query" ]]; then
    query="${query}&"
  fi
  query="${query}${pair}"
done

url="${CPANEL_BASE_URL%/}/execute/${endpoint}"
if [[ -n "$query" ]]; then
  url="${url}?${query}"
fi

curl -sS \
  -H "Authorization: cpanel ${CPANEL_USER}:${CPANEL_API_TOKEN}" \
  "$url"
