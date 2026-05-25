"""
Syllabus Matcher — Fuzzy topic matching against structured experiment databases.

Architecture:
  1. On startup, loads all JSON files from data/syllabus/ (both flat and hierarchical)
  2. Walks the full directory tree recursively for hierarchical support:
       data/syllabus/btech/it/semester_4/dbms.json
       data/syllabus/operating_systems.json  (legacy flat)
  3. Builds a normalized keyword index per subject
  4. Loads style profiles from data/style_profiles/
  5. At query time, normalizes the user's topic and scores it against the index
  6. Returns the best match + confidence score + style profile

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
STYLE_PROFILES_DIR = Path(__file__).resolve().parent.parent / "data" / "style_profiles"

# ═══════════════════════════════════════════════════════════════
#  In-Memory Index
# ═══════════════════════════════════════════════════════════════

_syllabus_index = {}  # subject_key -> list of experiment dicts
_subject_aliases = {}  # alias -> canonical subject name
_style_profiles = {}  # profile_name -> profile dict
_subject_style_map = {}  # subject_key -> style_profile_name
_loaded = False


def _normalize(text: str) -> str:
    """Lowercase, strip, collapse whitespace, remove punctuation."""
    text = text.lower().strip()
    text = re.sub(r"[''\"`,;:!?(){}[\]]", "", text)
    text = re.sub(r"[-_/]", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text


def _load_style_profiles():
    """Load all style profile JSON files from data/style_profiles/."""
    global _style_profiles

    if not STYLE_PROFILES_DIR.exists():
        print(f"[Syllabus] Style profiles directory not found: {STYLE_PROFILES_DIR}")
        return

    count = 0
    for json_file in STYLE_PROFILES_DIR.glob("*.json"):
        try:
            with open(json_file, "r", encoding="utf-8") as f:
                profile = json.load(f)

            profile_name = profile.get("profile_name", json_file.stem)
            _style_profiles[profile_name] = profile
            count += 1
            print(f"[Syllabus] Loaded style profile: '{profile_name}'")

        except Exception as e:
            print(f"[Syllabus] Error loading style profile {json_file.name}: {e}")

    print(f"[Syllabus] Total: {count} style profiles loaded")


def _register_subject(data: dict, source_path: str = ""):
    """Register a single syllabus JSON into the in-memory index.

    Args:
        data: Parsed JSON dict from a syllabus file
        source_path: Path of the source file (for logging)
    """
    subject_name = data.get("subject", "")
    subject_key = _normalize(subject_name)

    if not subject_key:
        return 0

    # Register aliases
    _subject_aliases[subject_key] = subject_name
    for alias in data.get("subject_aliases", []):
        _subject_aliases[_normalize(alias)] = subject_name

    # Track style profile for this subject
    style_profile = data.get("style_profile", "")
    if style_profile:
        _subject_style_map[subject_key] = style_profile

    # Index experiments — merge with existing if subject already indexed
    experiments = data.get("experiments", [])

    if subject_key in _syllabus_index:
        # Merge: add experiments that aren't already indexed (by title)
        existing_titles = {_normalize(e.get("title", "")) for e in _syllabus_index[subject_key]}
        new_exps = [e for e in experiments if _normalize(e.get("title", "")) not in existing_titles]
        _syllabus_index[subject_key].extend(new_exps)
        count = len(new_exps)
        if count > 0:
            print(f"[Syllabus] Merged {count} new experiments for '{subject_name}' from {source_path}")
    else:
        _syllabus_index[subject_key] = experiments
        count = len(experiments)
        print(f"[Syllabus] Loaded {count} experiments for '{subject_name}' from {source_path}")

    return count


def _load_syllabus():
    """Load all syllabus JSON files from the data/syllabus/ directory tree.

    Supports both:
      - Flat files:        data/syllabus/operating_systems.json
      - Hierarchical files: data/syllabus/btech/it/semester_4/dbms.json

    The loader walks the entire directory tree recursively, so any
    directory structure works. Files at any depth are loaded.
    """
    global _loaded

    if _loaded:
        return

    # Load style profiles first (they may be referenced by syllabus files)
    _load_style_profiles()

    if not SYLLABUS_DIR.exists():
        print(f"[Syllabus] Directory not found: {SYLLABUS_DIR}")
        _loaded = True
        return

    total_count = 0

    # Walk the entire syllabus directory tree recursively
    for json_file in sorted(SYLLABUS_DIR.rglob("*.json")):
        try:
            with open(json_file, "r", encoding="utf-8") as f:
                data = json.load(f)

            # Compute a human-readable relative path for logging
            rel_path = str(json_file.relative_to(SYLLABUS_DIR))
            total_count += _register_subject(data, source_path=rel_path)

        except Exception as e:
            print(f"[Syllabus] Error loading {json_file}: {e}")

    _loaded = True
    print(f"[Syllabus] Total: {total_count} experiments indexed "
          f"across {len(_syllabus_index)} subjects")


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
                 canonical_subject: str = None, style_profile: dict = None,
                 style_profile_name: str = None):
        self.matched = matched
        self.confidence = confidence
        self.experiment = experiment or {}
        self.canonical_subject = canonical_subject or ""
        self.style_profile = style_profile or {}
        self.style_profile_name = style_profile_name or ""

    def __repr__(self):
        if self.matched:
            return (f"MatchResult(matched=True, confidence={self.confidence:.2f}, "
                    f"title='{self.experiment.get('title', '')}', "
                    f"category='{self.experiment.get('category', '')}', "
                    f"style='{self.style_profile_name}')")
        return f"MatchResult(matched=False, confidence={self.confidence:.2f})"


def match_topic(subject: str, topic: str) -> MatchResult:
    """
    Attempt to match a user's topic against the syllabus database.

    Args:
        subject: The subject name (e.g. "Operating Systems", "DBMS")
        topic: The experiment topic entered by the user

    Returns:
        MatchResult with matched flag, confidence, experiment data, and style profile
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
                subject_key = _normalize(name)
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

    # Resolve style profile for this match
    style_profile_name = ""
    style_profile = {}
    if matched and best_exp:
        # Check experiment-level style profile first, then subject-level
        style_profile_name = (
            best_exp.get("style_profile", "")
            or _subject_style_map.get(subject_key, "")
        )
        if style_profile_name:
            style_profile = _style_profiles.get(style_profile_name, {})

    result = MatchResult(
        matched=matched,
        confidence=best_score,
        experiment=best_exp if matched else {},
        canonical_subject=canonical_subject or subject,
        style_profile=style_profile,
        style_profile_name=style_profile_name,
    )

    # Logging
    if matched:
        style_info = f", style='{style_profile_name}'" if style_profile_name else ""
        print(f"[Syllabus] ✓ MATCH: '{topic}' → '{best_exp['title']}' "
              f"(confidence={best_score:.2f}, category={best_exp.get('category', 'N/A')}{style_info})")
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
    Includes DBMS/SQL-specific formatting when a style profile is present.
    """
    if not match.matched or not match.experiment:
        return ""

    exp = match.experiment
    title = exp.get("title", "")
    category = exp.get("category", "")
    theory_points = exp.get("theory_points", [])
    output_type = exp.get("output_type", "")
    language = exp.get("language", "")
    sql_topics = exp.get("sql_topics", [])
    viva_topics = exp.get("viva_topics", [])
    applications = exp.get("applications", [])
    advantages = exp.get("advantages", [])

    lines = [
        f"\nSYLLABUS CONTEXT (use as guidance, NOT copy-paste):",
        f"- This experiment belongs to the '{category}' category",
        f"- Standard academic title: '{title}'",
    ]

    if theory_points:
        lines.append("- Key concepts to cover in theory (expand on these, do NOT copy verbatim):")
        for pt in theory_points:
            lines.append(f"  • {pt}")

    if applications:
        lines.append("- Applications to mention briefly:")
        for app in applications:
            lines.append(f"  • {app}")

    if advantages:
        lines.append("- Advantages/characteristics to include:")
        for adv in advantages:
            lines.append(f"  • {adv}")

    if sql_topics:
        lines.append("- SQL commands/topics to demonstrate in source code:")
        for sql in sql_topics:
            lines.append(f"  • {sql}")

    if viva_topics:
        lines.append("- Viva topics to generate questions about:")
        for vt in viva_topics:
            lines.append(f"  • {vt}")

    if output_type:
        output_guidance = {
            "table": "Output should include a formatted table (e.g., process table with AT, BT, CT, TAT, WT)",
            "simulation": "Output should show a step-by-step simulation trace",
            "console": "Output should show realistic console/terminal output",
            "terminal": "Output should show realistic database terminal output with query results in tabular format",
        }
        if output_type in output_guidance:
            lines.append(f"- {output_guidance[output_type]}")

    if language:
        lines.append(f"- Preferred language: {language}")

    # ─── Style Profile Injection ────────────────────────────────
    style = match.style_profile
    if style:
        lines.append("")
        lines.append("FORMATTING STYLE (MUST FOLLOW):")

        # Theory style rules
        theory_style = style.get("theory_style", {})
        theory_rules = theory_style.get("rules", [])
        if theory_rules:
            lines.append("Theory formatting:")
            for rule in theory_rules:
                lines.append(f"  → {rule}")

        # Code style rules
        code_style = style.get("code_style", {})
        code_rules = code_style.get("rules", [])
        if code_rules:
            lines.append("Source code formatting:")
            for rule in code_rules:
                lines.append(f"  → {rule}")

        # Output style rules
        output_style = style.get("output_style", {})
        output_rules = output_style.get("rules", [])
        if output_rules:
            lines.append("Output formatting:")
            for rule in output_rules:
                lines.append(f"  → {rule}")

        # Viva style rules
        viva_style = style.get("viva_style", {})
        viva_rules = viva_style.get("rules", [])
        if viva_rules:
            lines.append("Viva question generation:")
            for rule in viva_rules:
                lines.append(f"  → {rule}")

    lines.append("- Write in professional academic lab-manual style")
    lines.append("- Keep formatting consistent with university standards")
    lines.append("")

    return "\n".join(lines)


def get_loaded_subjects() -> list:
    """Return list of subjects that have syllabus databases loaded."""
    _load_syllabus()
    return [_subject_aliases.get(_normalize(k), k) for k in _syllabus_index.keys()]


def get_style_profile(profile_name: str) -> dict:
    """Return a loaded style profile by name, or empty dict if not found."""
    _load_syllabus()  # ensure profiles are loaded
    return _style_profiles.get(profile_name, {})


def get_subject_style_profile(subject: str) -> dict:
    """Return the style profile for a subject, or empty dict if none."""
    _load_syllabus()
    subject_key = _normalize(subject)
    canonical = _subject_aliases.get(subject_key)
    if canonical:
        subject_key = _normalize(canonical)
    profile_name = _subject_style_map.get(subject_key, "")
    if profile_name:
        return _style_profiles.get(profile_name, {})
    return {}
