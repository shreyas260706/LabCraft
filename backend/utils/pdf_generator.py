"""
PDF Generator — Professional lab experiment PDFs using ReportLab.

Key design principles:
  • Section integrity: KeepTogether prevents awkward mid-section page breaks.
  • Smart code placement: heading + code are grouped — only splits if code
    exceeds a full page height.  Minimum 8 lines before allowing a split.
  • Page furniture: Header (experiment title) and footer (page numbers) on
    every page via onPage callbacks.
  • Typography hierarchy: Title → Section Heading → Body → Bullet → Code.
  • Generous spacing: readable theory bullets, viva Q&A, and section gaps.
"""
import io
import re
import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, Flowable, KeepTogether
)


# ════════════════════════════════════════════════════════════════════
#  Code Preprocessing Helpers
# ════════════════════════════════════════════════════════════════════

def _strip_code_fences(code: str) -> str:
    """Remove markdown ```...``` fences from code blocks."""
    code = code.strip()
    if code.startswith("```"):
        lines = code.split("\n")
        lines = lines[1:] if lines[0].startswith("```") else lines
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        code = "\n".join(lines)
    return code


def _unescape_text(text: str) -> str:
    """Unescape literal \\n and \\t sequences from AI-generated text."""
    if not isinstance(text, str):
        return text
    return text.replace("\\n", "\n").replace("\\t", "\t")


def _reformat_single_line_code(code: str) -> str:
    """
    Detect if code was collapsed into a single line and reformat it.
    Handles common C/C++/Java/Python patterns.
    """
    if code.count("\n") >= 3:
        return code

    if "{" in code or ";" in code:
        code = re.sub(r'\s*\{\s*', ' {\n', code)
        code = re.sub(r'\s*\}\s*', '\n}\n', code)
        lines = code.split("\n")
        expanded = []
        for line in lines:
            stripped = line.strip()
            if re.match(r'^\s*for\s*\(', stripped):
                expanded.append(line)
                continue
            parts = re.split(r'(;)', stripped)
            current = ""
            for part in parts:
                current += part
                if part == ";":
                    expanded.append(current)
                    current = ""
            if current.strip():
                expanded.append(current)
        code = "\n".join(expanded)

    elif "def " in code or "import " in code or "print(" in code:
        keywords = ["import ", "from ", "def ", "class ", "if ", "elif ",
                     "else:", "for ", "while ", "return ", "print(", "try:",
                     "except ", "finally:", "with "]
        for kw in keywords:
            code = code.replace(kw, "\n" + kw)

    lines = code.split("\n")
    cleaned = []
    indent_level = 0
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith("}"):
            indent_level = max(0, indent_level - 1)
        cleaned.append("    " * indent_level + stripped)
        if stripped.endswith("{"):
            indent_level += 1

    return "\n".join(cleaned)


def _wrap_long_lines(code: str, max_chars: int = 90) -> str:
    """Wrap lines that exceed max_chars to prevent overflow beyond page margins."""
    lines = code.split("\n")
    wrapped = []
    for line in lines:
        if len(line) <= max_chars:
            wrapped.append(line)
            continue

        leading = len(line) - len(line.lstrip())
        indent = line[:leading]
        cont_indent = indent + "    "

        current = line
        while len(current) > max_chars:
            break_at = max_chars
            for i in range(max_chars - 1, max(max_chars - 25, leading + 10), -1):
                if current[i] in " ,+-=&|<>()":
                    break_at = i + 1
                    break
            wrapped.append(current[:break_at])
            current = cont_indent + current[break_at:].lstrip()

        if current.strip():
            wrapped.append(current)

    return "\n".join(wrapped)


def _preprocess_code(code: str) -> str:
    """Full pipeline: strip fences → reformat single-line → wrap long lines."""
    code = _strip_code_fences(code)
    code = _reformat_single_line_code(code)
    code = _wrap_long_lines(code, max_chars=90)
    return code


