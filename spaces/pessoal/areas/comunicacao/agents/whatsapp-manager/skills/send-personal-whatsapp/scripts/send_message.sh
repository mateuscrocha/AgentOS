#!/bin/zsh

set -euo pipefail

SCRIPT_DIR="${0:A:h}"
WORKSPACE="${SCRIPT_DIR}/../../../../../workspaces/evolution-api-agent"
WORKSPACE="${WORKSPACE:A}"
CACHE_DIR="$WORKSPACE/.cache/message-rate-limit"
HISTORY_DIR="$WORKSPACE/.cache/message-history"
MAX_ATTEMPTS=2

profile=""
number=""
name=""
text=""
media=""
caption=""
mediatype="image"
force_send="0"

read_env_value() {
  local key="$1"
  local fallback="${2:-}"
  local env_file="$WORKSPACE/.env"

  if [[ ! -f "$env_file" ]]; then
    printf '%s\n' "$fallback"
    return
  fi

  local line
  line=$(grep -E "^${key}=" "$env_file" | tail -n 1 || true)

  if [[ -z "$line" ]]; then
    printf '%s\n' "$fallback"
    return
  fi

  local value="${line#*=}"
  value="${value%\"}"
  value="${value#\"}"
  value="${value%\'}"
  value="${value#\'}"
  printf '%s\n' "${value:-$fallback}"
}

normalize_profile() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/_/g'
}

get_profile_prefix() {
  local normalized_profile="$1"

  case "$normalized_profile" in
    pessoal|mateus|mateus_pessoal)
      printf '%s\n' "EVOLUTION_PROFILE_PESSOAL"
      ;;
    boris|boris_suporte|suporte)
      printf '%s\n' "EVOLUTION_PROFILE_BORIS_SUPORTE"
      ;;
    *)
      printf '%s\n' ""
      ;;
  esac
}

get_profile_instance() {
  local normalized_profile="$1"
  local profile_prefix
  profile_prefix=$(get_profile_prefix "$normalized_profile")

  if [[ -z "$profile_prefix" ]]; then
    echo "Perfil desconhecido para envio: $profile" >&2
    exit 1
  fi

  local instance
  instance=$(read_env_value "${profile_prefix}_INSTANCE" "")

  if [[ -z "$instance" ]]; then
    echo "Instancia nao configurada para o perfil '$profile'." >&2
    exit 1
  fi

  printf '%s\n' "$instance"
}

read_interval_setting() {
  local profile_prefix="$1"
  local scope="$2"
  local bound="$3"
  local fallback="$4"

  if [[ -n "$profile_prefix" ]]; then
    read_env_value "${profile_prefix}_${scope}_${bound}_INTERVAL_SECONDS" \
      "$(read_env_value "EVOLUTION_MESSAGE_${scope}_${bound}_INTERVAL_SECONDS" "$fallback")"
    return
  fi

  read_env_value "EVOLUTION_MESSAGE_${scope}_${bound}_INTERVAL_SECONDS" "$fallback"
}

read_duplicate_setting() {
  local profile_prefix="$1"
  local setting_name="$2"
  local fallback="$3"

  if [[ -n "$profile_prefix" ]]; then
    read_env_value "${profile_prefix}_${setting_name}" \
      "$(read_env_value "EVOLUTION_${setting_name}" "$fallback")"
    return
  fi

  read_env_value "EVOLUTION_${setting_name}" "$fallback"
}

random_between() {
  local min_value="$1"
  local max_value="$2"

  if (( max_value <= min_value )); then
    printf '%s\n' "$min_value"
    return
  fi

  printf '%s\n' $((min_value + RANDOM % (max_value - min_value + 1)))
}

get_recipient_key() {
  if [[ -n "$number" ]]; then
    printf '%s\n' "number:$number"
    return
  fi

  printf '%s\n' "name:$name"
}

safe_key_fragment() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9._-]/_/g'
}

get_history_file() {
  local normalized_profile="$1"
  local recipient_key="$2"
  mkdir -p "$HISTORY_DIR"
  printf '%s/%s__%s.log\n' "$HISTORY_DIR" "$normalized_profile" "$(safe_key_fragment "$recipient_key")"
}

get_payload_signature() {
  local mode="text"
  local body="$text"

  if [[ -n "$media" ]]; then
    mode="media"
    body="${media}|${caption}|${mediatype}"
  fi

  printf '%s' "${mode}|${body}" | shasum -a 256 | awk '{print $1}'
}

get_duplicate_window_hours() {
  local normalized_profile="$1"
  local profile_prefix
  profile_prefix=$(get_profile_prefix "$normalized_profile")
  local hours
  hours=$(read_duplicate_setting "$profile_prefix" "DUPLICATE_PAYLOAD_BLOCK_HOURS" "720")

  if [[ ! "$hours" =~ ^[0-9]+$ ]]; then
    echo "Invalid duplicate block configuration for profile '$profile'." >&2
    exit 1
  fi

  printf '%s\n' "$hours"
}

