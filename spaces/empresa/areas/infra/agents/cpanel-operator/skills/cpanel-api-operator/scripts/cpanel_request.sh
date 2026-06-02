#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 3 ]; then
  echo "Uso: $0 <perfil> <metodo> <path> [curl_args...]" >&2
  exit 1
fi

profile="$1"
method="$2"
path="$3"
shift 3

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${script_dir}/load_profile.sh" "$profile"

base_url="${CPANEL_BASE_URL:-}"
username="${CPANEL_USERNAME:-}"
token="${CPANEL_API_TOKEN:-}"

if [ -z "$base_url" ] || [ -z "$username" ] || [ -z "$token" ]; then
  echo "Perfil '$profile' incompleto. Defina CPANEL_BASE_URL, CPANEL_USERNAME e CPANEL_API_TOKEN em .env.local ou no Keychain." >&2
  exit 1
fi

if [[ "$path" != /* ]]; then
  path="/$path"
fi

curl -sS \
  -X "$method" \
  -H "Authorization: cpanel $username:$token" \
  "${base_url}${path}" \
  "$@"
