"""
apps/notifications/email.py

Sales advice generation and delivery using reportlab for PDF generation.
reportlab is pure Python — no external system libraries required (Windows compatible).

pip install reportlab
"""

import io
import logging
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string

logger = logging.getLogger(__name__)


def _fmt_date(d) -> str:
    """Format a date or datetime as '12 May 2026' — Windows compatible."""
    if d is None:
        return '—'
    try:
        return d.strftime('%d %B %Y').lstrip('0')
    except Exception:
        return str(d)


def _build_context(sale) -> dict:
    """Build the template context from a fully-loaded Sale instance."""
    lot     = sale.lot
    stage   = lot.stage
    project = stage.project
    org     = sale.organisation
    buyer   = sale.primary_buyer

    sale_ref = str(sale.id).upper()[:8]

    if buyer.buyer_type == "individual":
        buyer_name = f"{buyer.first_name} {buyer.last_name}".strip()
    else:
        buyer_name = buyer.entity_name or buyer.display_name or "—"

    buyer_type_label = {
        "individual": "Individual",
        "company":    "Company",
        "trust":      "Trust",
    }.get(buyer.buyer_type, buyer.buyer_type.title())

    lot_type_label = {
        "land":           "Land",
        "house_and_land": "House & Land",
        "apartment":      "Apartment",
        "townhouse":      "Townhouse",
        "commercial":     "Commercial",
    }.get(lot.lot_type, lot.lot_type.title())

    deposit_amount = None
    deposit_type   = None
    try:
        dep = sale.deposit
        deposit_amount = f"{dep.amount:,.2f}"
        deposit_type   = dep.get_deposit_type_display()
    except Exception:
        pass

    buyer_solicitor_name  = None
    buyer_solicitor_firm  = None
    buyer_solicitor_email = None
    buyer_solicitor_phone = None
    if sale.solicitor:
        s = sale.solicitor
        buyer_solicitor_name  = f"{s.first_name} {s.last_name}".strip()
        buyer_solicitor_firm  = s.firm_name or None
        buyer_solicitor_email = s.email or None
        buyer_solicitor_phone = s.phone or None

    vendor_solicitor_name  = None
    vendor_solicitor_firm  = None
    vendor_solicitor_email = None
    if project.solicitor:
        vs = project.solicitor
        vendor_solicitor_name  = f"{vs.first_name} {vs.last_name}".strip()
        vendor_solicitor_firm  = vs.firm_name or None
        vendor_solicitor_email = vs.email or None

    agent_name   = None
    agent_agency = None
    if sale.agent:
        agent_name = f"{sale.agent.first_name} {sale.agent.last_name}".strip()
        if sale.agent.agency:
            agent_agency = sale.agent.agency.name

    sale_price = f"{sale.sale_price:,.2f}" if sale.sale_price else "—"
    lot_area   = f"{lot.land_area:,.0f}" if lot.land_area else None

    return {
        "sale_ref":               sale_ref,
        "organisation_name":      org.name,
        "project_name":           project.name,
        "lot_number":             lot.lot_number,
        "lot_type":               lot_type_label,
        "stage_name":             stage.name,
        "lot_area":               lot_area,
        "sale_price":             sale_price,
        "date_of_sale":           _fmt_date(sale.approved_at),
        "deposit_amount":         deposit_amount,
        "deposit_type":           deposit_type,
        "cooling_off_waived":     sale.cooling_off_waived,
        "cooling_off_expiry":     _fmt_date(sale.cooling_off_expiry),
        "subject_to_finance":     sale.subject_to_finance,
        "finance_due_date":       _fmt_date(sale.finance_due_date),
        "buyer_name":             buyer_name,
        "buyer_type":             buyer_type_label,
        "buyer_email":            buyer.email or None,
        "buyer_phone":            buyer.phone or None,
        "buyer_address":          getattr(buyer, 'address', None) or None,
        "buyer_solicitor_name":   buyer_solicitor_name,
        "buyer_solicitor_firm":   buyer_solicitor_firm,
        "buyer_solicitor_email":  buyer_solicitor_email,
        "buyer_solicitor_phone":  buyer_solicitor_phone,
        "vendor_solicitor_name":  vendor_solicitor_name,
        "vendor_solicitor_firm":  vendor_solicitor_firm,
        "vendor_solicitor_email": vendor_solicitor_email,
        "agent_name":             agent_name,
        "agent_agency":           agent_agency,
    }


