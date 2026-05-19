"""
AI Service — Multi-provider AI system with Redis caching, Gemini (primary) + Groq (fallback).
Round-robin key rotation for both providers. Global shared cache via Redis.
"""
import json
import time
import random
import os
import redis
import requests
from pydantic import BaseModel, ValidationError
from google import genai
from config import Config
from flask import request
from threading import Lock


# ─── Pydantic Schemas ───────────────────────────────────────────────

class VivaQuestion(BaseModel):
    question: str
    answer: str


class ExperimentSchema(BaseModel):
    experiment_no: int
    aim: str
    theory: str
    source_code: str
    viva: list[VivaQuestion]
    output: str


class SlideSchema(BaseModel):
    heading: str
    points: list[str]


class PPTSchema(BaseModel):
    title: str
    slides: list[SlideSchema]


# ─── Redis Setup ────────────────────────────────────────────────────

try:
    _redis_url = os.getenv("REDIS_URL")
    if _redis_url:
        redis_client = redis.from_url(_redis_url, decode_responses=True)
        redis_client.ping()  # verify connectivity
        print("[AI Service] Redis connected successfully")
    else:
        redis_client = None
        print("[AI Service] No REDIS_URL set — Redis caching disabled")
except Exception as e:
    redis_client = None
    print(f"[AI Service] Redis Setup Error: {e} — caching disabled")


# ─── In-Memory Cache (local fallback) ──────────────────────────────

_cache = {}
_CACHE_TTL = 3600  # 1 hour
_MAX_CACHE_SIZE = 200
_cache_lock = Lock()

_modify_usage = {}   # key: subject_topic → count
_rate_limit_usage = {}  # key: ip -> list of timestamps


# ─── Gemini Multi-Key State ────────────────────────────────────────

_gemini_keys = Config.GEMINI_KEYS  # loaded from config
_gemini_index = 0
_gemini_lock = Lock()


# ─── Groq Multi-Key State ──────────────────────────────────────────

_groq_keys = [k.strip() for k in os.getenv("GROQ_API_KEYS", "").split(",") if k.strip()]
_groq_index = 0
_groq_lock = Lock()
_GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
_GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"


# ─── Key Helpers ────────────────────────────────────────────────────

def make_key(subject, topic):
    """Simple normalized key for Redis."""
    return f"{subject.strip().lower()}_{topic.strip().lower()}"


def _make_key(subject: str, topic: str, prefix: str = "", options: dict = None) -> str:
    """Detailed key for in-memory cache with options fingerprint."""
    norm_subject = (subject or "").strip().lower()
    norm_topic = (topic or "").strip().lower()
    base = f"{prefix}_{norm_subject}_{norm_topic}" if prefix else f"{norm_subject}_{norm_topic}"
    if options:
        active_opts = sorted([k for k, v in options.items() if v])
        if active_opts:
            base += "_" + "_".join(active_opts)
        else:
            base += "_default"
    return base


# ─── Redis Helpers ──────────────────────────────────────────────────

def _redis_get(key: str):
    """Safely get from Redis. Returns parsed dict or None."""
    try:
        if redis_client:
            cached = redis_client.get(key)
            if cached:
                print(f"[AI Service] REDIS HIT: {key}")
                return json.loads(cached)
            else:
                print(f"[AI Service] REDIS MISS: {key}")
    except Exception as e:
        print(f"[AI Service] Redis GET Error: {e}")
    return None


def _redis_set(key: str, data: dict, ttl: int = 3600):
    """Safely store in Redis with TTL."""
    try:
        if redis_client:
            redis_client.setex(key, ttl, json.dumps(data))
    except Exception as e:
        print(f"[AI Service] Redis SET Error: {e}")


# ─── In-Memory Cache Helpers ───────────────────────────────────────

def _cache_get(key: str):
    with _cache_lock:
        entry = _cache.get(key)
        if entry and (time.time() - entry["timestamp"]) < _CACHE_TTL:
            print(f"[AI Service] MEMORY CACHE HIT: {key}")
            return entry["data"]
    print(f"[AI Service] MEMORY CACHE MISS: {key}")
    return None

def _cache_set(key: str, data: dict):
    with _cache_lock:
        _cache[key] = {
            "data": json.loads(json.dumps(data)),
            "timestamp": time.time()
        }
        if len(_cache) > _MAX_CACHE_SIZE:
            oldest_key = min(_cache.keys(), key=lambda k: _cache[k]["timestamp"])
            del _cache[oldest_key]


# ─── Rate Limiting ──────────────────────────────────────────────────

