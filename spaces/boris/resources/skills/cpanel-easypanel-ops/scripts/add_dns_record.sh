#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 4 || $# -gt 5 ]]; then
  echo "Uso: $0 ZONA HOST TIPO DESTINO [TTL]" >&2
  exit 1
fi

zone="$1"
host="$2"
record_type="$(printf '%s' "$3" | tr '[:lower:]' '[:upper:]')"
target="$4"
ttl="${5:-14400}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

case "$record_type" in
  A)
    "$SCRIPT_DIR/cpanel_api2.sh" \
      "ZoneEdit" \
      "add_zone_record" \
      "domain=${zone}" \
      "name=${host}" \
      "type=A" \
      "address=${target}" \
      "ttl=${ttl}" \
      "class=IN"
    ;;
  CNAME)
    "$SCRIPT_DIR/cpanel_api2.sh" \
      "ZoneEdit" \
      "add_zone_record" \
      "domain=${zone}" \
      "name=${host}" \
      "type=CNAME" \
      "cname=${target}" \
      "ttl=${ttl}" \
      "class=IN"
    ;;
  *)
    echo "Tipo nao suportado: ${record_type}. Use A ou CNAME." >&2
    exit 1
    ;;
esac
