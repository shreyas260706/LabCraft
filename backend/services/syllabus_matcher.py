"""
Syllabus Matcher — Fuzzy topic matching against structured experiment databases.

Architecture:
  1. On startup, loads all JSON files from data/syllabus/
  2. Builds a normalized keyword index per subject
  3. At query time, normalizes the user's topic and scores it against the index
  4. Returns the best match + confidence score

Confidence thresholds:
  - >= 0.6  →  syllabus-aware enhancement applied
  - <  0.6  →  fallback to normal AI generation
"""

import os
import re
import json
from pathlib import Path
from difflib import SequenceMatcher

# ═══════════════════════════════════════════════════════════════
#  Configuration
# ═══════════════════════════════════════════════════════════════

CONFIDENCE_THRESHOLD = 0.50
SYLLABUS_DIR = Path(__file__).resolve().parent.parent / "data" / "syllabus"

# ═══════════════════════════════════════════════════════════════
#  In-Memory Index
# ═══════════════════════════════════════════════════════════════

_syllabus_index = {}  # subject_key -> list of experiment dicts
_subject_aliases = {}  # alias -> canonical subject name
_loaded = False


def _normalize(text: str) -> str:
    """Lowercase, strip, collapse whitespace, remove punctuation."""
    text = text.lower().strip()
    text = re.sub(r"[''\"`,;:!?(){}[\]]", "", text)
    text = re.sub(r"[-_/]", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text


def _load_syllabus():
    """Load all syllabus JSON files into the in-memory index."""
    global _loaded

    if _loaded:
        return

    if not SYLLABUS_DIR.exists():
        print(f"[Syllabus] Directory not found: {SYLLABUS_DIR}")
        _loaded = True
        return

    count = 0
    for json_file in SYLLABUS_DIR.glob("*.json"):
        try:
            with open(json_file, "r", encoding="utf-8") as f:
                data = json.load(f)

            subject_name = data.get("subject", "")
            subject_key = _normalize(subject_name)

            if not subject_key:
                continue

            # Register aliases
            _subject_aliases[subject_key] = subject_name
            for alias in data.get("subject_aliases", []):
                _subject_aliases[_normalize(alias)] = subject_name

            # Index experiments
            experiments = data.get("experiments", [])
            _syllabus_index[subject_key] = experiments
            count += len(experiments)

            print(f"[Syllabus] Loaded {len(experiments)} experiments for '{subject_name}'")

        except Exception as e:
            print(f"[Syllabus] Error loading {json_file.name}: {e}")

    _loaded = True
    print(f"[Syllabus] Total: {count} experiments indexed across {len(_syllabus_index)} subjects")


# ═══════════════════════════════════════════════════════════════
#  Matching Engine
# ═══════════════════════════════════════════════════════════════

def _keyword_score(topic_norm: str, keywords: list) -> float:
    """
    Check how many keywords appear in the topic string.
    Returns 0.0 – 1.0 based on fraction of keywords matched.
    """
    if not keywords:
        return 0.0

    matches = 0
    for kw in keywords:
        kw_norm = _normalize(kw)
        if kw_norm in topic_norm:
            matches += 1

    return matches / len(keywords)


def _fuzzy_score(topic_norm: str, title_norm: str) -> float:
    """SequenceMatcher ratio between topic and experiment title."""
    return SequenceMatcher(None, topic_norm, title_norm).ratio()


def _combined_score(topic_norm: str, experiment: dict) -> float:
    """
    Weighted combination:
      - 45%  keyword match (exact substring)
      - 30%  fuzzy match against title
      - 25%  fuzzy match against best keyword
      + bonus for exact keyword hit
    """
    title_norm = _normalize(experiment.get("title", ""))
    keywords = experiment.get("keywords", [])

    # Keyword substring score
    kw_score = _keyword_score(topic_norm, keywords)

    # Fuzzy vs title
    title_fuzzy = _fuzzy_score(topic_norm, title_norm)

    # Fuzzy vs best keyword
    best_kw_fuzzy = 0.0
    has_exact_hit = False
    for kw in keywords:
        kw_norm = _normalize(kw)
        s = _fuzzy_score(topic_norm, kw_norm)
        if s > best_kw_fuzzy:
            best_kw_fuzzy = s
        # Exact substring match gets a bonus
        if kw_norm in topic_norm or topic_norm in kw_norm:
            has_exact_hit = True

    combined = (kw_score * 0.45) + (title_fuzzy * 0.30) + (best_kw_fuzzy * 0.25)

    # Bonus for having at least one exact keyword substring match
    if has_exact_hit:
        combined = min(1.0, combined + 0.15)

    return round(combined, 4)


# ═══════════════════════════════════════════════════════════════
#  Public API
# ═══════════════════════════════════════════════════════════════

class MatchResult:
    """Result of a syllabus match attempt."""

    def __init__(self, matched: bool, confidence: float, experiment: dict = None,
                 canonical_subject: str = None):
        self.matched = matched
        self.confidence = confidence
        self.experiment = experiment or {}
        self.canonical_subject = canonical_subject or ""

    def __repr__(self):
        if self.matched:
            return (f"MatchResult(matched=True, confidence={self.confidence:.2f}, "
                    f"title='{self.experiment.get('title', '')}', "
                    f"category='{self.experiment.get('category', '')}')")
        return f"MatchResult(matched=False, confidence={self.confidence:.2f})"


def match_topic(subject: str, topic: str) -> MatchResult:
    """
    Attempt to match a user's topic against the syllabus database.

    Args:
        subject: The subject name (e.g. "Operating Systems", "OOPS")
        topic: The experiment topic entered by the user

    Returns:
        MatchResult with matched flag, confidence, and experiment data
    """
    _load_syllabus()

    topic_norm = _normalize(topic)
    subject_norm = _normalize(subject)

    if not topic_norm:
        return MatchResult(matched=False, confidence=0.0)

    # Resolve subject to canonical key
    canonical_subject = _subject_aliases.get(subject_norm)
    subject_key = _normalize(canonical_subject) if canonical_subject else subject_norm

    experiments = _syllabus_index.get(subject_key)
    if not experiments:
        # Try partial match across all subjects
        for key, name in _subject_aliases.items():
            if key in subject_norm or subject_norm in key:
                experiments = _syllabus_index.get(_normalize(name))
                canonical_subject = name
                if experiments:
                    break

    if not experiments:
        print(f"[Syllabus] No database for subject: '{subject}' → fallback")
        return MatchResult(matched=False, confidence=0.0)

    # Score all experiments
    best_score = 0.0
    best_exp = None

    for exp in experiments:
        score = _combined_score(topic_norm, exp)
        if score > best_score:
            best_score = score
            best_exp = exp

    matched = best_score >= CONFIDENCE_THRESHOLD

    result = MatchResult(
        matched=matched,
        confidence=best_score,
        experiment=best_exp if matched else {},
        canonical_subject=canonical_subject or subject,
    )

    # Logging
    if matched:
        print(f"[Syllabus] ✓ MATCH: '{topic}' → '{best_exp['title']}' "
              f"(confidence={best_score:.2f}, category={best_exp.get('category', 'N/A')})")
    else:
        title_hint = best_exp['title'] if best_exp else 'none'
        print(f"[Syllabus] ✗ NO MATCH: '{topic}' → best='{title_hint}' "
              f"(confidence={best_score:.2f}, threshold={CONFIDENCE_THRESHOLD})")

    return result


def build_context_injection(match: MatchResult) -> str:
    """
    Build a context string to inject into the AI prompt.
    Only called when match.matched is True.

    Returns a multi-line string with syllabus-aware guidance.
    """
    if not match.matched or not match.experiment:
        return ""

    exp = match.experiment
    title = exp.get("title", "")
    category = exp.get("category", "")
    theory_points = exp.get("theory_points", [])
    output_type = exp.get("output_type", "")
    language = exp.get("language", "")

    lines = [
        f"\nSYLLABUS CONTEXT (use as guidance, NOT copy-paste):",
        f"- This experiment belongs to the '{category}' category",
        f"- Standard academic title: '{title}'",
    ]

    if theory_points:
        lines.append("- Key concepts to cover in theory (expand on these, do NOT copy verbatim):")
        for pt in theory_points:
            lines.append(f"  • {pt}")

    if output_type:
        output_guidance = {
            "table": "Output should include a formatted table (e.g., process table with AT, BT, CT, TAT, WT)",
            "simulation": "Output should show a step-by-step simulation trace",
            "console": "Output should show realistic console/terminal output",
        }
        if output_type in output_guidance:
            lines.append(f"- {output_guidance[output_type]}")

    if language:
        lines.append(f"- Preferred language: {language}")

    lines.append("- Write in professional academic lab-manual style")
    lines.append("- Keep formatting consistent with university standards")
    lines.append("")

    return "\n".join(lines)


def get_loaded_subjects() -> list:
    """Return list of subjects that have syllabus databases loaded."""
    _load_syllabus()
    return [_subject_aliases.get(_normalize(k), k) for k in _syllabus_index.keys()]