def _is_sql_code(code: str) -> bool:
    """Detect if a code block contains SQL by checking for common SQL keywords."""
    code_upper = code.upper()
    sql_keywords = ["SELECT ", "CREATE TABLE", "INSERT INTO", "DROP TABLE",
                    "ALTER TABLE", "DELETE FROM", "UPDATE ", "DELIMITER",
                    "CREATE PROCEDURE", "CREATE FUNCTION", "CREATE TRIGGER",
                    "CREATE VIEW"]
    hits = sum(1 for kw in sql_keywords if kw in code_upper)
    return hits >= 2  # at least 2 SQL keywords = likely SQL


# ════════════════════════════════════════════════════════════════════
#  Splittable Code Block — splits cleanly across page boundaries
# ════════════════════════════════════════════════════════════════════

class SplittableCodeBlock(Flowable):
    """
    A code block that renders with a background fill and left accent border.
    Implements split() so ReportLab can break it across pages at line
    boundaries, inserting a continuation header on the new page.

    Split policy:
      - At least MIN_LINES_BEFORE_SPLIT lines must fit to allow a split.
      - At least MIN_LINES_REMAINDER lines must remain for the second part.
      - If either condition fails, the block is pushed whole to the next page.
    """

    MIN_LINES_BEFORE_SPLIT = 8
    MIN_LINES_REMAINDER = 4

    def __init__(self, code_text, max_width, title="SOURCE CODE",
                 font_name="Courier", font_size=8, leading=10.8,
                 padding=8, bg_color="#f4f4f8", border_color="#6c63ff",
                 is_continuation=False):
        super().__init__()
        self.code_text = code_text
        self.font_name = font_name
        self.font_size = font_size
        self.leading = leading
        self.padding = padding
        self.bg_color = colors.HexColor(bg_color)
        self.border_color = colors.HexColor(border_color)
        self.max_width = max_width
        self.title = title
        self.is_continuation = is_continuation
        self._lines = code_text.split("\n")
        # Continuation header adds a small label at the top
        self._header_height = 18 if is_continuation else 0

    def wrap(self, availWidth, availHeight):
        self.width = min(availWidth, self.max_width)
        self.height = (
            len(self._lines) * self.leading
            + self.padding * 2
            + self._header_height
        )
        return (self.width, self.height)

    def _get_bg_hex(self):
        return self.bg_color.hexval() if hasattr(self.bg_color, 'hexval') else "#f4f4f8"

    def _get_border_hex(self):
        return self.border_color.hexval() if hasattr(self.border_color, 'hexval') else "#6c63ff"

    def split(self, availWidth, availHeight):
        """
        Split the code block at a line boundary.
        Returns [first_part, second_part] or [] if unsplittable.
        """
        total_lines = len(self._lines)

        # How many lines can physically fit?
        usable = availHeight - self.padding * 2 - self._header_height
        lines_that_fit = max(0, int(usable / self.leading))

        # If everything fits, no split needed
        if lines_that_fit >= total_lines:
            return [self]

        remaining_lines = total_lines - lines_that_fit

        # Enforce minimum thresholds — refuse to split if the result
        # would leave an awkwardly small chunk on either side
        if lines_that_fit < self.MIN_LINES_BEFORE_SPLIT:
            return []  # push entire block to next page

        if remaining_lines < self.MIN_LINES_REMAINDER:
            return []  # push entire block to next page

        first_text = "\n".join(self._lines[:lines_that_fit])
        rest_text = "\n".join(self._lines[lines_that_fit:])

        first = SplittableCodeBlock(
            first_text, self.max_width, title=self.title,
            font_name=self.font_name, font_size=self.font_size,
            leading=self.leading, padding=self.padding,
            bg_color=self._get_bg_hex(), border_color=self._get_border_hex(),
            is_continuation=self.is_continuation,
        )
        second = SplittableCodeBlock(
            rest_text, self.max_width, title=self.title,
            font_name=self.font_name, font_size=self.font_size,
            leading=self.leading, padding=self.padding,
            bg_color=self._get_bg_hex(), border_color=self._get_border_hex(),
            is_continuation=True,
        )
        return [first, second]

    def draw(self):
        canvas = self.canv
        w = self.width
        h = self.height
        p = self.padding

        # Background
        canvas.setFillColor(self.bg_color)
        canvas.roundRect(0, 0, w, h, radius=4, fill=1, stroke=0)

        # Left accent bar
        canvas.setFillColor(self.border_color)
        canvas.roundRect(0, 0, 4, h, radius=2, fill=1, stroke=0)

        # Continuation header
        text_start_y = h - p - self.font_size
        if self.is_continuation:
            canvas.setFont("Helvetica-Oblique", 7.5)
            canvas.setFillColor(colors.HexColor("#6c63ff"))
            canvas.drawString(p + 6, h - 13, f"{self.title} (continued)")
            text_start_y -= self._header_height

        # Code text
        canvas.setFont(self.font_name, self.font_size)
        canvas.setFillColor(colors.HexColor("#1a1a2e"))

        text_x = p + 6
        text_y = text_start_y

        for line in self._lines:
            line = line.replace("\t", "    ")
            canvas.drawString(text_x, text_y, line)
            text_y -= self.leading