def _check_rate_limit():
    """Limit to 3 requests per minute per IP."""
    try:
        ip = request.remote_addr
    except RuntimeError:
        # If running outside Flask context (e.g. testing), bypass
        return

    now = time.time()

    if ip not in _rate_limit_usage:
        _rate_limit_usage[ip] = []

    # filter out timestamps older than 60 seconds
    _rate_limit_usage[ip] = [ts for ts in _rate_limit_usage[ip] if now - ts < 60]

    if len(_rate_limit_usage[ip]) >= 3:
        raise Exception("Too many requests. Please wait a moment.")

    _rate_limit_usage[ip].append(now)


# ─── Gemini Multi-Key Rotation (PRIMARY) ───────────────────────────

def _get_next_gemini_key():
    """Round-robin Gemini API key selection."""
    global _gemini_index
    with _gemini_lock:
        if not _gemini_keys:
            raise ValueError("No Gemini API keys configured.")
        key = _gemini_keys[_gemini_index % len(_gemini_keys)]
        _gemini_index += 1
    return key


def _call_gemini(prompt: str, schema):
    """
    Call Gemini with multi-key rotation.
    Tries each key once before giving up. Returns parsed Pydantic model.
    """
    max_retries = len(_gemini_keys) if _gemini_keys else 1
    last_error = None

    for attempt in range(max_retries):
        api_key = _get_next_gemini_key()
        masked = f"{api_key[:5]}...{api_key[-3:]}" if len(api_key) > 8 else "HIDDEN"
        print(f"[AI Service] GEMINI KEY USED: {masked} (attempt {attempt + 1}/{max_retries})")

        try:
            client = genai.Client(api_key=api_key)
            response = client.models.generate_content(
                model=Config.GEMINI_MODEL,
                contents=prompt,
                config={
                    "response_mime_type": "application/json",
                    "response_schema": schema,
                },
            )

            # Parse and validate the response
            parsed = response.parsed
            if parsed is None:
                raw_text = response.text
                data = json.loads(raw_text)
                parsed = schema.model_validate(data)

            print(f"[AI Service] GEMINI SUCCESS on attempt {attempt + 1}")
            return parsed

        except Exception as e:
            last_error = e
            print(f"[AI Service] GEMINI RETRY — attempt {attempt + 1} failed: {str(e)[:80]}")
            if attempt < max_retries - 1:
                sleep_s = (2 ** attempt) + random.uniform(0, 1)
                time.sleep(sleep_s)

    print(f"[AI Service] ALL GEMINI KEYS FAILED after {max_retries} attempts. Last error: {last_error}")
    return None  # signal caller to try fallback


# ─── Groq Multi-Key Rotation (FALLBACK) ────────────────────────────

def _get_next_groq_key():
    """Round-robin Groq API key selection."""
    global _groq_index
    with _groq_lock:
        if not _groq_keys:
            raise ValueError("No Groq API keys configured.")
        key = _groq_keys[_groq_index % len(_groq_keys)]
        _groq_index += 1
    return key


