#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 || $# -gt 3 ]]; then
  echo "Uso: $0 SUBDOMINIO DOMINIO_RAIZ [DIRREL]" >&2
  exit 1
fi

subdomain="$1"
rootdomain="$2"
dirrel="${3:-${subdomain}}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$SCRIPT_DIR/cpanel_uapi.sh" \
  "SubDomain/addsubdomain" \
  "domain=${subdomain}" \
  "rootdomain=${rootdomain}" \
  "dir=${dirrel}"
