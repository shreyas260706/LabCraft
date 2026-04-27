"""
Rate Limiter — In-memory IP-based usage tracking.
Resets daily. No database required.
"""
from datetime import date


# ─── In-Memory Store ────────────────────────────────────────────────
# Structure: { "ip": { "date": "YYYY-MM-DD", "generate_count": 0, "modify_count": 0 } }
_usage = {}

# ─── Limits ─────────────────────────────────────────────────────────
MAX_GENERATE_PER_DAY = 5
MAX_MODIFY_PER_DAY = 5


def _get_or_reset(ip: str) -> dict:
    """Get usage record for IP, resetting if the date has changed."""
    today = date.today().isoformat()
    record = _usage.get(ip)

    if record is None or record["date"] != today:
        # New user or new day — reset counts
        _usage[ip] = {
            "date": today,
            "generate_count": 0,
            "modify_count": 0,
        }

    return _usage[ip]


# ─── Public API ─────────────────────────────────────────────────────

def check_generate_limit(ip: str) -> str | None:
    """Check if the IP can make a generation request.
    Returns an error message string if blocked, or None if allowed."""
    record = _get_or_reset(ip)
    if record["generate_count"] >= MAX_GENERATE_PER_DAY:
        return "Daily generation limit reached. Please try again tomorrow."
    return None


def increment_generate(ip: str):
    """Increment the generation counter for an IP (call ONLY on actual API usage, not cache hits)."""
    record = _get_or_reset(ip)
    record["generate_count"] += 1


def check_modify_limit(ip: str) -> str | None:
    """Check if the IP can make a modification request.
    Returns an error message string if blocked, or None if allowed."""
    record = _get_or_reset(ip)
    if record["modify_count"] >= MAX_MODIFY_PER_DAY:
        return "Daily modification limit reached. Please try again tomorrow."
    return None


def increment_modify(ip: str):
    """Increment the modification counter for an IP."""
    record = _get_or_reset(ip)
    record["modify_count"] += 1


def get_usage(ip: str) -> dict:
    """Return current usage info for an IP (for debugging/info)."""
    record = _get_or_reset(ip)
    return {
        "generate_remaining": MAX_GENERATE_PER_DAY - record["generate_count"],
        "modify_remaining": MAX_MODIFY_PER_DAY - record["modify_count"],
    }