# ════════════════════════════════════════════════════════════════════
#  Section-Divider Accent Line
# ════════════════════════════════════════════════════════════════════

class SectionAccentLine(Flowable):
    """A thin coloured line drawn under a section heading."""

    def __init__(self, width, color="#6c63ff", thickness=1.5):
        super().__init__()
        self._line_width = width
        self._color = colors.HexColor(color)
        self._thickness = thickness

    def wrap(self, availWidth, availHeight):
        self.width = min(availWidth, self._line_width)
        self.height = self._thickness + 4
        return (self.width, self.height)

    def draw(self):
        self.canv.setStrokeColor(self._color)
        self.canv.setLineWidth(self._thickness)
        self.canv.line(0, 2, self.width * 0.3, 2)


# ════════════════════════════════════════════════════════════════════
#  Page Header / Footer Callback
# ════════════════════════════════════════════════════════════════════

def _make_page_callback(exp_no, subject):
    """Return an onPage callback that draws header and footer."""

    def _on_page(canvas, doc):
        canvas.saveState()
        page_w, page_h = A4

        # ── Header ──
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(colors.HexColor("#94a3b8"))
        left_text = f"Experiment {exp_no}"
        right_text = subject or ""
        canvas.drawString(18 * mm, page_h - 14 * mm, left_text)
        canvas.drawRightString(page_w - 18 * mm, page_h - 14 * mm, right_text)

        # Thin header line
        canvas.setStrokeColor(colors.HexColor("#e2e8f0"))
        canvas.setLineWidth(0.5)
        canvas.line(18 * mm, page_h - 16 * mm, page_w - 18 * mm, page_h - 16 * mm)

        # ── Footer ──
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(colors.HexColor("#94a3b8"))
        page_num = canvas.getPageNumber()
        canvas.drawCentredString(page_w / 2, 10 * mm, f"— {page_num} —")

        canvas.restoreState()

    return _on_page


# ════════════════════════════════════════════════════════════════════
#  Styles
# ════════════════════════════════════════════════════════════════════

