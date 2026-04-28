"""
PDF Generator — Creates lab experiment PDFs using ReportLab.
University lab file format with proper headers, code blocks, and viva table.
"""
import io
import re
import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, mm
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, Preformatted, Flowable, KeepTogether
)
from reportlab.lib.fonts import addMapping


# ── Code Preprocessing Helpers ──────────────────────────────────────

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


def _reformat_single_line_code(code: str) -> str:
    """
    Detect if code was collapsed into a single line and reformat it.
    Handles common C/C++/Java/Python patterns.
    """
    # If there are already multiple lines, leave it alone
    if code.count("\n") >= 3:
        return code

    # ── C/C++/Java style: split on braces, semicolons ──
    # Insert newlines before/after braces and after semicolons
    if "{" in code or ";" in code:
        # Add newline before { unless it's the very start
        code = re.sub(r'\s*\{\s*', ' {\n', code)
        # Add newline before }
        code = re.sub(r'\s*\}\s*', '\n}\n', code)
        # Add newline after ; (but not inside for-loop headers)
        # Split by semicolons carefully
        lines = code.split("\n")
        expanded = []
        for line in lines:
            stripped = line.strip()
            # Don't split for-loop headers: for(init; cond; incr)
            if re.match(r'^\s*for\s*\(', stripped):
                expanded.append(line)
                continue
            # Split on ; but keep the ;
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

    # ── Python style: split on common keywords at line starts ──
    elif "def " in code or "import " in code or "print(" in code:
        keywords = ["import ", "from ", "def ", "class ", "if ", "elif ",
                     "else:", "for ", "while ", "return ", "print(", "try:",
                     "except ", "finally:", "with "]
        for kw in keywords:
            code = code.replace(kw, "\n" + kw)

    # Clean up: remove excessive blank lines, fix indentation
    lines = code.split("\n")
    cleaned = []
    indent_level = 0
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        # Decrease indent before closing brace
        if stripped.startswith("}"):
            indent_level = max(0, indent_level - 1)

        cleaned.append("    " * indent_level + stripped)

        # Increase indent after opening brace
        if stripped.endswith("{"):
            indent_level += 1
        # Decrease indent after closing brace (for } on same line as other things)
        if stripped.endswith("}") and not stripped.startswith("}"):
            pass  # already handled

    return "\n".join(cleaned)


def _wrap_long_lines(code: str, max_chars: int = 78) -> str:
    """
    Wrap lines that exceed max_chars to prevent overflow beyond page margins.
    Preserves existing indentation on continuation lines.
    """
    lines = code.split("\n")
    wrapped = []
    for line in lines:
        if len(line) <= max_chars:
            wrapped.append(line)
            continue

        # Determine indentation of original line for continuation
        leading = len(line) - len(line.lstrip())
        indent = line[:leading]
        cont_indent = indent + "    "  # extra indent for wrapped continuation

        current = line
        while len(current) > max_chars:
            # Try to break at a reasonable point
            break_at = max_chars
            # Look for a good break point (space, comma, operator)
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
    code = _wrap_long_lines(code, max_chars=78)
    return code


# ── Custom Flowable: Bordered Code Block ────────────────────────────

class CodeBlock(Flowable):
    """
    A custom flowable that renders a code block with a background fill,
    a left accent border, and monospace text with proper line wrapping.
    """

    def __init__(self, code_text, max_width, font_name="Courier", font_size=8.5,
                 leading=11.5, padding=10, bg_color="#f4f4f8",
                 border_color="#6c63ff"):
        super().__init__()
        self.code_text = code_text
        self.font_name = font_name
        self.font_size = font_size
        self.leading = leading
        self.padding = padding
        self.bg_color = colors.HexColor(bg_color)
        self.border_color = colors.HexColor(border_color)
        self.max_width = max_width
        self._lines = code_text.split("\n")

    def wrap(self, availWidth, availHeight):
        self.width = min(availWidth, self.max_width)
        num_lines = len(self._lines)
        self.height = (num_lines * self.leading) + (self.padding * 2)
        return (self.width, self.height)

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

        # Text
        canvas.setFont(self.font_name, self.font_size)
        canvas.setFillColor(colors.HexColor("#1a1a2e"))

        text_x = p + 4  # offset past the accent bar
        text_y = h - p - self.font_size  # start from top

        for line in self._lines:
            # Replace tabs with spaces for consistent rendering
            line = line.replace("\t", "    ")
            canvas.drawString(text_x, text_y, line)
            text_y -= self.leading


# ── Main PDF Generator ──────────────────────────────────────────────

