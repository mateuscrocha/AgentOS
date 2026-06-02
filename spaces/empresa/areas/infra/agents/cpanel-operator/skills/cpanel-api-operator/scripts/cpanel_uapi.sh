#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 3 ]; then
  echo "Uso: $0 <perfil> <module> <function> [curl_args...]" >&2
  exit 1
fi

profile="$1"
module="$2"
function_name="$3"
shift 3

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

"${script_dir}/cpanel_request.sh" \
  "$profile" \
  GET \
  "/execute/${module}/${function_name}" \
  "$@"