def _build_recipient_list(sale) -> list[str]:
    recipients = []
    if sale.solicitor and sale.solicitor.email:
        recipients.append(sale.solicitor.email)
    project_solicitor = sale.lot.stage.project.solicitor
    if project_solicitor and project_solicitor.email:
        if project_solicitor.email not in recipients:
            recipients.append(project_solicitor.email)
    for email in sale.organisation.get_notification_email_list():
        if email not in recipients:
            recipients.append(email)
    return recipients


def _generate_pdf(ctx: dict) -> bytes | None:
    """Generate a clean sales advice PDF using reportlab."""
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import mm
        from reportlab.lib import colors
        from reportlab.platypus import (
            SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable,
        )

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=20 * mm,
            leftMargin=20 * mm,
            topMargin=20 * mm,
            bottomMargin=20 * mm,
        )

        styles = getSampleStyleSheet()
        dark   = colors.HexColor('#111827')
        mid    = colors.HexColor('#6b7280')
        light  = colors.HexColor('#9ca3af')
        blue   = colors.HexColor('#2563eb')
        bg     = colors.HexColor('#f8fafc')

        title_style = ParagraphStyle('Title', parent=styles['Normal'],
            fontSize=20, fontName='Helvetica-Bold', textColor=dark, spaceAfter=6, leading=24)
        sub_style = ParagraphStyle('Sub', parent=styles['Normal'],
            fontSize=10, fontName='Helvetica', textColor=mid, spaceAfter=10, spaceBefore=2)
        section_style = ParagraphStyle('Section', parent=styles['Normal'],
            fontSize=8, fontName='Helvetica-Bold', textColor=light,
            spaceBefore=14, spaceAfter=6,
            borderPad=0, leading=10,
        )
        label_style = ParagraphStyle('Label', parent=styles['Normal'],
            fontSize=9, fontName='Helvetica', textColor=mid)
        value_style = ParagraphStyle('Value', parent=styles['Normal'],
            fontSize=10, fontName='Helvetica-Bold', textColor=dark)
        normal_style = ParagraphStyle('Normal2', parent=styles['Normal'],
            fontSize=10, fontName='Helvetica', textColor=dark)

        def section(title):
            return [
                Spacer(1, 4 * mm),
                Paragraph(title.upper(), section_style),
                HRFlowable(width='100%', thickness=0.5, color=colors.HexColor('#e5e7eb'), spaceAfter=6),
            ]

        def field_row(label, value):
            return Table(
                [[Paragraph(label, label_style), Paragraph(str(value) if value else '—', value_style)]],
                colWidths=['35%', '65%'],
                style=TableStyle([
                    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                    ('TOPPADDING', (0, 0), (-1, -1), 2),
                ]),
            )

        def two_col(pairs):
            """Render a list of (label, value) pairs in a two-column grid."""
            rows = []
            for i in range(0, len(pairs), 2):
                left  = pairs[i]
                right = pairs[i + 1] if i + 1 < len(pairs) else ('', '')
                rows.append([
                    Paragraph(left[0],  label_style),
                    Paragraph(str(left[1])  if left[1]  else '—', value_style),
                    Paragraph(right[0], label_style),
                    Paragraph(str(right[1]) if right[1] else '—', value_style),
                ])
            t = Table(rows, colWidths=['20%', '30%', '20%', '30%'])
            t.setStyle(TableStyle([
                ('VALIGN',        (0, 0), (-1, -1), 'TOP'),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                ('TOPPADDING',    (0, 0), (-1, -1), 2),
            ]))
            return t

        story = []

        # ── Header ──────────────────────────────────────────────────────────
        story.append(Paragraph("Sales Advice", title_style))
        story.append(Paragraph(ctx['organisation_name'], sub_style))

        ref_table = Table(
            [[
                Paragraph(f"<b>Reference:</b> {ctx['sale_ref']}", normal_style),
                Paragraph(f"<b>Date:</b> {ctx['date_of_sale']}", normal_style),
            ]],
            colWidths=['50%', '50%'],
            style=TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), bg),
                ('ROWBACKGROUNDS', (0, 0), (-1, -1), [bg]),
                ('TOPPADDING',    (0, 0), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('LEFTPADDING',   (0, 0), (-1, -1), 8),
                ('RIGHTPADDING',  (0, 0), (-1, -1), 8),
                ('ROUNDEDCORNERS', [4]),
            ]),
        )
        story.append(ref_table)

        # ── Property ────────────────────────────────────────────────────────
        story += section("Property")
        pairs = [
            ("Project",    ctx['project_name']),
            ("Lot Number", ctx['lot_number']),
            ("Lot Type",   ctx['lot_type']),
            ("Stage",      ctx['stage_name']),
        ]
        if ctx['lot_area']:
            pairs.append(("Land Area", f"{ctx['lot_area']} m²"))
        pairs.append(("Sale Price", f"${ctx['sale_price']}"))
        story.append(two_col(pairs))

        # ── Sale Conditions ─────────────────────────────────────────────────
        story += section("Sale Conditions")
        cooling = "Waived" if ctx['cooling_off_waived'] else f"Expires {ctx['cooling_off_expiry']}"
        finance = f"Subject to finance — due {ctx['finance_due_date']}" if ctx['subject_to_finance'] else "Not applicable"
        deposit = f"${ctx['deposit_amount']} ({ctx['deposit_type']})" if ctx['deposit_amount'] else "—"
        story.append(two_col([
            ("Cooling Off",  cooling),
            ("Finance",      finance),
            ("Deposit",      deposit),
            ("",             ""),
        ]))

        # ── Purchaser ───────────────────────────────────────────────────────
        story += section("Purchaser")
        buyer_pairs = [
            ("Name",  ctx['buyer_name']),
            ("Type",  ctx['buyer_type']),
        ]
        if ctx['buyer_email']:
            buyer_pairs.append(("Email", ctx['buyer_email']))
        if ctx['buyer_phone']:
            buyer_pairs.append(("Phone", ctx['buyer_phone']))
        if ctx['buyer_address']:
            buyer_pairs.append(("Address", ctx['buyer_address']))
        story.append(two_col(buyer_pairs))

        # ── Purchaser's Solicitor ────────────────────────────────────────────
        if ctx['buyer_solicitor_name']:
            story += section("Purchaser's Solicitor")
            sol_pairs = [("Name", ctx['buyer_solicitor_name']), ("Firm", ctx['buyer_solicitor_firm'] or '—')]
            if ctx['buyer_solicitor_email']:
                sol_pairs.append(("Email", ctx['buyer_solicitor_email']))
            if ctx['buyer_solicitor_phone']:
                sol_pairs.append(("Phone", ctx['buyer_solicitor_phone']))
            story.append(two_col(sol_pairs))

        # ── Vendor ──────────────────────────────────────────────────────────
        story += section("Vendor")
        vendor_pairs = [("Vendor", ctx['organisation_name']), ("", "")]
        if ctx['vendor_solicitor_name']:
            vendor_pairs += [
                ("Vendor's Solicitor", ctx['vendor_solicitor_name']),
                ("Firm",               ctx['vendor_solicitor_firm'] or '—'),
            ]
            if ctx['vendor_solicitor_email']:
                vendor_pairs.append(("Email", ctx['vendor_solicitor_email']))
        story.append(two_col(vendor_pairs))

        # ── Agent ───────────────────────────────────────────────────────────
        if ctx['agent_name']:
            story += section("Selling Agent")
            story.append(two_col([
                ("Agent",  ctx['agent_name']),
                ("Agency", ctx['agent_agency'] or '—'),
            ]))

        # ── Footer ──────────────────────────────────────────────────────────
        story.append(Spacer(1, 8 * mm))
        story.append(HRFlowable(width='100%', thickness=0.5, color=colors.HexColor('#e5e7eb')))
        story.append(Spacer(1, 2 * mm))
        story.append(Paragraph(
            f"This sales advice was generated automatically by the Property CRM platform. "
            f"Reference: {ctx['sale_ref']} · {ctx['organisation_name']}",
            ParagraphStyle('Footer', parent=styles['Normal'],
                fontSize=8, fontName='Helvetica', textColor=light)
        ))

        doc.build(story)
        return buffer.getvalue()

    except ImportError:
        logger.error("reportlab is not installed. Install with: pip install reportlab")
        return None
    except Exception as e:
        logger.error(f"PDF generation failed: {e}")
        return None