def generate_experiment_pdf(experiment: dict) -> io.BytesIO:
    """Generate a formatted PDF for a lab experiment."""
    buffer = io.BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=25 * mm,
        leftMargin=25 * mm,
        topMargin=25 * mm,
        bottomMargin=20 * mm,
    )

    # Available width for content (used by CodeBlock)
    content_width = A4[0] - 50 * mm

    styles = getSampleStyleSheet()

    # Custom styles
    styles.add(ParagraphStyle(
        name="ExpTitle",
        parent=styles["Heading1"],
        fontSize=16,
        textColor=colors.HexColor("#1a1a2e"),
        spaceAfter=6,
        alignment=TA_CENTER,
        fontName="Helvetica-Bold",
    ))

    styles.add(ParagraphStyle(
        name="SectionHead",
        parent=styles["Heading2"],
        fontSize=13,
        textColor=colors.HexColor("#16213e"),
        spaceBefore=18,
        spaceAfter=10,
        fontName="Helvetica-Bold",
        borderWidth=0,
        borderPadding=0,
        leftIndent=0,
    ))

    styles.add(ParagraphStyle(
        name="BodyText2",
        parent=styles["BodyText"],
        fontSize=11,
        leading=16,
        alignment=TA_JUSTIFY,
        fontName="Helvetica",
        textColor=colors.HexColor("#2d2d2d"),
    ))

    styles.add(ParagraphStyle(
        name="CodeStyle",
        fontName="Courier",
        fontSize=8.5,
        leading=11.5,
        textColor=colors.HexColor("#1a1a2e"),
        backColor=colors.HexColor("#f4f4f8"),
        leftIndent=14,
        rightIndent=10,
        spaceBefore=6,
        spaceAfter=6,
        borderWidth=0.5,
        borderColor=colors.HexColor("#d0d0d8"),
        borderPadding=10,
    ))

    elements = []

    # ── Title ──
    exp_no = experiment.get("experiment_no", "")
    elements.append(Paragraph(f"EXPERIMENT NO. {exp_no}", styles["ExpTitle"]))

    # ── DATE ──
    date_str = datetime.datetime.now().strftime("%d/%m/%Y")
    elements.append(Paragraph(f"<b>DATE:</b> {date_str}", styles["BodyText2"]))

    elements.append(HRFlowable(
        width="100%", thickness=2,
        color=colors.HexColor("#0f3460"),
        spaceAfter=12
    ))

    # ── AIM ──
    elements.append(Paragraph("AIM", styles["SectionHead"]))
    aim = experiment.get("aim", "").replace("\n", "<br/>")
    elements.append(Paragraph(aim, styles["BodyText2"]))

    # ── THEORY ──
    elements.append(Paragraph("THEORY", styles["SectionHead"]))
    theory = experiment.get("theory", "").replace("\n", "<br/>")
    elements.append(Paragraph(theory, styles["BodyText2"]))

    # ── SOURCE CODE ──
    elements.append(Paragraph("SOURCE CODE", styles["SectionHead"]))
    code = experiment.get("source_code", "")
    code = _preprocess_code(code)

    elements.append(Spacer(1, 4))
    code_block = CodeBlock(
        code,
        max_width=content_width,
        font_name="Courier",
        font_size=8.5,
        leading=11.5,
        padding=10,
        bg_color="#f4f4f8",
        border_color="#6c63ff",
    )
    elements.append(code_block)
    elements.append(Spacer(1, 8))

    # ── VIVA VOCE ──
    elements.append(Paragraph("VIVA VOCE", styles["SectionHead"]))
    viva = experiment.get("viva", [])
    if viva:
        for i, qa in enumerate(viva, 1):
            q = qa.get("question", "")
            a = qa.get("answer", "")
            elements.append(Paragraph(f"<b>Q{i}:</b> {q}", styles["BodyText2"]))
            elements.append(Paragraph(f"<b>A:</b> {a}", styles["BodyText2"]))
            elements.append(Spacer(1, 10))

    # ── OUTPUT ──
    elements.append(Paragraph("OUTPUT", styles["SectionHead"]))
    output = experiment.get("output", "")
    output = _strip_code_fences(output)
    output = _wrap_long_lines(output, max_chars=78)
    elements.append(Spacer(1, 4))
    output_block = CodeBlock(
        output,
        max_width=content_width,
        font_name="Courier",
        font_size=8.5,
        leading=11.5,
        padding=10,
        bg_color="#f4f4f8",
        border_color="#6c63ff",
    )
    elements.append(output_block)

    # Build PDF
    doc.build(elements)
    buffer.seek(0)
    return buffer
