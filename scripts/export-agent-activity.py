#!/usr/bin/env python3
"""Export daily user-turn counts from transcripts and optional history backfill.

Read-only discovery and helper signals follow Agent-Usage/scripts/agent-usage
(2026-10-17). No collector imports, credentials, indexes, databases or APIs.
Only dates/counts survive collection; the durable ledger has no window limit.
"""

from __future__ import annotations

import argparse
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from itertools import chain
import json
import math
import os
from pathlib import Path
import re
import sys
import tempfile
from zoneinfo import ZoneInfo

TIMEZONE = "America/New_York"
LOCAL_ZONE = ZoneInfo(TIMEZONE)
ACCOUNT_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")
REPO = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = REPO / "src/data/agent-activity.json"
DEFAULT_LEDGER = REPO / "data/agent-activity-ledger.json"
PROVIDERS = ("codex", "claude")
KINDS = {"session_meta", "event_msg", "user_message", "response_item", "message",
         "user", "text", "tool_result"}
COMMAND_PREFIXES = ("<command-name>", "<local-command-stdout>", "<command-message>")
REMINDERS = re.compile(r"<system-reminder>.*?</system-reminder>", re.DOTALL)


class ExportError(ValueError):
    """An error whose fixed message is safe to display."""


def accounts_root() -> Path:
    configured = os.environ.get("CODEX_ACCOUNTS_DIR")
    if configured:
        return Path(configured).expanduser()
    xdg_data = os.environ.get("XDG_DATA_HOME")
    base = Path(xdg_data).expanduser() if xdg_data else Path.home() / ".local/share"
    return base / "codex-accounts"


def codex_homes() -> list[Path]:
    """Include the default home even when the collector discovers profiles."""
    profiles_dir = accounts_root() / "profiles"
    names = (
        sorted(path.name for path in profiles_dir.iterdir() if path.is_dir())
        if profiles_dir.is_dir() else []
    )
    if any(not ACCOUNT_RE.fullmatch(name) for name in names):
        raise ExportError("Invalid Codex account directory name")
    home = Path(os.environ.get("CODEX_HOME") or Path.home() / ".codex").expanduser()
    return [profiles_dir / name for name in names] + [home]


def claude_config_dir() -> Path:
    configured = os.environ.get("CLAUDE_CONFIG_DIR")
    return Path(configured).expanduser() if configured else Path.home() / ".claude"


def human_text(value: str) -> bool:
    text = value.lstrip()
    return bool(text and not text.startswith(COMMAND_PREFIXES)
                and REMINDERS.sub("", text).strip())


def human_content(value: object) -> bool:
    if isinstance(value, str):
        return human_text(value)
    if isinstance(value, list):
        return any(
            isinstance(block, dict)
            and block.get("type") != "tool_result"
            and (block.get("text", False) if block.get("type") == "text" else True)
            for block in value
        )
    return False


def iso_time(value: object) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        instant = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return instant if instant.tzinfo is not None else None
    except ValueError:
        return None


def numeric_time(value: object, unit: int) -> datetime | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    try:
        if math.isfinite(value):
            return datetime.fromtimestamp(value / unit, timezone.utc)
    except (ValueError, OverflowError, OSError):
        pass
    return None


def classification_pairs(pairs: list) -> dict:
    """Reduce JSON objects during decoding, before retaining a parsed record.

    Text is inspected transiently only to classify Claude harness/tool content.
    No message text, identities, titles, paths or source details leave this hook.
    """
    result = {}
    for key, value in pairs:
        if key == "type":
            result[key] = value if isinstance(value, str) and value in KINDS else None
        elif key == "timestamp":
            result[key] = iso_time(value)
        elif key in {"isSidechain", "isMeta", "parent_thread_id", "subagent"}:
            result[key] = True if key == "subagent" else bool(value)
        elif key == "role":
            result[key] = value == "user"
        elif key == "text":
            result[key] = human_text(value) if isinstance(value, str) else False
        elif key == "content":
            result[key] = human_content(value)
        elif key in {"payload", "message", "source"} and isinstance(value, dict):
            result[key] = value
    return result


def records(path: Path, history_field: str | None = None):
    def history_pairs(pairs):
        return {key: numeric_time(value, 1 if key == "ts" else 1000)
                for key, value in pairs if key == history_field}

    with path.open(encoding="utf-8", errors="replace") as handle:
        for line in handle:
            try:
                record = json.loads(
                    line, object_pairs_hook=history_pairs if history_field else classification_pairs
                )
            except (ValueError, OverflowError, RecursionError):
                continue
            finally:
                del line
            if isinstance(record, dict):
                yield record


def add(counts: Counter, instant: datetime | None, now: datetime) -> None:
    if instant is not None and instant <= now:
        try:
            day = instant.astimezone(LOCAL_ZONE).date().isoformat()
        except (ValueError, OverflowError):
            return
        counts[day] += 1


def transcript_counts(path: Path, provider: str, now: datetime) -> Counter:
    counts, fallback = Counter(), Counter()
    canonical = False
    for record in records(path):
        kind = record.get("type")
        if provider == "codex":
            payload = record.get("payload", {})
            if kind == "session_meta":
                source = payload.get("source", {})
                if source.get("subagent") or payload.get("parent_thread_id"):
                    return Counter()
            elif kind == "event_msg" and payload.get("type") == "user_message":
                canonical = True
                add(counts, record.get("timestamp"), now)
            elif (kind == "response_item" and payload.get("type") == "message"
                  and payload.get("role")):
                add(fallback, record.get("timestamp"), now)
        elif (kind == "user" and not record.get("isSidechain")
              and not record.get("isMeta") and record.get("message", {}).get("content")):
            add(counts, record.get("timestamp"), now)
    # Modern rollouts mirror user events in response_item records. Use that
    # older format only for files with no canonical user_message events.
    return counts if provider == "claude" or canonical else fallback


