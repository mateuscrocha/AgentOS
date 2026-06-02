#!/bin/zsh

set -euo pipefail

if [[ $# -lt 6 ]]; then
  echo "Uso: $0 --profile <perfil> --number <numero> --text <texto>" >&2
  exit 1
fi

profile=""
number=""
text=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile)
      profile="${2:-}"
      shift 2
      ;;
    --number)
      number="${2:-}"
      shift 2
      ;;
    --text)
      text="${2:-}"
      shift 2
      ;;
    *)
      echo "Argumento desconhecido: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$profile" || -z "$number" || -z "$text" ]]; then
  echo "Os argumentos --profile, --number e --text são obrigatórios." >&2
  exit 1
fi

# Converte sequências literais '\n' em quebras de linha reais antes do envio.
newline=$'\n'
text=${text//\\n/${newline}}

exec /Users/eu.rochamateus/.codex/skills/evolution-whatsapp-sender/scripts/send_message.sh \
  --profile "$profile" \
  --number "$number" \
  --text "$text"