def send_sales_advice(sale) -> bool:
    """
    Main entry point. Called from approve_sale() in services.py.
    Always generates and saves the PDF. Sends email only if recipients configured.
    Never raises — failures are logged so approval is never blocked.
    """
    from apps.notifications.models import SalesAdviceLog
    from apps.sales.models import Sale

    try:
        sale = (
            Sale.objects
            .select_related(
                "lot__stage__project__solicitor",
                "primary_buyer",
                "solicitor",
                "agent__agency",
                "approved_by",
                "organisation",
            )
            .prefetch_related("deposit")
            .get(pk=sale.pk)
        )
    except Exception as e:
        logger.error(f"send_sales_advice: failed to reload sale {sale.pk}: {e}")
        return False

    context   = _build_context(sale)
    html_body = render_to_string("notifications/sales_advice.html", context)
    pdf_bytes = _generate_pdf(context)

    # Always save PDF to sale record
    if pdf_bytes:
        filename = f"sales_advice_{context['sale_ref']}.pdf"
        try:
            if sale.sales_advice_document:
                sale.sales_advice_document.delete(save=False)
            sale.sales_advice_document.save(filename, ContentFile(pdf_bytes), save=True)
            logger.info(f"send_sales_advice: PDF saved for sale {sale.pk}")
        except Exception as e:
            logger.error(f"send_sales_advice: failed to save PDF for sale {sale.pk}: {e}")

    recipients = _build_recipient_list(sale)

    if not recipients:
        logger.warning(
            f"send_sales_advice: no recipients for sale {sale.pk} — "
            "PDF saved but email not sent."
        )
        return False

    subject = (
        f"Sales Advice — {context['project_name']} "
        f"Lot {context['lot_number']} — {context['date_of_sale']}"
    )

    from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@propertycrmapp.com")

    msg = EmailMultiAlternatives(
        subject=subject,
        body=(
            f"Please find attached the Sales Advice for "
            f"{context['project_name']} Lot {context['lot_number']}.\n\n"
            f"Sale Reference: {context['sale_ref']}\n"
            f"Date of Sale:   {context['date_of_sale']}\n"
            f"Sale Price:     ${context['sale_price']}\n"
            f"Purchaser:      {context['buyer_name']}\n"
        ),
        from_email=from_email,
        to=recipients,
    )
    msg.attach_alternative(html_body, "text/html")

    if pdf_bytes:
        msg.attach(
            f"Sales_Advice_{context['sale_ref']}.pdf",
            pdf_bytes,
            "application/pdf",
        )

    log = SalesAdviceLog(
        organisation=sale.organisation,
        sale=sale,
        recipients=", ".join(recipients),
    )

    try:
        msg.send()
        log.status = SalesAdviceLog.Status.SENT
        log.save()
        logger.info(f"send_sales_advice: sent for sale {sale.pk} to {recipients}")
        return True
    except Exception as e:
        log.status = SalesAdviceLog.Status.FAILED
        log.error  = str(e)
        log.save()
        logger.error(f"send_sales_advice: failed for sale {sale.pk}: {e}")
        return False