get_reopen_window_hours() {
  local normalized_profile="$1"
  local profile_prefix
  profile_prefix=$(get_profile_prefix "$normalized_profile")
  local hours
  hours=$(read_duplicate_setting "$profile_prefix" "REOPEN_SAME_RECIPIENT_BLOCK_HOURS" "24")

  if [[ ! "$hours" =~ ^[0-9]+$ ]]; then
    echo "Invalid reopen block configuration for profile '$profile'." >&2
    exit 1
  fi

  printf '%s\n' "$hours"
}

find_recent_duplicate() {
  local normalized_profile="$1"
  local recipient_key="$2"
  local payload_signature="$3"
  local window_hours="$4"
  local history_file
  history_file=$(get_history_file "$normalized_profile" "$recipient_key")

  [[ -f "$history_file" ]] || return 1

  local now cutoff
  now=$(date +%s)
  cutoff=$((now - window_hours * 3600))

  while IFS=$'\t' read -r timestamp logged_signature _; do
    [[ "$timestamp" =~ ^[0-9]+$ ]] || continue

    if (( timestamp >= cutoff )) && [[ "$logged_signature" == "$payload_signature" ]]; then
      printf '%s\n' "$timestamp"
      return 0
    fi
  done < "$history_file"

  return 1
}

find_recent_recipient_send() {
  local normalized_profile="$1"
  local recipient_key="$2"
  local window_hours="$3"
  local history_file
  history_file=$(get_history_file "$normalized_profile" "$recipient_key")

  [[ -f "$history_file" ]] || return 1

  local now cutoff
  now=$(date +%s)
  cutoff=$((now - window_hours * 3600))

  while IFS=$'\t' read -r timestamp _; do
    [[ "$timestamp" =~ ^[0-9]+$ ]] || continue

    if (( timestamp >= cutoff )); then
      printf '%s\n' "$timestamp"
      return 0
    fi
  done < "$history_file"

  return 1
}

record_successful_send() {
  local normalized_profile="$1"
  local recipient_key="$2"
  local payload_signature="$3"
  local history_file
  history_file=$(get_history_file "$normalized_profile" "$recipient_key")

  local preview="$text"
  if [[ -n "$media" ]]; then
    preview="${media}"
  fi
  preview=$(printf '%s' "$preview" | tr '\n' ' ' | cut -c1-120)

  printf '%s\t%s\t%s\n' "$(date +%s)" "$payload_signature" "$preview" >> "$history_file"
}

get_wait_seconds() {
  local normalized_profile="$1"
  local recipient_key="$2"
  local profile_prefix
  profile_prefix=$(get_profile_prefix "$normalized_profile")

  local same_min same_max different_min different_max
  same_min=$(read_interval_setting "$profile_prefix" "SAME_RECIPIENT" "MIN" "10")
  same_max=$(read_interval_setting "$profile_prefix" "SAME_RECIPIENT" "MAX" "15")
  different_min=$(read_interval_setting "$profile_prefix" "DIFFERENT_RECIPIENT" "MIN" "45")
  different_max=$(read_interval_setting "$profile_prefix" "DIFFERENT_RECIPIENT" "MAX" "60")

  if [[ ! "$same_min" =~ ^[0-9]+$ || ! "$same_max" =~ ^[0-9]+$ || ! "$different_min" =~ ^[0-9]+$ || ! "$different_max" =~ ^[0-9]+$ ]]; then
    echo "Invalid interval configuration for profile '$profile'." >&2
    exit 1
  fi

  if (( same_max < same_min || different_max < different_min )); then
    echo "Invalid interval range for profile '$profile'." >&2
    exit 1
  fi

  local state_file="$CACHE_DIR/${normalized_profile}.last_send"

  if [[ -f "$state_file" ]]; then
    local last_timestamp last_recipient
    last_timestamp=$(sed -n '1p' "$state_file")
    last_recipient=$(sed -n '2p' "$state_file")

    if [[ "$last_recipient" == "$recipient_key" ]]; then
      random_between "$same_min" "$same_max"
      return
    fi
  fi

  random_between "$different_min" "$different_max"
}

