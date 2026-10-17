#!/usr/bin/env python3
"""Export daily prompt counts, never history contents.

Discovery mirrors accounts_root, codex_profiles(None), and claude_config_dir in
Agent-Usage/scripts/agent-usage as read on 2026-10-16. It deliberately does not
import the collector, inspect credentials, or call a provider. Codex's timestamp
field is `ts` (Unix seconds), Claude's is `timestamp` (Unix milliseconds).
The window is 53 Sunday-start calendar weeks including the current partial week.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timedelta, timezone
import json
import math
import os
from pathlib import Path
import re
import sys
import tempfile
from zoneinfo import ZoneInfo

TIMEZONE = "America/New_York"
ACCOUNT_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")
DEFAULT_OUTPUT = Path(__file__).resolve().parents[1] / "src/data/agent-activity.json"


def accounts_root() -> Path:
    configured = os.environ.get("CODEX_ACCOUNTS_DIR")
    if configured:
        return Path(configured).expanduser()
    xdg_data = os.environ.get("XDG_DATA_HOME")
    base = Path(xdg_data).expanduser() if xdg_data else Path.home() / ".local/share"
    return base / "codex-accounts"


def codex_homes() -> list[Path]:
    """Mirror the collector's automatic discovery, including profile precedence."""
    profiles_dir = accounts_root() / "profiles"
    names = (
        sorted(path.name for path in profiles_dir.iterdir() if path.is_dir())
        if profiles_dir.is_dir()
        else []
    )
    if names:
        if any(not ACCOUNT_RE.fullmatch(name) for name in names):
            raise ValueError("Invalid Codex account directory name")
        return [profiles_dir / name for name in names]
    home = Path(os.environ.get("CODEX_HOME") or Path.home() / ".codex").expanduser()
    return [home] if home.is_dir() else []


def claude_config_dir() -> Path:
    configured = os.environ.get("CLAUDE_CONFIG_DIR")
    return Path(configured).expanduser() if configured else Path.home() / ".claude"


def timestamp_only(line: str, field: str) -> float | None:
    """Discard every other JSON field during parsing, including nested objects."""
    try:
        parsed = json.loads(
            line,
            object_pairs_hook=lambda pairs: {
                key: value for key, value in pairs if key == field
            },
        )
        value = parsed.get(field) if isinstance(parsed, dict) else None
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            return None
        return value if math.isfinite(value) else None
    except (ValueError, OverflowError, RecursionError):
        return None


def collect(now: datetime) -> dict:
    local_today = now.astimezone(ZoneInfo(TIMEZONE)).date()
    sunday = local_today - timedelta(days=(local_today.weekday() + 1) % 7)
    start = sunday - timedelta(weeks=52)
    counts = {
        (start + timedelta(days=offset)).isoformat(): 0
        for offset in range((local_today - start).days + 1)
    }
    candidates = [(home / "history.jsonl", "ts", 1) for home in codex_homes()]
    candidates.append((claude_config_dir() / "history.jsonl", "timestamp", 1000))
    histories = [
        (path, field, unit)
        for path, field, unit in candidates
        if path.is_file()
    ]
    if not histories:
        raise ValueError(
            "No history.jsonl files found. Check the provider directory settings."
        )
    seen = set()
    for path, field, unit in histories:
        # Aliased homes or hard links must not count the same history twice.
        stat = path.stat()
        identity = (stat.st_dev, stat.st_ino)
        if identity in seen:
            continue
        seen.add(identity)
        with path.open(encoding="utf-8", errors="replace") as history:
            for line in history:
                timestamp = timestamp_only(line, field)
                del line
                if timestamp is None:
                    continue
                try:
                    instant = datetime.fromtimestamp(timestamp / unit, timezone.utc)
                except (ValueError, OverflowError, OSError):
                    continue
                if instant > now:
                    continue
                day = instant.astimezone(ZoneInfo(TIMEZONE)).date().isoformat()
                if day in counts:
                    counts[day] += 1
    return {
        "schemaVersion": 1,
        "generatedAt": now.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
        "timezone": TIMEZONE,
        "days": [{"date": day, "count": count} for day, count in counts.items()],
    }


def atomic_write(output: Path, document: dict) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=output.parent,
            prefix=".agent-activity-",
            suffix=".tmp",
            delete=False,
        ) as target:
            temporary = Path(target.name)
            json.dump(document, target, indent=2)
            target.write("\n")
            target.flush()
            os.fsync(target.fileno())
        os.replace(temporary, output)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run", action="store_true",
        help="print aggregate totals without writing",
    )
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument(
        "--now", help="ISO timestamp with offset, for reproducible fixture tests"
    )
    args = parser.parse_args()
    try:
        now = (
            datetime.fromisoformat(args.now.replace("Z", "+00:00"))
            if args.now
            else datetime.now(timezone.utc)
        )
        if now.tzinfo is None:
            raise ValueError("--now must include a timezone offset")
        document = collect(now)
        if args.dry_run:
            days = document["days"]
            print(
                f"{sum(day['count'] for day in days)} prompts across "
                f"{sum(day['count'] > 0 for day in days)} active days"
            )
        else:
            atomic_write(args.output, document)
        return 0
    except (ValueError, OSError) as error:
        # Filesystem exception text may contain private directory names.
        message = (
            str(error)
            if isinstance(error, ValueError)
            else "Could not read histories or write the export. Check permissions."
        )
        print(f"Agent activity export failed. {message}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
