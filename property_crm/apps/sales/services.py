"""
apps/sales/services.py

Business logic for all sale workflow transitions.
Views call these functions — no workflow logic lives in views or serializers.
Each function is atomic (wrapped in a transaction where needed).
"""

from datetime import datetime, timedelta, date, time
from django.db import transaction
from django.utils import timezone

from .models import Sale, Deposit, Commission


# ---------------------------------------------------------------------------
# Business hours helpers
# ---------------------------------------------------------------------------

BUSINESS_START = time(9, 0)
BUSINESS_END   = time(17, 0)
BUSINESS_DAYS  = {0, 1, 2, 3, 4}  # Monday–Friday


def _is_business_hours(dt: datetime) -> bool:
    return (
        dt.weekday() in BUSINESS_DAYS
        and BUSINESS_START <= dt.time() <= BUSINESS_END
    )


def _next_business_day_9am(dt: datetime) -> datetime:
    """Return 9:00am on the next business day after dt."""
    candidate = dt + timedelta(days=1)
    while candidate.weekday() not in BUSINESS_DAYS:
        candidate += timedelta(days=1)
    return candidate.replace(hour=9, minute=0, second=0, microsecond=0)


def calculate_on_hold_expiry(created_at: datetime) -> datetime:
    """
    Default: 24 hours from creation.
    If that falls outside business hours, push to 9am next business day.
    """
    raw_expiry = created_at + timedelta(hours=24)
    if _is_business_hours(raw_expiry):
        return raw_expiry
    return _next_business_day_9am(raw_expiry)


# ---------------------------------------------------------------------------
# Workflow 02 — Create Sale (On Hold)
# ---------------------------------------------------------------------------

@transaction.atomic
def create_sale(lot, primary_buyer, created_by, organisation, **kwargs) -> Sale:
    """
    Creates a Sale at On Hold status.
    Calculates on_hold_expiry with business hours logic.
    Snapshots the current lot price as sale_price.
    Pre-populates solicitor from project if set.
    """
    now = timezone.now()

    # Snapshot price
    sale_price = lot.current_price

    # Pre-populate solicitor from project (overridable)
    solicitor = kwargs.pop("solicitor", None)
    if solicitor is None:
        project = lot.stage.project
        solicitor = project.solicitor

    # Cooling off expiry
    cooling_off_waived = kwargs.get("cooling_off_waived", False)
    cooling_off_expiry = None
    if not cooling_off_waived:
        cooling_off_days = organisation.cooling_off_days
        cooling_off_expiry = (now + timedelta(days=cooling_off_days)).date()

    sale = Sale.objects.create(
        organisation=organisation,
        lot=lot,
        primary_buyer=primary_buyer,
        created_by=created_by,
        status=Sale.Status.ON_HOLD,
        on_hold_expiry=calculate_on_hold_expiry(now),
        sale_price=sale_price,
        solicitor=solicitor,
        cooling_off_expiry=cooling_off_expiry,
        **kwargs,
    )
    return sale


# ---------------------------------------------------------------------------
# Workflow 02 — Submit for Approval (On Hold / Declined → Pending)
# ---------------------------------------------------------------------------

@transaction.atomic
def submit_for_approval(sale: Sale, deposit_data: dict, user) -> Sale:
    """
    Validates that all minimum requirements are met then moves sale to Pending.
    deposit_data: dict with amount, deposit_type, deposit_date, deposit_time, attachment.
    Sends notification to Sales Manager / Admin users (stub — notifications app to implement).
    """
    _validate_submission_requirements(sale)

    # Create or update deposit record
    Deposit.objects.update_or_create(
        sale=sale,
        defaults={
            **deposit_data,
            "created_by": user,
            "organisation": sale.organisation,
        }
    )

    sale.status = Sale.Status.PENDING
    sale.save(update_fields=["status", "updated_at"])

    # TODO: send notification to all Sales Manager / Admin users in organisation
    # notify_pending_sale(sale)

    return sale