def _build_styles():
    """Create all custom ParagraphStyles used in the PDF."""
    styles = getSampleStyleSheet()

    styles.add(ParagraphStyle(
        name="ExpTitle",
        parent=styles["Heading1"],
        fontSize=16,
        textColor=colors.HexColor("#1a1a2e"),
        spaceAfter=4,
        alignment=TA_CENTER,
        fontName="Helvetica-Bold",
    ))

    styles.add(ParagraphStyle(
        name="SectionHead",
        parent=styles["Heading2"],
        fontSize=13,
        textColor=colors.HexColor("#16213e"),
        spaceBefore=18,
        spaceAfter=4,
        fontName="Helvetica-Bold",
        borderWidth=0,
        borderPadding=0,
        leftIndent=0,
    ))

    styles.add(ParagraphStyle(
        name="BodyText2",
        parent=styles["BodyText"],
        fontSize=11,
        leading=17,
        alignment=TA_JUSTIFY,
        fontName="Helvetica",
        textColor=colors.HexColor("#2d2d2d"),
        spaceAfter=6,
    ))

    styles.add(ParagraphStyle(
        name="BulletPoint",
        parent=styles["BodyText"],
        fontSize=10.5,
        leading=16,
        alignment=TA_LEFT,
        fontName="Helvetica",
        textColor=colors.HexColor("#2d2d2d"),
        leftIndent=20,
        spaceBefore=2,
        spaceAfter=6,
        bulletIndent=6,
    ))

    styles.add(ParagraphStyle(
        name="VivaQuestion",
        parent=styles["BodyText"],
        fontSize=10.5,
        leading=15,
        fontName="Helvetica-Bold",
        textColor=colors.HexColor("#1a1a2e"),
        spaceBefore=4,
        spaceAfter=2,
    ))

    styles.add(ParagraphStyle(
        name="VivaAnswer",
        parent=styles["BodyText"],
        fontSize=10.5,
        leading=15,
        fontName="Helvetica",
        textColor=colors.HexColor("#374151"),
        leftIndent=12,
        spaceAfter=10,
    ))

    styles.add(ParagraphStyle(
        name="MetaText",
        parent=styles["BodyText"],
        fontSize=10,
        leading=14,
        fontName="Helvetica",
        textColor=colors.HexColor("#4b5563"),
        alignment=TA_LEFT,
    ))

    return styles


# ════════════════════════════════════════════════════════════════════
#  Section Builders — each returns a list of flowables
# ════════════════════════════════════════════════════════════════════

def _build_theory_section(theory_raw: str, styles, content_width: float):
    """
    Parse theory into definition paragraphs + numbered/bullet points.

    Adds generous spacing between bullet points and after definition
    paragraphs to avoid the "compressed wall of text" feel.
    """
    heading = [
        Paragraph("THEORY", styles["SectionHead"]),
        SectionAccentLine(content_width),
        Spacer(1, 6),
    ]

    body = []
    lines = [line.strip() for line in theory_raw.split("\n") if line.strip()]

    for line in lines:
        is_bullet = (
            re.match(r'^\d+[.)]\s', line) or
            line.startswith("• ") or
            line.startswith("- ") or
            line.startswith("* ")
        )
        if is_bullet:
            body.append(Paragraph(line, styles["BulletPoint"]))
        else:
            body.append(Paragraph(line, styles["BodyText2"]))

    body.append(Spacer(1, 8))

    # Wrap heading + body in KeepTogether.
    # If theory is longer than a page, ReportLab falls through gracefully
    # because Paragraphs are natively splittable.
    return [KeepTogether(heading + body)]


def _build_code_section(code_raw: str, content_width: float, wide_content_width: float = None):
    """
    Build the SOURCE CODE section.

    The heading and code block are wrapped together in KeepTogether so that:
      - For small/medium code: heading + code move together to the next page
        rather than splitting the heading from the code.
      - For large code (> 1 page): KeepTogether's fallthrough lets the
        SplittableCodeBlock.split() handle the break at line boundaries.

    Uses orange accent for SQL code blocks to visually distinguish them.
    Uses a wider content area (narrower margins) for better code readability.
    """
    styles = _build_styles()
    code = _preprocess_code(code_raw)

    # Use wider area for code sections
    effective_width = wide_content_width or content_width

    # Detect SQL and use different accent color
    is_sql = _is_sql_code(code)
    border_color = "#e67e22" if is_sql else "#6c63ff"  # orange for SQL, purple for others

    heading_flowables = [
        Paragraph("SOURCE CODE", styles["SectionHead"]),
        SectionAccentLine(effective_width, color=border_color),
        Spacer(1, 6),
    ]

    code_block = SplittableCodeBlock(
        code, max_width=effective_width, title="SOURCE CODE",
        font_name="Courier", font_size=8, leading=10.8, padding=8,
        bg_color="#f4f4f8", border_color=border_color,
    )

    # GROUP heading + code inside KeepTogether
    return [KeepTogether(heading_flowables + [code_block]), Spacer(1, 10)]


