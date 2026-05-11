"""
apps/projects/admin.py
"""

import csv
import io
from datetime import date
from decimal import Decimal, InvalidOperation

from django import forms
from django.contrib import admin, messages
from django.shortcuts import redirect, render
from django.urls import path
from django.utils.html import format_html

from .models import Lot, LotPriceHistory, Project, ProjectMedia, Stage


# ─────────────────────────────────────────────────────────────────────────────
# Inlines
# ─────────────────────────────────────────────────────────────────────────────

class StageInline(admin.TabularInline):
    model  = Stage
    extra  = 1
    fields = ["name", "stage_number", "expected_release"]


class ProjectMediaInline(admin.TabularInline):
    model  = ProjectMedia
    extra  = 0
    fields = ["media_type", "category", "title", "file", "sort_order"]


class LotPriceHistoryInline(admin.TabularInline):
    model           = LotPriceHistory
    extra           = 0
    readonly_fields = ["changed_by", "created_at"]
    fields          = ["price", "effective_date", "reason", "changed_by", "created_at"]


# ─────────────────────────────────────────────────────────────────────────────
# CSV upload form
# ─────────────────────────────────────────────────────────────────────────────

class LotCSVUploadForm(forms.Form):
    csv_file = forms.FileField(
        label="CSV file",
        help_text="Upload a CSV with one lot per row. Download the template below for the correct column format.",
    )


# ─────────────────────────────────────────────────────────────────────────────
# CSV validation helpers
# ─────────────────────────────────────────────────────────────────────────────

LOT_TYPE_CHOICES = {c[0] for c in Lot.LotType.choices}

REQUIRED_FIELDS = ["lot_number", "lot_type"]

OPTIONAL_FIELDS = [
    "bedrooms", "bathrooms", "car_spaces",
    "land_area", "floor_area", "aspect",
    "level", "building", "inclusions", "floor_plan_url",
    "initial_price", "price_effective_date",
]

ALL_FIELDS = REQUIRED_FIELDS + OPTIONAL_FIELDS

CSV_TEMPLATE_HEADER = ",".join(ALL_FIELDS)


def _parse_int(val):
    if val is None or str(val).strip() == "":
        return None
    try:
        return int(str(val).strip())
    except ValueError:
        raise ValueError(f"must be a whole number, got '{val}'")


def _parse_decimal(val):
    if val is None or str(val).strip() == "":
        return None
    try:
        return Decimal(str(val).strip().replace(",", ""))
    except InvalidOperation:
        raise ValueError(f"must be a number, got '{val}'")


def _parse_date(val):
    if val is None or str(val).strip() == "":
        return None
    val = str(val).strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            from datetime import datetime
            return datetime.strptime(val, fmt).date()
        except ValueError:
            continue
    raise ValueError(f"must be YYYY-MM-DD or DD/MM/YYYY, got '{val}'")


def validate_row(row_num, row, existing_lot_numbers):
    """
    Validate a single CSV row dict.
    Returns (cleaned_data, errors_list).
    cleaned_data is None if there are errors.
    """
    errors = []
    cleaned = {}

    # Required: lot_number
    lot_number = str(row.get("lot_number", "")).strip()
    if not lot_number:
        errors.append("lot_number is required")
    elif lot_number in existing_lot_numbers:
        errors.append(f"lot_number '{lot_number}' already exists in this stage")
    else:
        cleaned["lot_number"] = lot_number

    # Required: lot_type
    lot_type = str(row.get("lot_type", "")).strip().lower().replace(" ", "_").replace("&", "and")
    # Normalise common aliases
    aliases = {
        "h&l": "house_and_land", "h_and_l": "house_and_land",
        "house and land": "house_and_land", "apt": "apartment",
        "twnh": "townhouse", "comm": "commercial",
    }
    lot_type = aliases.get(lot_type, lot_type)
    if not lot_type:
        errors.append("lot_type is required")
    elif lot_type not in LOT_TYPE_CHOICES:
        errors.append(f"lot_type '{lot_type}' is invalid — use: {', '.join(sorted(LOT_TYPE_CHOICES))}")
    else:
        cleaned["lot_type"] = lot_type

    # Optional integer fields
    for field in ("bedrooms", "bathrooms", "car_spaces", "level"):
        try:
            cleaned[field] = _parse_int(row.get(field))
        except ValueError as e:
            errors.append(f"{field}: {e}")

    # Optional decimal fields
    for field in ("land_area", "floor_area"):
        try:
            cleaned[field] = _parse_decimal(row.get(field))
        except ValueError as e:
            errors.append(f"{field}: {e}")

    # Optional string fields
    for field in ("aspect", "building", "inclusions", "floor_plan_url"):
        val = str(row.get(field, "")).strip()
        cleaned[field] = val if val else None

    # Optional price fields
    try:
        cleaned["initial_price"] = _parse_decimal(row.get("initial_price"))
    except ValueError as e:
        errors.append(f"initial_price: {e}")

    try:
        cleaned["price_effective_date"] = _parse_date(row.get("price_effective_date"))
    except ValueError as e:
        errors.append(f"price_effective_date: {e}")

    if errors:
        return None, errors
    return cleaned, []


