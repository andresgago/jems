"""PDF generation for fleet documents.

Mirrors the legacy TMS "New AVI" feature (Trailer.php / TrailerController::
actionGenerateAvi): stamp vehicle + company data onto a static inspection
form template. Legacy used Mpdf's ImportPage/UseTemplate overlay technique;
here we use pypdf (read the template, merge an overlay page) + reportlab
(draw the overlay text), which is the standard Python equivalent.

The overlay coordinates below were calibrated visually against the actual
template at apps/fleet/static/fleet/annual_inspection.pdf (a 612x792pt /
US Letter page) — they are NOT a translation of the legacy Mpdf pixel
coordinates, which were positioned against Mpdf's own internal working
canvas and did not correspond 1:1 to the template's real page box.
"""

from __future__ import annotations

import datetime
import io
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

from .models import Trailer

COMPANY_NAME = "Jobee Express LLC"

TRAILER_AVI_TEMPLATE = (
    Path(__file__).resolve().parent / "static" / "fleet" / "annual_inspection.pdf"
)


def _build_overlay(positioned_fields: dict[tuple[float, float], str]) -> io.BytesIO:
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    c.setFont("Helvetica-Bold", 10.5)
    for (x, y), text in positioned_fields.items():
        if text:
            c.drawString(x, y, text)
    c.save()
    buffer.seek(0)
    return buffer


def generate_trailer_avi_pdf(trailer: Trailer) -> bytes:
    """Overlay trailer + company data onto the Annual Inspection template."""
    writer = PdfWriter(clone_from=str(TRAILER_AVI_TEMPLATE))
    template_page = writer.pages[0]

    positioned_fields: dict[tuple[float, float], str] = {
        (75, 689): COMPANY_NAME,
        (75, 675): trailer.number or "",
        (95, 660): _format_date(trailer.annual_inspection_expiration),
        (381, 673): trailer.vin or "",
    }

    overlay_reader = PdfReader(_build_overlay(positioned_fields))
    template_page.merge_page(overlay_reader.pages[0])

    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()


def _format_date(value: datetime.date | None) -> str:
    return value.strftime("%Y-%m-%d") if value else ""