def _build_viva_section(viva_list: list, styles, content_width: float):
    """
    Build VIVA VOCE section.

    Each Q&A pair is kept together. The section heading is grouped with
    the first Q&A pair to prevent orphan headings.
    """
    heading = [
        Paragraph("VIVA VOCE", styles["SectionHead"]),
        SectionAccentLine(content_width),
        Spacer(1, 6),
    ]

    qa_groups = []
    for i, qa in enumerate(viva_list, 1):
        q = qa.get("question", "")
        a = qa.get("answer", "")
        pair = KeepTogether([
            Paragraph(f"<b>Q{i}.</b>  {q}", styles["VivaQuestion"]),
            Paragraph(f"<b>Ans.</b>  {a}", styles["VivaAnswer"]),
        ])
        qa_groups.append(pair)

    # Keep heading attached to the first Q&A pair
    if qa_groups:
        first_group = KeepTogether(heading + [qa_groups[0]])
        return [first_group] + qa_groups[1:] + [Spacer(1, 8)]
    else:
        return [KeepTogether(heading)] + [Spacer(1, 8)]


def _build_output_section(output_raw: str, content_width: float, wide_content_width: float = None):
    """
    Build OUTPUT section.

    Heading + output block are grouped in KeepTogether to prevent
    heading/content separation.
    Uses a wider content area for better table/terminal output alignment.
    """
    styles = _build_styles()
    output = _strip_code_fences(output_raw)
    output = _wrap_long_lines(output, max_chars=90)

    # Use wider area for output sections
    effective_width = wide_content_width or content_width

    heading_flowables = [
        Paragraph("OUTPUT", styles["SectionHead"]),
        SectionAccentLine(effective_width),
        Spacer(1, 6),
    ]

    output_block = SplittableCodeBlock(
        output, max_width=effective_width, title="OUTPUT",
        font_name="Courier", font_size=8, leading=10.8, padding=8,
        bg_color="#f0fdf4", border_color="#10b981",
    )

    # GROUP heading + output block together
    return [KeepTogether(heading_flowables + [output_block])]


# ════════════════════════════════════════════════════════════════════
#  Main PDF Generator
# ════════════════════════════════════════════════════════════════════