# ─────────────────────────────────────────────────────────────────────────────
# Project admin
# ─────────────────────────────────────────────────────────────────────────────

@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display    = ["name", "organisation", "status", "billing_status", "billing_lot_count", "billing_start_date"]
    list_filter     = ["status", "billing_status", "organisation"]
    search_fields   = ["name", "address"]
    readonly_fields = ["billing_lot_count", "billing_start_date", "billing_end_date", "created_at", "updated_at"]
    inlines         = [StageInline, ProjectMediaInline]
    actions         = ["activate_projects"]

    fieldsets = [
        (None, {"fields": ["organisation", "name", "address", "status"]}),
        ("Marketing", {"fields": ["tagline", "description", "website_url", "solicitor"], "classes": ["collapse"]}),
        ("Billing", {"fields": ["billing_lot_count", "billing_start_date", "billing_end_date", "billing_status"]}),
        ("Timestamps", {"fields": ["created_at", "updated_at"], "classes": ["collapse"]}),
    ]

    def activate_projects(self, request, queryset):
        for project in queryset.filter(status="draft"):
            project.activate()
        self.message_user(request, "Selected draft projects have been activated.")
    activate_projects.short_description = "Activate selected projects"


# ─────────────────────────────────────────────────────────────────────────────
# Stage admin — with CSV import action
# ─────────────────────────────────────────────────────────────────────────────

