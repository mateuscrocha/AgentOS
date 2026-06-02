#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Uso: $0 <perfil>" >&2
  exit 1
fi

profile="$1"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${script_dir}/load_profile.sh" "$profile"

base_url="${CPANEL_BASE_URL:-}"
username="${CPANEL_USERNAME:-}"
token_status="ausente"
password_status="ausente"

[ -n "${CPANEL_API_TOKEN:-}" ] && token_status="presente"
[ -n "${CPANEL_PASSWORD:-}" ] && password_status="presente"

printf 'perfil=%s\nbase_url=%s\nusername=%s\napi_token=%s\npassword=%s\n' \
  "$profile" "$base_url" "$username" "$token_status" "$password_status"
