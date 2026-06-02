#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 3 ]; then
  echo "Uso: $0 <perfil> <base_url> <username>" >&2
  exit 1
fi

profile="$1"
base_url="$2"
username="$3"

if [[ "$base_url" != https://* ]]; then
  echo "A base_url deve começar com https:// (ex.: https://host.exemplo.com:2083)" >&2
  exit 1
fi

read -r -s -p "Token da API do cPanel para o perfil '$profile': " token
echo

if [ -z "$token" ]; then
  echo "Token vazio. Operação cancelada." >&2
  exit 1
fi

security add-generic-password -U -a "$profile" -s "agentos-cpanel-base-url" -w "$base_url" >/dev/null
security add-generic-password -U -a "$profile" -s "agentos-cpanel-username" -w "$username" >/dev/null
security add-generic-password -U -a "$profile" -s "agentos-cpanel-token" -w "$token" >/dev/null

echo "Perfil '$profile' salvo no Keychain com sucesso."