def collect(now: datetime, history: bool) -> tuple[dict, bool]:
    sources = {provider: {"transcripts": Counter(), "history": Counter()}
               for provider in PROVIDERS}
    homes = codex_homes()
    claude = claude_config_dir()
    found = False
    for provider in PROVIDERS:
        seen_inodes, seen_paths = set(), set()
        candidates = (
            ((path, "transcripts") for home in homes
             for path in (home / "sessions").rglob("rollout-*.jsonl"))
            if provider == "codex" else
            ((path, "transcripts") for path in (claude / "projects").rglob("*.jsonl"))
        )
        histories = ([home / "history.jsonl" for home in homes]
                     if provider == "codex" else [claude / "history.jsonl"])
        # Each source is accumulated separately; aliases and hardlinks count once.
        for path, source in chain(candidates, ((p, "history") for p in histories if history)):
            if not path.is_file():
                continue
            stat, real = path.stat(), path.resolve()
            identity = (stat.st_dev, stat.st_ino)
            if identity in seen_inodes or real in seen_paths:
                continue
            seen_inodes.add(identity)
            seen_paths.add(real)
            found = True
            if source == "transcripts":
                sources[provider][source].update(transcript_counts(path, provider, now))
            else:
                field = "ts" if provider == "codex" else "timestamp"
                for record in records(path, field):
                    add(sources[provider][source], record.get(field), now)
    return sources, found


def empty_ledger() -> dict:
    return {"schemaVersion": 1, "timezone": TIMEZONE,
            "providers": {provider: {} for provider in PROVIDERS}}


def load_ledger(path: Path) -> dict:
    if not path.exists():
        return empty_ledger()
    try:
        document = json.loads(path.read_text(encoding="utf-8"))
        if (set(document) != {"schemaVersion", "timezone", "providers"}
                or type(document["schemaVersion"]) is not int or document["schemaVersion"] != 1
                or document["timezone"] != TIMEZONE
                or set(document["providers"]) != set(PROVIDERS)):
            raise ValueError
        for counts in document["providers"].values():
            for day, count in counts.items():
                if (date.fromisoformat(day).isoformat() != day
                        or type(count) is not int or count < 0):
                    raise ValueError
        return document
    except (ValueError, TypeError, AttributeError):
        raise ExportError("Invalid activity ledger. Restore a valid ledger before retrying.") from None


def merge(ledger: dict, sources: dict) -> None:
    for provider, inputs in sources.items():
        counts = ledger["providers"][provider]
        for source in inputs.values():
            for day, count in source.items():
                counts[day] = max(counts.get(day, 0), count)
        ledger["providers"][provider] = dict(sorted(counts.items()))


def public_document(now: datetime, ledger: dict) -> dict:
    today = now.astimezone(LOCAL_ZONE).date()
    sunday = today - timedelta(days=(today.weekday() + 1) % 7)
    start = sunday - timedelta(weeks=52)
    days = []
    for offset in range((today - start).days + 1):
        day = (start + timedelta(days=offset)).isoformat()
        days.append({"date": day, "count": sum(
            ledger["providers"][provider].get(day, 0) for provider in PROVIDERS
        )})
    return {"schemaVersion": 1,
            "generatedAt": now.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
            "timezone": TIMEZONE, "days": days}


def atomic_write(output: Path, document: dict) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", dir=output.parent,
            prefix=".agent-activity-", suffix=".tmp", delete=False,
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


def summary(label: str, counts: dict) -> None:
    active = [day for day, count in counts.items() if count > 0]
    print(f"{label}: {sum(counts.values())} turns across {len(active)} active days; "
          f"earliest {min(active) if active else 'none'}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="print counts without writing")
    parser.add_argument("--no-history", action="store_true", help="disable history backfill")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--ledger", type=Path, default=DEFAULT_LEDGER)
    parser.add_argument("--now", help="ISO timestamp with offset, for fixture tests")
    args = parser.parse_args()
    try:
        now = iso_time(args.now) if args.now else datetime.now(timezone.utc)
        if now is None:
            raise ExportError("--now must be an ISO timestamp with a timezone offset")
        if args.output.resolve() == args.ledger.resolve():
            raise ExportError("The ledger and public output must be different files.")
        ledger = load_ledger(args.ledger)
        sources, found = collect(now, not args.no_history)
        if not found and not any(ledger["providers"].values()):
            raise ExportError("No activity sources found. Check the provider directory settings.")
        merge(ledger, sources)
        if args.dry_run:
            for provider in PROVIDERS:
                for source, counts in sources[provider].items():
                    summary(f"{provider} {source}", counts)
                summary(f"{provider} ledger", ledger["providers"][provider])
        else:
            # Save durable counts first, so an output failure cannot lose them.
            atomic_write(args.ledger, ledger)
            atomic_write(args.output, public_document(now, ledger))
        return 0
    except (ValueError, OSError, OverflowError, RecursionError) as error:
        message = (str(error) if isinstance(error, ExportError) else
                   "Could not read activity sources or write the export. Check permissions and formats.")
        print(f"Agent activity export failed. {message}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