def _call_groq(prompt: str, schema):
    """
    Call Groq with multi-key rotation.
    Tries each key once before giving up. Returns parsed Pydantic model or None.
    """
    if not _groq_keys:
        print("[AI Service] No Groq API keys configured — skipping fallback")
        return None

    max_retries = len(_groq_keys)
    last_error = None

    # Build a system message that instructs JSON output matching the schema
    schema_json = json.dumps(schema.model_json_schema(), indent=2)
    system_msg = (
        "You are an expert AI assistant. You MUST respond with valid JSON only, "
        "matching the following JSON schema exactly. Do not include any text outside the JSON object.\n\n"
        f"Schema:\n{schema_json}"
    )

    for attempt in range(max_retries):
        api_key = _get_next_groq_key()
        masked = f"{api_key[:5]}...{api_key[-3:]}" if len(api_key) > 8 else "HIDDEN"
        print(f"[AI Service] GROQ KEY USED: {masked} (attempt {attempt + 1}/{max_retries})")

        try:
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            }
            payload = {
                "model": _GROQ_MODEL,
                "messages": [
                    {"role": "system", "content": system_msg},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.7,
                "max_tokens": 4096,
                "response_format": {"type": "json_object"},
            }

            resp = requests.post(_GROQ_API_URL, headers=headers, json=payload, timeout=60)
            resp.raise_for_status()

            raw_text = resp.json()["choices"][0]["message"]["content"]
            data = json.loads(raw_text)
            parsed = schema.model_validate(data)

            print(f"[AI Service] GROQ SUCCESS on attempt {attempt + 1}")
            return parsed

        except Exception as e:
            last_error = e
            print(f"[AI Service] GROQ RETRY — attempt {attempt + 1} failed: {str(e)[:80]}")
            if attempt < max_retries - 1:
                sleep_s = (2 ** attempt) + random.uniform(0, 1)
                time.sleep(sleep_s)

    print(f"[AI Service] ALL GROQ KEYS FAILED after {max_retries} attempts. Last error: {last_error}")
    return None


# ─── Unified Generation (Gemini → Groq fallback) ──────────────────

def _generate_with_fallback(prompt: str, schema):
    """
    Try Gemini first (multi-key rotation).
    If all Gemini keys fail, fallback to Groq (multi-key rotation).
    Raises Exception if both fail.
    """
    # Check IP-based rate limit BEFORE attempting any generation
    _check_rate_limit()

    # 1) Try Gemini (primary)
    result = _call_gemini(prompt, schema)
    if result is not None:
        return result

    # 2) Fallback to Groq
    print("[AI Service] FALLBACK TRIGGERED — switching to Groq")
    result = _call_groq(prompt, schema)
    if result is not None:
        return result

    # 3) Both providers failed
    raise Exception("AI servers are busy. Please try again in a few seconds.")


# ─── Legacy wrapper (keeps existing call sites working) ────────────

def _generate_with_retry(prompt: str, schema, max_retries: int = None):
    """Backward-compatible wrapper that delegates to the new fallback system."""
    return _generate_with_fallback(prompt, schema)


# ─── Public API ─────────────────────────────────────────────────────

def generate_experiment(subject: str, experiment_no: int, topic: str, aim: str = None, options: dict = None) -> dict:
    """Generate a complete lab experiment with strict formatting."""

    if not subject or not topic:
        raise ValueError("Both subject and topic are required")

    if options is None:
        options = {}

    cache_key = _make_key(subject, topic, options=options)
    redis_key = make_key(subject, topic)

    # Clean and standardize AIM (prevent duplicates like "implement implement")
    if aim:
        cleaned_aim = (aim or "").strip()

        # normalize spacing
        cleaned_aim = " ".join(cleaned_aim.split())

        # remove consecutive duplicate words
        words = cleaned_aim.split(" ")
        dedup_words = []
        for w in words:
            if not dedup_words or dedup_words[-1].lower() != w.lower():
                dedup_words.append(w)
        cleaned_aim = " ".join(dedup_words)

        # ensure it starts with "To"
        if not cleaned_aim.lower().startswith("to "):
            cleaned_aim = f"To {cleaned_aim}"

        # capitalize properly
        final_aim = cleaned_aim[0].upper() + cleaned_aim[1:]

    else:
        final_aim = f"To study and implement {topic}."

    # ─── Layer 1: In-memory cache ───────────────────────────────
    cached_data = _cache_get(cache_key)
    if cached_data:
        data = json.loads(json.dumps(cached_data))
        data["experiment_no"] = experiment_no
        data["aim"] = final_aim
        data["subject"] = subject
        data["topic"] = topic
        data["_cached"] = True
        return data

    # ─── Layer 2: Redis cache ───────────────────────────────────
    redis_data = _redis_get(redis_key)
    if redis_data:
        # Populate in-memory cache from Redis for faster future hits
        _cache_set(cache_key, redis_data)
        redis_data["experiment_no"] = experiment_no
        redis_data["aim"] = final_aim
        redis_data["subject"] = subject
        redis_data["topic"] = topic
        redis_data["_cached"] = True
        return redis_data

    # ─── Build dynamic prompt based on options ──────────────────
    theory_instructions = ""
    viva_instructions = ""
    code_instructions = ""
    output_instructions = ""

    if options.get("detailed_theory"):
        theory_instructions = """- Write a thorough, in-depth theory section (250-350 words)
- MANDATORY FORMAT: Start with a 2-3 line definition paragraph, then use NUMBERED POINTS for all remaining content
- Each numbered point should be on its own line starting with "1. ", "2. ", etc.
- Include: definitions, working principles, key characteristics, and real-world context
- Separate each point with a newline character
- NEVER write a single long paragraph — always break into points"""
    elif options.get("compact"):
        theory_instructions = """- Keep theory extremely brief (60-80 words max)
- MANDATORY FORMAT: 1-2 line definition, then 2-3 bullet points starting with "• "
- Each point on its own line separated by newline
- No elaboration, no paragraphs"""
    else:
        theory_instructions = """- MANDATORY FORMAT — theory MUST be structured as follows:
  Line 1-2: Brief definition of the topic (2-3 sentences max)
  Then a blank line
  Then KEY POINTS as numbered list:
  1. First key point
  2. Second key point
  3. Third key point
  (and so on, 4-6 points total)
- Each point MUST start with a number followed by a period ("1. ", "2. ", etc.)
- Each point should be 1-2 lines long
- Total length: 120-180 words
- NEVER write a single block paragraph — ALWAYS use the numbered point format
- This must look like structured lab manual notes, NOT an AI-generated essay"""

    if options.get("extra_viva"):
        viva_instructions = """- Generate 8-10 viva questions
- Mix basic, intermediate, and application-based questions
- Questions must be exam-focused"""
    else:
        viva_instructions = """- Minimum 5 questions
- Questions must be basic and exam-focused"""

    if options.get("code_explanation"):
        code_instructions = """- Clean and well-structured code
- Proper indentation
- Include necessary headers only
- Do NOT include comments inside the code itself
- After the complete code block, add a section called "CODE EXPLANATION:"
  that explains the logic step by step in 5-8 bullet points
- Code must be submission-ready
- MUST include a print statement at the end that outputs the student's name and roll number"""
    else:
        code_instructions = """- Clean and minimal code
- Proper indentation
- Include necessary headers only
- Do NOT include comments (no // or /* */)
- Do NOT add explanations inside code
- Code must be submission-ready
- MUST include a print statement at the end that outputs the student's name and roll number"""

    if options.get("compact"):
        output_instructions = "- Provide brief, minimal sample output (2-3 lines)"
    else:
        output_instructions = "- Provide realistic sample output of the program, including the student name and roll number output"

    # ─── Section inclusion control ──────────────────────────────
    # Default: all sections included (True)
    include_theory = options.get("include_theory", True)
    include_code = options.get("include_code", True)
    include_viva = options.get("include_viva", True)
    include_output = options.get("include_output", True)

    # Build prompt sections — skip sections the user disabled
    theory_block = f"""2. THEORY:
{theory_instructions}""" if include_theory else """2. THEORY:
- Write exactly: "(Not included)"
- Do NOT generate any theory content"""

    code_block = f"""3. SOURCE CODE:
{code_instructions}""" if include_code else """3. SOURCE CODE:
- Write exactly: "(Not included)"
- Do NOT generate any code"""

    viva_block = f"""4. VIVA VOCE:
{viva_instructions}""" if include_viva else """4. VIVA VOCE:
- Return a single question with question "(Not included)" and answer "(Not included)"
- Do NOT generate any viva questions"""

    output_block = f"""5. OUTPUT:
{output_instructions}""" if include_output else """5. OUTPUT:
- Write exactly: "(Not included)"
- Do NOT generate any output"""

    # ─── Layer 3: AI Generation (Gemini → Groq) ────────────────
    prompt = f"""You are an expert lab instructor for Indian university students.
Generate a complete lab experiment file for the following:

Subject: {subject}
Experiment Number: {experiment_no}
Topic/Title: {topic}

STRUCTURE (MUST FOLLOW EXACTLY):
1. AIM:
- 1-2 line clear statement

{theory_block}

{code_block}

{viva_block}

{output_block}

STRICT RULES:
- Do NOT change section order
- Do NOT skip any section
- Do NOT add extra explanation anywhere
- Keep output consistent every time"""

    result = _generate_with_fallback(prompt, ExperimentSchema)
    data = result.model_dump()

    # Override disabled sections with clean placeholders
    if not include_theory:
        data["theory"] = "(Not included)"
    if not include_code:
        data["source_code"] = "(Not included)"
    if not include_viva:
        data["viva"] = [{"question": "(Not included)", "answer": "(Not included)"}]
    if not include_output:
        data["output"] = "(Not included)"

    # Store core content (no metadata) in caches
    response_data = {
        "theory": data["theory"],
        "source_code": data["source_code"],
        "viva": data["viva"],
        "output": data["output"]
    }
    _cache_set(cache_key, response_data)
    _redis_set(redis_key, response_data, 3600)

    # Inject metadata
    data["experiment_no"] = experiment_no
    data["aim"] = final_aim
    data["subject"] = subject
    data["topic"] = topic
    data["_cached"] = False

    return data


def modify_section(experiment: dict, section: str, instruction: str) -> dict:
    # Limit modifications per experiment (max 2)
    subject = experiment.get("subject")
    topic = experiment.get("topic")
    if subject and topic:
        usage_key = _make_key(subject, topic)

        if usage_key not in _modify_usage:
            _modify_usage[usage_key] = 0

        if _modify_usage[usage_key] >= 2:
            raise Exception("Modification limit reached for this experiment")

        _modify_usage[usage_key] += 1
    """
    Modify ONLY the specified section of an experiment.
    Other sections remain completely unchanged.
    """

    valid_sections = ["aim", "theory", "source_code", "viva", "output"]
    if section not in valid_sections:
        raise ValueError(f"Invalid section: {section}. Must be one of {valid_sections}")

    current_value = experiment.get(section, "")

    if section == "viva":
        current_value = json.dumps(current_value, indent=2)

    prompt = f"""You are an expert lab instructor for Indian university students.

You have an existing lab experiment. The student wants to modify ONLY the "{section}" section.

Current {section.upper()} content:
---
{current_value}
---

Student's instruction: {instruction}

Generate ONLY the modified {section} section. Follow these rules:
- Keep the same format and style
- Apply ONLY the requested change
- Keep content exam-oriented and suitable for Indian university lab records
- For viva: return a list of question-answer objects
- For source_code: return complete working code
- Do NOT include any other sections"""

    if section == "viva":
        # Special handling for viva — need list of VivaQuestion
        class VivaListSchema(BaseModel):
            viva: list[VivaQuestion]

        result = _generate_with_fallback(prompt, VivaListSchema)
        modified_content = result.model_dump()["viva"]
    else:
        # For simple string sections
        class SectionSchema(BaseModel):
            content: str

        prompt += "\n\nReturn the content as a JSON object with a single 'content' key."
        result = _generate_with_fallback(prompt, SectionSchema)
        modified_content = result.model_dump()["content"]

    # Update caches if subject and topic are available
    subject = experiment.get("subject")
    topic = experiment.get("topic")
    if subject and topic:
        cache_key = _make_key(subject, topic)
        redis_key = make_key(subject, topic)

        # Update in-memory cache
        cached_data = _cache_get(cache_key)
        if cached_data and section in ["theory", "source_code", "viva", "output"]:
            cached_data[section] = modified_content
            _cache_set(cache_key, cached_data)

        # Update Redis cache
        redis_data = _redis_get(redis_key)
        if redis_data and section in ["theory", "source_code", "viva", "output"]:
            redis_data[section] = modified_content
            _redis_set(redis_key, redis_data, 3600)

    return modified_content


def generate_ppt_content(subject: str, topic: str) -> dict:
    """Generate structured PPT slide content."""

    ppt_cache_key = _make_key(subject, topic, prefix="ppt")
    ppt_redis_key = f"ppt_{make_key(subject, topic)}"

    # Layer 1: In-memory cache
    cached_data = _cache_get(ppt_cache_key)
    if cached_data:
        data = json.loads(json.dumps(cached_data))
        data["_cached"] = True
        return data

    # Layer 2: Redis cache
    redis_data = _redis_get(ppt_redis_key)
    if redis_data:
        _cache_set(ppt_cache_key, redis_data)
        redis_data["_cached"] = True
        return redis_data

    # Layer 3: AI Generation
    prompt = f"""You are an expert professor creating a presentation for Indian university students.

Subject: {subject}
Topic: {topic}

Create a professional presentation with 8-12 slides. Structure:
1. Title Slide (just the topic name)
2. Introduction / Overview
3-9. Core content slides (key concepts, diagrams description, examples, algorithms, comparisons)
10. Applications / Use Cases
11. Advantages & Disadvantages
12. Summary / Conclusion

For each slide:
- Heading: Clear, descriptive heading
- Points: 4-6 bullet points, concise and exam-oriented

Keep content suitable for Indian university presentations.
Do NOT add unnecessary filler content."""

    result = _generate_with_fallback(prompt, PPTSchema)
    data = result.model_dump()

    _cache_set(ppt_cache_key, data)
    _redis_set(ppt_redis_key, data, 3600)

    data["_cached"] = False
    return data


def is_experiment_cached(subject: str, topic: str, options: dict = None) -> bool:
    """Check if an experiment result is already cached (no API call needed)."""
    if options is None:
        options = {}
    cache_key = _make_key(subject, topic, options=options)
    if _cache_get(cache_key) is not None:
        return True
    # Also check Redis
    redis_key = make_key(subject, topic)
    return _redis_get(redis_key) is not None


def is_ppt_cached(subject: str, topic: str) -> bool:
    """Check if a PPT result is already cached."""
    ppt_cache_key = _make_key(subject, topic, prefix="ppt")
    if _cache_get(ppt_cache_key) is not None:
        return True
    ppt_redis_key = f"ppt_{make_key(subject, topic)}"
    return _redis_get(ppt_redis_key) is not None
