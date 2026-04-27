"""
PDF Generator — Creates lab experiment PDFs using ReportLab.
University lab file format with proper headers, code blocks, and viva table.
"""
import io
import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, mm
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, Preformatted
)
from reportlab.lib.fonts import addMapping


def generate_experiment_pdf(experiment: dict) -> io.BytesIO:
    """Generate a formatted PDF for a lab experiment."""
    buffer = io.BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=20 * mm,
        leftMargin=20 * mm,
        topMargin=25 * mm,
        bottomMargin=20 * mm,
    )

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
        spaceBefore=16,
        spaceAfter=8,
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
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#1a1a1a"),
        backColor=colors.HexColor("#f5f5f5"),
        leftIndent=10,
        rightIndent=10,
        spaceBefore=6,
        spaceAfter=6,
        borderWidth=1,
        borderColor=colors.HexColor("#e0e0e0"),
        borderPadding=8,
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
    # Strip markdown code fences if present
    code = code.strip()
    if code.startswith("```"):
        lines = code.split("\n")
        # Remove first and last lines (``` markers)
        lines = lines[1:] if lines[0].startswith("```") else lines
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        code = "\n".join(lines)

    # Use Preformatted for code to preserve whitespace
    elements.append(Spacer(1, 4))
    code_text = Preformatted(code, styles["CodeStyle"])
    elements.append(code_text)

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
    elements.append(Preformatted(output, styles["CodeStyle"]))

    # Build PDF
    doc.build(elements)
    buffer.seek(0)
    return buffer
