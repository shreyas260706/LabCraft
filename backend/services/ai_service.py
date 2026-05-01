"""
AI Service — Gemini 2.5 Flash integration with strict JSON validation and retry logic.
"""
import json
import time
import random
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


# ─── Global State & Cache ───────────────────────────────────────────
_cache = {}
_CACHE_TTL = 3600  # 1 hour
_MAX_CACHE_SIZE = 200
_cache_lock = Lock()

_modify_usage = {}  # key: subject_topic → count
_rate_limit_usage = {} # key: ip -> list of timestamps
_key_index = 0

# ─── Cache Helpers ──────────────────────────────────────────────────

def _make_key(subject: str, topic: str, prefix: str = "", options: dict = None) -> str:
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

def _cache_get(key: str):
    with _cache_lock:
        entry = _cache.get(key)
        if entry and (time.time() - entry["timestamp"]) < _CACHE_TTL:
            print(f"[AI Service] CACHE HIT: {key}")
            return entry["data"]
    print(f"[AI Service] CACHE MISS: {key}")
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

# ─── Gemini Client ──────────────────────────────────────────────────

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


def _get_client():
    """Get a Gemini client instance using round-robin API key rotation."""
    global _key_index
    if not Config.GEMINI_KEYS:
        raise ValueError("No Gemini API keys configured.")
        
    key = Config.GEMINI_KEYS[_key_index % len(Config.GEMINI_KEYS)]
    _key_index += 1
    
    # Log which key is being used (masked for security)
    masked = f"{key[:5]}...{key[-3:]}" if len(key) > 8 else "HIDDEN"
    print(f"[AI Service] Using API Key: {masked}")
    
    return genai.Client(api_key=key)


def _generate_with_retry(prompt: str, schema, max_retries: int = None):
    """
    Generate structured content with Gemini, with validation and exponential backoff retry.
    Uses Pydantic schema for strict JSON output.
    """
    if max_retries is None:
        max_retries = Config.MAX_RETRIES

    # Check IP-based rate limit BEFORE attempting any generation
    _check_rate_limit()

    last_error = None

    for attempt in range(max_retries):
        try:
            client = _get_client()
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
                # Fallback: try manual JSON parse + Pydantic validation
                raw_text = response.text
                data = json.loads(raw_text)
                parsed = schema.model_validate(data)

            return parsed

        except (ValidationError, json.JSONDecodeError, Exception) as e:
            last_error = e
            if attempt < max_retries - 1:
                # Exponential backoff: (2 ** attempt) + random jitter (0 to 1)
                sleep_s = (2 ** attempt) + random.uniform(0, 1)
                print(f"[AI Service] Attempt {attempt + 1} failed with error: {str(e)[:50]}... Retrying in {sleep_s:.2f}s")
                time.sleep(sleep_s)
                continue

    if last_error:
        print(f"[AI Service Error] Generation failed after {max_retries} attempts. Final error: {last_error}")
    raise Exception("AI servers are busy. Please try again in a few seconds.")


# ─── Public API ─────────────────────────────────────────────────────

def generate_experiment(subject: str, experiment_no: int, topic: str, aim: str = None, options: dict = None) -> dict:
    """Generate a complete lab experiment with strict formatting."""

    if not subject or not topic:
        raise ValueError("Both subject and topic are required")

    if options is None:
        options = {}

    cache_key = _make_key(subject, topic, options=options)

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

    cached_data = _cache_get(cache_key)
    if cached_data:
        data = json.loads(json.dumps(cached_data))
        data["experiment_no"] = experiment_no
        data["aim"] = final_aim
        data["subject"] = subject
        data["topic"] = topic
        data["_cached"] = True
        return data

    # ─── Build dynamic prompt based on options ──────────────────
    theory_instructions = ""
    viva_instructions = ""
    code_instructions = ""
    output_instructions = ""

    if options.get("detailed_theory"):
        theory_instructions = """- Write a thorough, in-depth theory section
- Include definitions, working principles, and real-world context
- Length: 250-350 words
- Use clear sub-sections or numbered points"""
    elif options.get("compact"):
        theory_instructions = """- Keep theory extremely brief (60-80 words max)
- Only essential definition and 2-3 key points
- No elaboration"""
    else:
        theory_instructions = """- Do NOT write long paragraphs
- Keep it structured and concise
- Format: Definition (2-3 lines) followed by Key points in bullet form
- Maximum length: 120-150 words
- Must look like a lab manual (not AI-generated essay)"""

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

    # Cache MISS
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

    result = _generate_with_retry(prompt, ExperimentSchema)
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
    
    # Store ONLY allowed fields in cache
    _cache_set(cache_key, {
        "theory": data["theory"],
        "source_code": data["source_code"],
        "viva": data["viva"],
        "output": data["output"]
    })

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

        result = _generate_with_retry(prompt, VivaListSchema)
        modified_content = result.model_dump()["viva"]
    else:
        # For simple string sections
        class SectionSchema(BaseModel):
            content: str

        prompt += "\n\nReturn the content as a JSON object with a single 'content' key."
        result = _generate_with_retry(prompt, SectionSchema)
        modified_content = result.model_dump()["content"]
        
    # Update cache if subject and topic are available
    subject = experiment.get("subject")
    topic = experiment.get("topic")
    if subject and topic:
        cache_key = _make_key(subject, topic)
        
        # We only update cache if the base entry exists, to preserve other options
        cached_data = _cache_get(cache_key)
        if cached_data and section in ["theory", "source_code", "viva", "output"]:
            cached_data[section] = modified_content
            _cache_set(cache_key, cached_data)
            
    return modified_content


def generate_ppt_content(subject: str, topic: str) -> dict:
    """Generate structured PPT slide content."""

    ppt_cache_key = _make_key(subject, topic, prefix="ppt")

    cached_data = _cache_get(ppt_cache_key)
    if cached_data:
        data = json.loads(json.dumps(cached_data))
        data["_cached"] = True
        return data

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

    result = _generate_with_retry(prompt, PPTSchema)
    data = result.model_dump()

    _cache_set(ppt_cache_key, data)
    data["_cached"] = False
    return data


def is_experiment_cached(subject: str, topic: str, options: dict = None) -> bool:
    """Check if an experiment result is already cached (no API call needed)."""
    if options is None:
        options = {}
    cache_key = _make_key(subject, topic, options=options)
    return _cache_get(cache_key) is not None


def is_ppt_cached(subject: str, topic: str) -> bool:
    """Check if a PPT result is already cached."""
    ppt_cache_key = _make_key(subject, topic, prefix="ppt")
    return _cache_get(ppt_cache_key) is not None