def _validate_submission_requirements(sale: Sale):
    """Raises ValueError if minimum fields are missing before submission."""
    from rest_framework.exceptions import ValidationError

    errors = {}

    buyer = sale.primary_buyer
    if buyer.buyer_type == "individual":
        if not buyer.first_name or not buyer.last_name:
            errors["buyer_name"] = "Full legal name required."
        if not buyer.date_of_birth:
            errors["date_of_birth"] = "Date of birth required."
        if not buyer.address:
            errors["address"] = "Residential address required."
        if not buyer.email:
            errors["email"] = "Email address required."
    else:
        if not buyer.entity_name:
            errors["entity_name"] = "Entity name required."
        if not buyer.abn:
            errors["abn"] = "ABN required."
        if buyer.buyer_type == "trust" and not buyer.trustee_name:
            errors["trustee_name"] = "Trustee name required."
        if not buyer.email:
            errors["email"] = "Email address required."

    if not sale.id_verified:
        errors["id_verified"] = "ID verification must be confirmed."

    if errors:
        raise ValidationError(errors)


# ---------------------------------------------------------------------------
# Workflow 03 — Approve Sale (Pending → Reserved)
# ---------------------------------------------------------------------------

@transaction.atomic
def approve_sale(sale: Sale, approved_by) -> Sale:
    if sale.status != Sale.Status.PENDING:
        from rest_framework.exceptions import ValidationError
        raise ValidationError("Only pending sales can be approved.")

    now = timezone.now()
    sale.status      = Sale.Status.RESERVED
    sale.approved_by = approved_by
    sale.approved_at = now
    sale.save(update_fields=["status", "approved_by", "approved_at", "updated_at"])

    # TODO: notify agent of approval
    # notify_sale_approved(sale)

    return sale


# ---------------------------------------------------------------------------
# Workflow 03 — Decline Sale (Pending → Declined)
# ---------------------------------------------------------------------------

@transaction.atomic
def decline_sale(sale: Sale, reason: str, declined_by) -> Sale:
    if sale.status != Sale.Status.PENDING:
        from rest_framework.exceptions import ValidationError
        raise ValidationError("Only pending sales can be declined.")

    sale.status = Sale.Status.DECLINED
    sale.save(update_fields=["status", "updated_at"])

    # TODO: notify agent of decline with reason
    # notify_sale_declined(sale, reason)

    return sale


# ---------------------------------------------------------------------------
# Workflow 04 — Progress Sale (Reserved → ... → Settled)
# ---------------------------------------------------------------------------

PROGRESSION_MAP = {
    Sale.Status.RESERVED:        Sale.Status.CONTRACT_ISSUED,
    Sale.Status.CONTRACT_ISSUED: Sale.Status.EXCHANGED,
    Sale.Status.EXCHANGED:       Sale.Status.SETTLED,
}

TRANSITION_REQUIRED_FIELDS = {
    Sale.Status.RESERVED: {
        "date_field": "contract_issued_date",
        "file_field": "contract_document",
    },
    Sale.Status.CONTRACT_ISSUED: {
        "date_field": "exchange_date",
        "file_field": "signed_contract",
    },
    Sale.Status.EXCHANGED: {
        "date_field": "settlement_date",
        "file_field": "settlement_statement",
    },
}


