#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
infra_dir="$(cd "${script_dir}/../../../../.." && pwd)"
env_file="${infra_dir}/.env.local"

profile="${1:-principal}"

if [ -f "$env_file" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$env_file"
  set +a
fi

get_keychain_secret() {
  local account="$1"
  local service="$2"
  security find-generic-password -a "$account" -s "$service" -w 2>/dev/null || true
}

CPANEL_BASE_URL="${CPANEL_BASE_URL:-$(get_keychain_secret "$profile" "agentos-cpanel-base-url")}"
CPANEL_USERNAME="${CPANEL_USERNAME:-$(get_keychain_secret "$profile" "agentos-cpanel-username")}"
CPANEL_API_TOKEN="${CPANEL_API_TOKEN:-$(get_keychain_secret "$profile" "agentos-cpanel-token")}"
CPANEL_PASSWORD="${CPANEL_PASSWORD:-}"

export CPANEL_BASE_URL
export CPANEL_USERNAME
export CPANEL_API_TOKEN
export CPANEL_PASSWORD