enforce_rate_limit() {
  local normalized_profile="$1"
  local recipient_key="$2"
  local wait_seconds="$3"

  mkdir -p "$CACHE_DIR"

  local state_file="$CACHE_DIR/${normalized_profile}.last_send"
  local now
  now=$(date +%s)

  if [[ -f "$state_file" ]]; then
    local last_send
    last_send=$(sed -n '1p' "$state_file")

    if [[ "$last_send" =~ ^[0-9]+$ ]]; then
      local elapsed=$((now - last_send))
      local remaining=$((wait_seconds - elapsed))

      if (( remaining > 0 )); then
        echo "Cooldown ativo para perfil '$profile'. Aguardando ${remaining}s antes do envio..." >&2
        sleep "$remaining"
        now=$(date +%s)
      fi
    fi
  fi

  {
    printf '%s\n' "$now"
    printf '%s\n' "$recipient_key"
  } > "$state_file"
}

run_with_retry() {
  local attempt=1
  local output=""

  while (( attempt <= MAX_ATTEMPTS )); do
    set +e
    output=$("$@" 2>&1)
    local exit_code=$?
    set -e

    if (( exit_code == 0 )); then
      printf '%s\n' "$output"
      return 0
    fi

    if [[ "$output" == *"fetch failed"* && $attempt -lt MAX_ATTEMPTS ]]; then
      echo "Falha transitória no envio via Evolution API. Tentando novamente..." >&2
      sleep 2
      ((attempt++))
      continue
    fi

    printf '%s\n' "$output" >&2
    return "$exit_code"
  done
}

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
    --name)
      name="${2:-}"
      shift 2
      ;;
    --text)
      text="${2:-}"
      shift 2
      ;;
    --media)
      media="${2:-}"
      shift 2
      ;;
    --caption)
      caption="${2:-}"
      shift 2
      ;;
    --mediatype)
      mediatype="${2:-}"
      shift 2
      ;;
    --force)
      force_send="1"
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$profile" ]]; then
  echo "--profile is required" >&2
  exit 1
fi

if [[ -n "$number" && -n "$name" ]]; then
  echo "Use either --number or --name, not both" >&2
  exit 1
fi

if [[ -z "$number" && -z "$name" ]]; then
  echo "One of --number or --name is required" >&2
  exit 1
fi

if [[ -z "$media" && -z "$text" ]]; then
  echo "--text is required when --media is not used" >&2
  exit 1
fi

cd "$WORKSPACE"

normalized_profile=$(normalize_profile "$profile")
recipient_key=$(get_recipient_key)
payload_signature=$(get_payload_signature)
duplicate_window_hours=$(get_duplicate_window_hours "$normalized_profile")
reopen_window_hours=$(get_reopen_window_hours "$normalized_profile")

if [[ "$force_send" != "1" ]]; then
  duplicate_timestamp=$(find_recent_duplicate "$normalized_profile" "$recipient_key" "$payload_signature" "$duplicate_window_hours" || true)

  if [[ -n "${duplicate_timestamp:-}" ]]; then
    echo "Envio bloqueado: mensagem duplicada para '$recipient_key' dentro da janela de ${duplicate_window_hours}h." >&2
    exit 2
  fi

  recent_send_timestamp=$(find_recent_recipient_send "$normalized_profile" "$recipient_key" "$reopen_window_hours" || true)

  if [[ -n "${recent_send_timestamp:-}" ]]; then
    echo "Envio bloqueado: destinatario '$recipient_key' ja recebeu mensagem dentro da janela de ${reopen_window_hours}h." >&2
    exit 3
  fi
fi

wait_seconds=$(get_wait_seconds "$normalized_profile" "$recipient_key")
enforce_rate_limit "$normalized_profile" "$recipient_key" "$wait_seconds"
resolved_instance=$(get_profile_instance "$normalized_profile")

if [[ -n "$media" ]]; then
  if [[ -n "$name" ]]; then
    output=$(run_with_retry npm start -- send-media-contact --profile "$profile" --name "$name" --media "$media" --caption "$caption" --mediatype "$mediatype")
    printf '%s\n' "$output"
    record_successful_send "$normalized_profile" "$recipient_key" "$payload_signature"
    exit 0
  fi

  output=$(run_with_retry npm start -- send-media-profile --profile "$profile" --number "$number" --media "$media" --caption "$caption" --mediatype "$mediatype")
  printf '%s\n' "$output"
  record_successful_send "$normalized_profile" "$recipient_key" "$payload_signature"
  exit 0
fi

if [[ -n "$name" ]]; then
  output=$(run_with_retry npm start -- send-text-contact --profile "$profile" --name "$name" --text "$text")
  printf '%s\n' "$output"
  record_successful_send "$normalized_profile" "$recipient_key" "$payload_signature"
  exit 0
fi

payload=$(node -e 'const [number, text] = process.argv.slice(1); console.log(JSON.stringify({ number, text, delay: 0, linkPreview: false }));' "$number" "$text")
output=$(run_with_retry npm start -- request POST "/message/sendText/${resolved_instance}" "$payload")
printf '%s\n' "$output"
record_successful_send "$normalized_profile" "$recipient_key" "$payload_signature"