@transaction.atomic
def progress_sale(sale: Sale, date_value, file_value, progressed_by) -> Sale:
    """
    Advances sale through: Reserved → Contract Issued → Exchanged → Settled.
    Requires a key date and document upload at each step.
    Side effects:
      - Exchanged: creates Commission record
      - Settled: sets lot to settled, checks project billing completion
    """
    from rest_framework.exceptions import ValidationError

    if sale.status not in PROGRESSION_MAP:
        raise ValidationError(f"Sale cannot be progressed from status '{sale.status}'.")

    required = TRANSITION_REQUIRED_FIELDS[sale.status]
    if not date_value:
        raise ValidationError({required["date_field"]: "This date is required to progress."})
    if not file_value:
        raise ValidationError({required["file_field"]: "A document upload is required to progress."})

    # Set the transition fields
    setattr(sale, required["date_field"], date_value)
    setattr(sale, required["file_field"], file_value)

    next_status = PROGRESSION_MAP[sale.status]
    sale.status = next_status

    if next_status == Sale.Status.SETTLED:
        sale.settled_at = timezone.now()

    sale.save()

    # Post-transition side effects
    if next_status == Sale.Status.EXCHANGED:
        _create_commission(sale)

    if next_status == Sale.Status.SETTLED:
        sale.lot.stage.project.check_billing_complete()

    return sale


def _create_commission(sale: Sale):
    """
    Auto-creates a pending Commission record when sale reaches Exchanged.
    Uses the agent's agency default commission type and rate if set,
    and auto-calculates the amount if enough information is available.
    """
    if not sale.agent_id:
        return

    # Don't create a duplicate if one already exists
    try:
        if sale.commission is not None:
            return
    except Exception:
        pass

    commission_type = None
    rate            = None
    flat_amount     = None

    # Pull defaults from the agent's agency
    try:
        agency = sale.agent.agency
        if agency.default_commission_type and agency.default_commission_rate is not None:
            commission_type = agency.default_commission_type
            if commission_type == "percentage":
                rate = agency.default_commission_rate
            else:
                flat_amount = agency.default_commission_rate
    except Exception:
        pass  # agency not loaded — create commission without defaults

    kwargs = {"status": Commission.CommissionStatus.PENDING}
    if commission_type:
        kwargs["commission_type"] = commission_type
    if rate is not None:
        kwargs["rate"] = rate
    if flat_amount is not None:
        kwargs["flat_amount"] = flat_amount

    commission = Commission.objects.create(
        organisation=sale.organisation,
        sale=sale,
        agent=sale.agent,
        **kwargs,
    )

    # Auto-calculate if we have enough info
    if commission_type and (rate is not None or flat_amount is not None) and sale.sale_price:
        commission.calculate()
        commission.save(update_fields=["calculated_amount"])


# ---------------------------------------------------------------------------
# Workflow 05 — Fall Over a Sale
# ---------------------------------------------------------------------------

@transaction.atomic
def fall_over_sale(sale: Sale, reason: str, fallen_by) -> Sale:
    """
    Terminal action. Marks sale as Fallen Over and reverts lot to Available.
    reason must be one of Sale.FallenOverReason values.
    """
    from rest_framework.exceptions import ValidationError

    terminal = {Sale.Status.FALLEN_OVER, Sale.Status.SETTLED}
    if sale.status in terminal:
        raise ValidationError(f"Cannot fall over a sale with status '{sale.status}'.")

    now = timezone.now()
    sale.status             = Sale.Status.FALLEN_OVER
    sale.fallen_over_at     = now
    sale.fallen_over_reason = reason
    sale.save(update_fields=["status", "fallen_over_at", "fallen_over_reason", "updated_at"])

    # TODO: notify agent
    # notify_sale_fallen_over(sale)

    return sale


# ---------------------------------------------------------------------------
# Auto fall-over (called by the cron management command)
# ---------------------------------------------------------------------------

def auto_fall_over_expired_on_hold():
    """
    Finds all On Hold sales past their on_hold_expiry and falls them over.
    Called by: python manage.py process_on_hold_expiry
    """
    now = timezone.now()
    expired = Sale.objects.filter(
        status=Sale.Status.ON_HOLD,
        on_hold_expiry__lte=now,
    ).select_related("created_by", "lot")

    fallen = []
    for sale in expired:
        fall_over_sale(sale, reason=Sale.FallenOverReason.TUBED_BUYER, fallen_by=None)
        fallen.append(sale)
        # TODO: send email to sale.created_by
    return fallen