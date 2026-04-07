#!/usr/bin/env python3
import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

TOKEN_URL = "https://oauth2.googleapis.com/token"
EVENTS_URL_TEMPLATE = "https://www.googleapis.com/calendar/v3/calendars/{calendar_id}/events"
WORK_CALENDAR_FALLBACK = "qdmv02aj79ha0pnb5q2qcaeutk@group.calendar.google.com"
DEFAULT_TIMEZONE = "America/Sao_Paulo"


class ConfigError(Exception):
    pass


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create a Google Calendar event using AgentOS policy")
    parser.add_argument("--title", required=True, help="Event title")
    parser.add_argument("--start", required=True, help="Start datetime or date in ISO format")
    parser.add_argument("--end", help="End datetime or date in ISO format")
    parser.add_argument("--timezone", help="IANA timezone, e.g. America/Sao_Paulo")
    parser.add_argument("--description", default="", help="Event description")
    parser.add_argument("--location", default="", help="Event location")
    parser.add_argument("--calendar-id", help="Override the target Google Calendar ID")
    parser.add_argument("--all-day", action="store_true", help="Create an all-day event")
    parser.add_argument(
        "--duration-minutes",
        type=int,
        default=60,
        help="Duration used when --end is omitted for timed events",
    )
    parser.add_argument(
        "--event-kind",
        choices=["personal", "work", "external-work"],
        default="work",
        help="Policy category used to infer the target calendar",
    )
    parser.add_argument(
        "--env-file",
        default="/Users/eu.rochamateus/Documents/Codex/AgentOS/.env",
        help="Path to the environment file",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Only print the resolved payload without calling Google",
    )
    return parser.parse_args()


def load_env_file(path: str) -> None:
    env_path = Path(path)
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def read_env(name: str, required: bool = True, default: str | None = None) -> str | None:
    value = os.environ.get(name, default)
    if required and not value:
        raise ConfigError(f"Missing environment variable: {name}")
    return value


def parse_datetime(value: str) -> datetime:
    normalized = value.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(normalized)
    except ValueError as exc:
        raise ValueError(
            f"Invalid datetime '{value}'. Use ISO format like 2026-03-25T15:00:00-03:00"
        ) from exc


def parse_date(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise ValueError(f"Invalid date '{value}'. Use ISO format like 2026-03-25") from exc


def resolve_calendar_id(args: argparse.Namespace) -> str:
    if args.calendar_id:
        return args.calendar_id

    if args.event_kind == "personal":
        return "primary"

    return read_env(
        "GOOGLE_CALENDAR_WORK_CALENDAR_ID",
        required=False,
        default=WORK_CALENDAR_FALLBACK,
    ) or WORK_CALENDAR_FALLBACK


def build_event_payload(args: argparse.Namespace, default_timezone: str) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "summary": args.title,
    }

    if args.description:
        payload["description"] = args.description
    if args.location:
        payload["location"] = args.location

    if args.all_day:
        start_date = parse_date(args.start)
        end_date = parse_date(args.end) if args.end else start_date + timedelta(days=1)
        if end_date <= start_date:
            raise ValueError("For all-day events, end date must be after start date.")
        payload["start"] = {"date": start_date.isoformat()}
        payload["end"] = {"date": end_date.isoformat()}
        return payload

    start_dt = parse_datetime(args.start)
    end_dt = parse_datetime(args.end) if args.end else start_dt + timedelta(minutes=args.duration_minutes)
    if end_dt <= start_dt:
        raise ValueError("End datetime must be after start datetime.")

    timezone = args.timezone or default_timezone
    payload["start"] = {"dateTime": start_dt.isoformat(), "timeZone": timezone}
    payload["end"] = {"dateTime": end_dt.isoformat(), "timeZone": timezone}
    return payload


def fetch_access_token(client_id: str, client_secret: str, refresh_token: str) -> str:
    data = urllib.parse.urlencode(
        {
            "client_id": client_id,
            "client_secret": client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        }
    ).encode("utf-8")

    request = urllib.request.Request(TOKEN_URL, data=data, method="POST")
    request.add_header("Content-Type", "application/x-www-form-urlencoded")

    try:
        with urllib.request.urlopen(request) as response:
            body = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        error_body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Failed to refresh Google access token: {error_body}") from exc

    token = body.get("access_token")
    if not token:
        raise RuntimeError("Google token response did not include access_token")
    return token


def create_event(calendar_id: str, access_token: str, payload: dict[str, Any]) -> dict[str, Any]:
    encoded_calendar_id = urllib.parse.quote(calendar_id, safe="")
    request = urllib.request.Request(
        EVENTS_URL_TEMPLATE.format(calendar_id=encoded_calendar_id),
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
    )
    request.add_header("Authorization", f"Bearer {access_token}")
    request.add_header("Content-Type", "application/json")

    try:
        with urllib.request.urlopen(request) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        error_body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Failed to create Google Calendar event: {error_body}") from exc


def main() -> int:
    args = parse_args()
    load_env_file(args.env_file)

    try:
        default_timezone = read_env(
            "GOOGLE_CALENDAR_DEFAULT_TIMEZONE",
            required=False,
            default=DEFAULT_TIMEZONE,
        ) or DEFAULT_TIMEZONE
        calendar_id = resolve_calendar_id(args)
        payload = build_event_payload(args, default_timezone)

        if args.dry_run:
            print(
                json.dumps(
                    {
                        "calendarId": calendar_id,
                        "eventKind": args.event_kind,
                        "payload": payload,
                    },
                    ensure_ascii=True,
                    indent=2,
                )
            )
            return 0

        client_id = read_env("GOOGLE_CALENDAR_CLIENT_ID")
        client_secret = read_env("GOOGLE_CALENDAR_CLIENT_SECRET")
        refresh_token = read_env("GOOGLE_CALENDAR_REFRESH_TOKEN")
        access_token = fetch_access_token(client_id, client_secret, refresh_token)
        result = create_event(calendar_id, access_token, payload)
    except (ConfigError, ValueError, RuntimeError) as exc:
        print(str(exc), file=sys.stderr)
        return 1

    print(
        json.dumps(
            {
                "id": result.get("id"),
                "status": result.get("status"),
                "htmlLink": result.get("htmlLink"),
                "summary": result.get("summary"),
                "calendarId": calendar_id,
                "start": result.get("start"),
                "end": result.get("end"),
            },
            ensure_ascii=True,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