@admin.register(Stage)
class StageAdmin(admin.ModelAdmin):
    list_display   = ["name", "project", "stage_number", "expected_release", "lot_count", "csv_upload_link"]
    list_filter    = ["project__organisation", "project"]
    search_fields  = ["name", "project__name"]
    readonly_fields = ["created_at", "updated_at"]

    def lot_count(self, obj):
        return obj.lots.count()
    lot_count.short_description = "Lots"

    def csv_upload_link(self, obj):
        url = f"/admin/projects/stage/{obj.pk}/upload-lots/"
        return format_html('<a href="{}">Upload lots CSV</a>', url)
    csv_upload_link.short_description = "CSV import"

    def get_urls(self):
        urls = super().get_urls()
        custom = [
            path(
                "<pk>/upload-lots/",
                self.admin_site.admin_view(self.upload_lots_view),
                name="projects_stage_upload_lots",
            ),
            path(
                "download-lot-template/",
                self.admin_site.admin_view(self.download_template_view),
                name="projects_stage_download_template",
            ),
        ]
        return custom + urls

    def download_template_view(self, request):
        """Serve a blank CSV template."""
        from django.http import HttpResponse
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="lot_import_template.csv"'
        writer = csv.writer(response)
        writer.writerow(ALL_FIELDS)
        # Example rows
        writer.writerow(["101", "house_and_land", 4, 2, 2, 450.00, 210.00, "North", "", "", "", "", 620000, date.today()])
        writer.writerow(["102", "apartment", 2, 1, 1, "", 85.50, "East", 3, "Tower A", "", "", 495000, ""])
        return response

    def upload_lots_view(self, request, pk):
        stage = Stage.objects.select_related("project__organisation").get(pk=pk)

        if request.method == "POST":
            form = LotCSVUploadForm(request.POST, request.FILES)
            if form.is_valid():
                csv_file = request.FILES["csv_file"]
                raw_bytes = csv_file.read()
                for encoding in ("utf-8-sig", "utf-8", "cp1252", "latin-1"):
                    try:
                        decoded = raw_bytes.decode(encoding)
                        break
                    except (UnicodeDecodeError, LookupError):
                        continue
                else:
                    messages.error(request, "Could not read the CSV file — please save it as UTF-8 or CSV (Windows) format from Excel.")
                    return redirect(request.path)
                # Detect delimiter — use tab if present, otherwise comma
                first_line = decoded.split('\n')[0]
                delimiter = '\t' if '\t' in first_line else ','
                reader = csv.DictReader(io.StringIO(decoded, newline=''), delimiter=delimiter)

                # Check required columns exist
                fieldnames = [f.strip().lower() for f in (reader.fieldnames or [])]
                missing = [f for f in REQUIRED_FIELDS if f not in fieldnames]
                if missing:
                    messages.error(request, f"CSV is missing required columns: {', '.join(missing)}. Detected fieldnames: {fieldnames}. Delimiter: '{delimiter}'")
                    return redirect(request.path)

                # Normalise column names
                rows = []
                for row in reader:
                    rows.append({k.strip().lower(): v for k, v in row.items()})

                existing_numbers = set(
                    stage.lots.values_list("lot_number", flat=True)
                )

                validated = []
                for i, row in enumerate(rows, start=2):  # row 1 = header
                    cleaned, errors = validate_row(i, row, existing_numbers)
                    validated.append({
                        "row": i,
                        "raw": row,
                        "cleaned": cleaned,
                        "errors": errors,
                        "ok": len(errors) == 0,
                    })
                    if cleaned:
                        existing_numbers.add(cleaned.get("lot_number", ""))

                # If this is the confirm step, import valid rows
                if "confirm_import" in request.POST:
                    imported = 0
                    skipped  = 0
                    for v in validated:
                        if not v["ok"]:
                            skipped += 1
                            continue
                        d = v["cleaned"]
                        lot = Lot.objects.create(
                            stage       = stage,
                            lot_number  = d["lot_number"],
                            lot_type    = d["lot_type"],
                            is_released = False,
                            bedrooms    = d.get("bedrooms"),
                            bathrooms   = d.get("bathrooms"),
                            car_spaces  = d.get("car_spaces"),
                            land_area   = d.get("land_area"),
                            floor_area  = d.get("floor_area"),
                            aspect      = d.get("aspect") or "",
                            level       = d.get("level"),
                            building    = d.get("building") or "",
                            inclusions  = d.get("inclusions") or "",
                            floor_plan_url = d.get("floor_plan_url") or "",
                        )
                        if d.get("initial_price"):
                            LotPriceHistory.objects.create(
                                lot            = lot,
                                price          = d["initial_price"],
                                effective_date = d.get("price_effective_date") or date.today(),
                                changed_by     = request.user,
                                reason         = "Initial price — CSV import",
                            )
                        imported += 1

                    level = messages.SUCCESS if skipped == 0 else messages.WARNING
                    self.message_user(
                        request,
                        f"Import complete — {imported} lots created, {skipped} rows skipped due to errors.",
                        level=level,
                    )
                    return redirect(f"/admin/projects/stage/{pk}/change/")

                # Preview step — show validation results
                valid_count   = sum(1 for v in validated if v["ok"])
                invalid_count = len(validated) - valid_count

                context = {
                    **self.admin_site.each_context(request),
                    "title":         f"Import lots — {stage.name} ({stage.project.name})",
                    "stage":         stage,
                    "form":          form,
                    "validated":     validated,
                    "valid_count":   valid_count,
                    "invalid_count": invalid_count,
                    "preview":       True,
                    "opts":          self.model._meta,
                }
                return render(request, "admin/projects/stage/upload_lots.html", context)

        else:
            form = LotCSVUploadForm()

        context = {
            **self.admin_site.each_context(request),
            "title":    f"Import lots — {stage.name} ({stage.project.name})",
            "stage":    stage,
            "form":     form,
            "preview":  False,
            "opts":     self.model._meta,
            "template_url": "/admin/projects/stage/download-lot-template/",
        }
        return render(request, "admin/projects/stage/upload_lots.html", context)


# ─────────────────────────────────────────────────────────────────────────────
# Lot admin
# ─────────────────────────────────────────────────────────────────────────────

@admin.register(Lot)
class LotAdmin(admin.ModelAdmin):
    list_display    = ["lot_number", "stage", "lot_type", "is_released", "current_price"]
    list_filter     = ["lot_type", "is_released", "stage__project"]
    search_fields   = ["lot_number", "stage__project__name"]
    readonly_fields = ["created_at", "updated_at"]
    inlines         = [LotPriceHistoryInline]
    actions         = ["release_lots", "unrelease_lots"]

    def release_lots(self, request, queryset):
        updated = queryset.filter(is_released=False).update(is_released=True)
        self.message_user(request, f"{updated} lot(s) released to market.")
    release_lots.short_description = "Release selected lots (Draft to Available)"

    def unrelease_lots(self, request, queryset):
        from apps.sales.models import Sale
        safe = queryset.filter(is_released=True).exclude(
            sales__status__in=[
                Sale.Status.ON_HOLD, Sale.Status.PENDING, Sale.Status.DECLINED,
                Sale.Status.RESERVED, Sale.Status.CONTRACT_ISSUED,
                Sale.Status.EXCHANGED, Sale.Status.SETTLED,
            ]
        )
        updated = safe.update(is_released=False)
        self.message_user(request, f"{updated} lot(s) moved back to Draft.")
    unrelease_lots.short_description = "Unrelease selected lots (Available to Draft)"