def generate_experiment_pdf(experiment: dict) -> io.BytesIO:
    """Generate a professionally formatted, paginated PDF for a lab experiment.

    Supports style-profile-aware section ordering. When a _style_profile is
    present, the sections_order from the matching profile controls the layout
    (e.g., MAIT DBMS puts OUTPUT before VIVA QUESTIONS).
    """
    buffer = io.BytesIO()

    # Unescape all text fields before rendering
    for key, value in experiment.items():
        if isinstance(value, str):
            experiment[key] = _unescape_text(value)
        elif isinstance(value, list) and key == "viva":
            for qa in value:
                if isinstance(qa, dict):
                    if "question" in qa:
                        qa["question"] = _unescape_text(qa["question"])
                    if "answer" in qa:
                        qa["answer"] = _unescape_text(qa["answer"])

    exp_no = experiment.get("experiment_no", "")
    subject = experiment.get("subject", "")

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=22 * mm,
        bottomMargin=18 * mm,
    )

    # Standard content width (used for AIM, THEORY, VIVA — academic readability)
    content_width = A4[0] - 50 * mm
    # Wide content width (used for SOURCE CODE and OUTPUT — maximises usable space)
    wide_content_width = A4[0] - 36 * mm
    styles = _build_styles()
    page_callback = _make_page_callback(exp_no, subject)

    elements = []

    # ── Title Block ──
    title_block = [
        Spacer(1, 6),
        Paragraph(f"EXPERIMENT NO. {exp_no}", styles["ExpTitle"]),
    ]

    date_str = datetime.datetime.now().strftime("%d/%m/%Y")
    title_block.append(
        Paragraph(f"<b>DATE:</b> {date_str}", styles["MetaText"])
    )

    title_block.append(HRFlowable(
        width="100%", thickness=2,
        color=colors.HexColor("#0f3460"),
        spaceBefore=6, spaceAfter=12,
    ))
    elements.append(KeepTogether(title_block))

    # ── AIM (always first — keep with heading) ──
    aim_text = experiment.get("aim", "").replace("\n", "<br/>")
    aim_block = [
        Paragraph("AIM", styles["SectionHead"]),
        SectionAccentLine(content_width),
        Spacer(1, 4),
        Paragraph(aim_text, styles["BodyText2"]),
        Spacer(1, 8),
    ]
    elements.append(KeepTogether(aim_block))

    # ── Determine section order ──
    # Default: THEORY → SOURCE CODE → VIVA VOCE → OUTPUT
    # Style profiles can override this (e.g., MAIT DBMS: THEORY → SOURCE CODE → OUTPUT → VIVA QUESTIONS)
    default_order = ["THEORY", "SOURCE CODE", "VIVA VOCE", "OUTPUT"]

    style_profile_name = experiment.get("_style_profile", "")
    if style_profile_name:
        try:
            from services.syllabus_matcher import get_style_profile
            profile = get_style_profile(style_profile_name)
            profile_order = profile.get("sections_order", [])
            if profile_order:
                # Map profile section names to our internal names
                name_map = {
                    "AIM": None,  # AIM is always first, already added
                    "THEORY": "THEORY",
                    "SOURCE CODE": "SOURCE CODE",
                    "OUTPUT": "OUTPUT",
                    "VIVA QUESTIONS": "VIVA VOCE",
                    "VIVA VOCE": "VIVA VOCE",
                }
                mapped = [name_map.get(s.upper(), s.upper()) for s in profile_order if name_map.get(s.upper()) is not None]
                if mapped:
                    default_order = mapped
        except Exception:
            pass  # fallback to default order silently

    # ── Build section content lazily ──
    def _get_theory():
        theory_raw = experiment.get("theory", "")
        if theory_raw and theory_raw != "(Not included)":
            return _build_theory_section(theory_raw, styles, content_width)
        return []

    def _get_code():
        code_raw = experiment.get("source_code", "")
        if code_raw and code_raw != "(Not included)":
            return _build_code_section(code_raw, content_width, wide_content_width)
        return []

    def _get_viva():
        viva = experiment.get("viva", [])
        if viva and not (len(viva) == 1 and viva[0].get("question") == "(Not included)"):
            return _build_viva_section(viva, styles, content_width)
        return []

    def _get_output():
        output_raw = experiment.get("output", "")
        if output_raw and output_raw != "(Not included)":
            return _build_output_section(output_raw, content_width, wide_content_width)
        return []

    section_builders = {
        "THEORY": _get_theory,
        "SOURCE CODE": _get_code,
        "VIVA VOCE": _get_viva,
        "OUTPUT": _get_output,
    }

    # Add sections in the determined order
    for section_name in default_order:
        builder = section_builders.get(section_name)
        if builder:
            elements.extend(builder())

    # ── Build ──
    doc.build(elements, onFirstPage=page_callback, onLaterPages=page_callback)
    buffer.seek(0)
    return buffer
