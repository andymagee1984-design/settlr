"""
apps/sales/models.py

Sale, Deposit, Commission.

Key decisions:
- Sale.Status.DECLINED added (not in spec diagram but required by Workflow 03).
- Stage transition fields added to Sale (contract_issued_date, contract_document, etc.)
- Active sale constraint: PostgreSQL partial unique index — one active sale per lot.
- Commission.calculate() computes and stores calculated_amount.
"""

import uuid
from django.db import models
from django.db.models import Q

from apps.core.models import OrgScopedModel


class Sale(OrgScopedModel):

    class Status(models.TextChoices):
        ON_HOLD         = "on_hold",         "On Hold"
        PENDING         = "pending",         "Pending"
        DECLINED        = "declined",        "Declined"
        RESERVED        = "reserved",        "Reserved"
        CONTRACT_ISSUED = "contract_issued", "Contract Issued"
        EXCHANGED       = "exchanged",       "Exchanged"
        SETTLED         = "settled",         "Settled"
        FALLEN_OVER     = "fallen_over",     "Fallen Over"

    class FallenOverReason(models.TextChoices):
        TUBED_BUYER    = "tubed_buyer",    "Tubed — Buyer Decision"
        TUBED_FINANCE  = "tubed_finance",  "Tubed — Finance"
        CANCELLED      = "cancelled",      "Cancelled"

    id                    = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    lot                   = models.ForeignKey(
        "projects.Lot",
        on_delete=models.PROTECT,
        related_name="sales",
    )
    primary_buyer         = models.ForeignKey(
        "contacts.Buyer",
        on_delete=models.PROTECT,
        related_name="sales_as_primary",
    )
    secondary_buyer       = models.ForeignKey(
        "contacts.Buyer",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="sales_as_secondary",
    )
    agent                 = models.ForeignKey(
        "contacts.Agent",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sales",
    )
    solicitor             = models.ForeignKey(
        "contacts.Solicitor",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sales",
    )
    referrer              = models.ForeignKey(
        "contacts.Referrer",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sales",
    )

    status                = models.CharField(max_length=30, choices=Status.choices, default=Status.ON_HOLD)
    on_hold_expiry        = models.DateTimeField(null=True, blank=True, db_index=True)

    # Buyer verification & sale conditions
    id_verified           = models.BooleanField(default=False)
    cooling_off_waived    = models.BooleanField(default=False)
    cooling_off_expiry    = models.DateField(null=True, blank=True)
    subject_to_finance    = models.BooleanField(default=False)
    finance_due_date      = models.DateField(null=True, blank=True)
    sale_price            = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    # Approval
    created_by            = models.ForeignKey(
        "users.User",
        on_delete=models.PROTECT,
        related_name="sales_created",
    )
    approved_by           = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sales_approved",
    )
    approved_at           = models.DateTimeField(null=True, blank=True)

    # Fall over
    fallen_over_at        = models.DateTimeField(null=True, blank=True)
    fallen_over_reason    = models.CharField(
        max_length=30,
        choices=FallenOverReason.choices,
        blank=True,
    )

    # Settlement
    settled_at            = models.DateTimeField(null=True, blank=True)

    # Stage transition fields (Workflow 04 — not in original spec, added per 04_django_models.md)
    contract_issued_date  = models.DateField(null=True, blank=True)
    contract_document     = models.FileField(upload_to="sale_documents/contracts/", null=True, blank=True)
    exchange_date         = models.DateField(null=True, blank=True)
    signed_contract       = models.FileField(upload_to="sale_documents/signed/", null=True, blank=True)
    settlement_date       = models.DateField(null=True, blank=True)
    settlement_statement  = models.FileField(upload_to="sale_documents/settlement/", null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes  = [models.Index(fields=["organisation", "id"])]
        constraints = [
            # Enforce one active sale per lot at the database level.
            # "Active" = anything except fallen_over.
            # NOTE: PostgreSQL only — SQLite does not support partial unique indexes.
            models.UniqueConstraint(
                fields=["lot"],
                condition=~Q(status="fallen_over"),
                name="unique_active_sale_per_lot",
            )
        ]

    def __str__(self):
        return f"Sale {self.id} — {self.lot} ({self.status})"

    @property
    def is_active(self):
        return self.status != self.Status.FALLEN_OVER


class Deposit(OrgScopedModel):

    class DepositType(models.TextChoices):
        EFT           = "eft",          "EFT"
        BANK_TRANSFER = "bank_transfer", "Bank Transfer"
        OTHER         = "other",        "Other"

    id             = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sale           = models.OneToOneField(Sale, on_delete=models.CASCADE, related_name="deposit")
    amount         = models.DecimalField(max_digits=10, decimal_places=2)
    deposit_type   = models.CharField(max_length=20, choices=DepositType.choices)
    deposit_date   = models.DateField()
    deposit_time   = models.TimeField()
    attachment     = models.FileField(upload_to="sale_documents/deposits/")
    created_by     = models.ForeignKey(
        "users.User",
        on_delete=models.PROTECT,
        related_name="deposits_created",
    )

    class Meta:
        indexes = [models.Index(fields=["organisation", "id"])]

    def __str__(self):
        return f"Deposit ${self.amount} — {self.sale}"


class Commission(OrgScopedModel):

    class CommissionType(models.TextChoices):
        PERCENTAGE = "percentage", "Percentage"
        FLAT       = "flat",       "Flat"

    class CommissionStatus(models.TextChoices):
        PENDING  = "pending",  "Pending"
        APPROVED = "approved", "Approved"
        PAID     = "paid",     "Paid"

    id                  = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sale                = models.OneToOneField(Sale, on_delete=models.CASCADE, related_name="commission")
    agent               = models.ForeignKey(
        "contacts.Agent",
        on_delete=models.PROTECT,
        related_name="commissions",
    )
    commission_type     = models.CharField(max_length=20, choices=CommissionType.choices, blank=True)
    rate                = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    flat_amount         = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    calculated_amount   = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    incentive_amount    = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    incentive_notes     = models.TextField(blank=True)
    status              = models.CharField(max_length=20, choices=CommissionStatus.choices, default=CommissionStatus.PENDING)
    approved_by         = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="commissions_approved",
    )
    approved_at         = models.DateTimeField(null=True, blank=True)
    paid_at             = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=["organisation", "id"])]

    def __str__(self):
        return f"Commission — {self.sale}"

    def calculate(self):
        """
        Compute and store calculated_amount.
        Call after setting commission_type and rate/flat_amount, before save().
        """
        if self.commission_type == self.CommissionType.PERCENTAGE and self.rate and self.sale.sale_price:
            self.calculated_amount = (self.rate / 100) * self.sale.sale_price
        elif self.commission_type == self.CommissionType.FLAT and self.flat_amount:
            self.calculated_amount = self.flat_amount
