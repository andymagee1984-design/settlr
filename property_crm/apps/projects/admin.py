"""
apps/projects/admin.py
"""

import csv
import io
from datetime import date
from decimal import Decimal, InvalidOperation

from django import forms
from django.contrib import admin, messages
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import path, reverse
from django.utils.html import format_html

from .models import Lot, LotPriceHistory, Project, ProjectMedia, Stage
from apps.projects.serializers import AMENITY_DEFINITIONS, VALID_AMENITY_CODES


# ─────────────────────────────────────────────────────────────────────────────
# Amenities form field
# ─────────────────────────────────────────────────────────────────────────────

class AmenitiesFormField(forms.MultipleChoiceField):
    def __init__(self, *args, **kwargs):
        choices = [(a["code"], a["label"]) for a in AMENITY_DEFINITIONS]
        kwargs.setdefault("choices", choices)
        kwargs.setdefault("widget", forms.CheckboxSelectMultiple)
        kwargs.setdefault("required", False)
        super().__init__(*args, **kwargs)

    def prepare_value(self, value):
        if isinstance(value, list):
            return value
        return []

    def clean(self, value):
        value = super().clean(value)
        unknown = set(value) - VALID_AMENITY_CODES
        if unknown:
            raise forms.ValidationError(f"Unknown amenity codes: {', '.join(sorted(unknown))}")
        return list(value)


class ProjectAdminForm(forms.ModelForm):
    amenities = AmenitiesFormField()

    class Meta:
        model  = Project
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance and self.instance.pk:
            self.fields["amenities"].initial = self.instance.amenities or []


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
# CSV helpers
# ─────────────────────────────────────────────────────────────────────────────

class LotCSVUploadForm(forms.Form):
    stage    = forms.ModelChoiceField(queryset=Stage.objects.none(), label="Stage")
    csv_file = forms.FileField(label="CSV file")

    def __init__(self, *args, project=None, **kwargs):
        super().__init__(*args, **kwargs)
        if project:
            self.fields["stage"].queryset = Stage.objects.filter(
                project=project
            ).order_by("stage_number")


LOT_TYPE_CHOICES = {c[0] for c in Lot.LotType.choices}
REQUIRED_FIELDS  = ["lot_number", "lot_type"]
OPTIONAL_FIELDS  = [
    "bedrooms", "bathrooms", "car_spaces",
    "land_area", "floor_area", "aspect",
    "level", "building", "inclusions", "floor_plan_url",
    "initial_price", "price_effective_date",
]
ALL_FIELDS = REQUIRED_FIELDS + OPTIONAL_FIELDS


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
    errors  = []
    cleaned = {}

    lot_number = str(row.get("lot_number", "")).strip()
    if not lot_number:
        errors.append("lot_number is required")
    elif lot_number in existing_lot_numbers:
        errors.append(f"lot_number '{lot_number}' already exists in this stage")
    else:
        cleaned["lot_number"] = lot_number

    lot_type = str(row.get("lot_type", "")).strip().lower().replace(" ", "_").replace("&", "and")
    aliases  = {
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

    for field in ("bedrooms", "bathrooms", "car_spaces", "level"):
        try:
            cleaned[field] = _parse_int(row.get(field))
        except ValueError as e:
            errors.append(f"{field}: {e}")

    for field in ("land_area", "floor_area"):
        try:
            cleaned[field] = _parse_decimal(row.get(field))
        except ValueError as e:
            errors.append(f"{field}: {e}")

    for field in ("aspect", "building", "inclusions", "floor_plan_url"):
        val = str(row.get(field, "")).strip()
        cleaned[field] = val if val else None

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
# Add lot form (used on the project lots page)
# ─────────────────────────────────────────────────────────────────────────────

class AddLotForm(forms.ModelForm):
    initial_price          = forms.DecimalField(required=False, label="Initial price")
    price_effective_date   = forms.DateField(
        required=False, label="Price effective date",
        widget=forms.DateInput(attrs={"type": "date"}),
        initial=date.today,
    )

    class Meta:
        model  = Lot
        fields = [
            "stage", "lot_number", "lot_type",
            "bedrooms", "bathrooms", "car_spaces",
            "land_area", "floor_area", "aspect",
            "level", "building",
        ]

    def __init__(self, *args, project=None, **kwargs):
        super().__init__(*args, **kwargs)
        if project:
            self.fields["stage"].queryset = Stage.objects.filter(
                project=project
            ).order_by("stage_number")


# ─────────────────────────────────────────────────────────────────────────────
# Project admin
# ─────────────────────────────────────────────────────────────────────────────

@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    form            = ProjectAdminForm
    list_display    = [
        "name", "organisation", "status", "billing_status",
        "billing_lot_count", "billing_start_date",
        "lot_count", "manage_lots_link",
    ]
    list_filter     = ["status", "billing_status", "organisation"]
    search_fields   = ["name", "address"]
    readonly_fields = [
        "billing_lot_count", "billing_start_date", "billing_end_date",
        "created_at", "updated_at", "manage_lots_button",
    ]
    inlines         = [StageInline, ProjectMediaInline]
    actions         = ["activate_projects"]

    fieldsets = [
        (None,           {"fields": ["organisation", "name", "address", "status", "manage_lots_button"]}),
        ("Marketing",    {"fields": ["tagline", "description", "website_url", "solicitor"], "classes": ["collapse"]}),
        ("Amenities",    {"fields": ["amenities"]}),
        ("Billing",      {"fields": ["billing_lot_count", "billing_start_date", "billing_end_date", "billing_status"]}),
        ("Timestamps",   {"fields": ["created_at", "updated_at"], "classes": ["collapse"]}),
    ]

    def lot_count(self, obj):
        return Lot.objects.filter(stage__project=obj).count()
    lot_count.short_description = "Lots"

    def manage_lots_link(self, obj):
        url   = reverse("admin:projects_project_lots", args=[obj.pk])
        count = Lot.objects.filter(stage__project=obj).count()
        return format_html(
            '<a href="{}" style="font-weight:600;">Manage {} lots →</a>',
            url, count,
        )
    manage_lots_link.short_description = "Lots"

    def manage_lots_button(self, obj):
        if not obj.pk:
            return "Save the project first, then manage lots."
        url = reverse("admin:projects_project_lots", args=[obj.pk])
        return format_html(
            '<a href="{}" class="button" style="margin-top:4px;">'
            '⊞ Manage lots for this project</a>',
            url,
        )
    manage_lots_button.short_description = "Lots"

    def activate_projects(self, request, queryset):
        for project in queryset.filter(status="draft"):
            project.activate()
        self.message_user(request, "Selected draft projects have been activated.")
    activate_projects.short_description = "Activate selected projects"

    def get_urls(self):
        urls   = super().get_urls()
        custom = [
            path(
                "<pk>/lots/",
                self.admin_site.admin_view(self.project_lots_view),
                name="projects_project_lots",
            ),
            path(
                "<pk>/lots/add/",
                self.admin_site.admin_view(self.add_lot_view),
                name="projects_project_lots_add",
            ),
            path(
                "<pk>/lots/import/",
                self.admin_site.admin_view(self.import_lots_view),
                name="projects_project_lots_import",
            ),
            path(
                "<pk>/lots/download-template/",
                self.admin_site.admin_view(self.download_template_view),
                name="projects_project_lots_template",
            ),
            path(
                "<pk>/lots/bulk-action/",
                self.admin_site.admin_view(self.bulk_action_view),
                name="projects_project_lots_bulk",
            ),
        ]
        return custom + urls

    # ── Project lots page ──────────────────────────────────────────────────

    def project_lots_view(self, request, pk):
        project = get_object_or_404(Project, pk=pk)
        stages  = (
            Stage.objects
            .filter(project=project)
            .prefetch_related("lots")
            .order_by("stage_number")
        )

        # Build stage → lots mapping with status annotation
        from apps.sales.models import Sale
        stage_data = []
        for stage in stages:
            lots = list(stage.lots.order_by("lot_number").select_related())
            stage_data.append({"stage": stage, "lots": lots})

        context = {
            **self.admin_site.each_context(request),
            "title":       f"Lots — {project.name}",
            "project":     project,
            "stage_data":  stage_data,
            "total_lots":  Lot.objects.filter(stage__project=project).count(),
            "opts":        Project._meta,
            "add_url":     reverse("admin:projects_project_lots_add",     args=[pk]),
            "import_url":  reverse("admin:projects_project_lots_import",  args=[pk]),
            "template_url":reverse("admin:projects_project_lots_template",args=[pk]),
            "bulk_url":    reverse("admin:projects_project_lots_bulk",    args=[pk]),
            "back_url":    reverse("admin:projects_project_change",       args=[pk]),
        }
        return render(request, "admin/projects/project/lots.html", context)

    # ── Add single lot ─────────────────────────────────────────────────────

    def add_lot_view(self, request, pk):
        project = get_object_or_404(Project, pk=pk)
        lots_url = reverse("admin:projects_project_lots", args=[pk])

        if request.method == "POST":
            form = AddLotForm(request.POST, project=project)
            if form.is_valid():
                lot = form.save(commit=False)
                lot.is_released = False
                lot.save()
                initial_price = form.cleaned_data.get("initial_price")
                if initial_price:
                    LotPriceHistory.objects.create(
                        lot            = lot,
                        price          = initial_price,
                        effective_date = form.cleaned_data.get("price_effective_date") or date.today(),
                        changed_by     = request.user,
                        reason         = "Initial price",
                    )
                messages.success(request, f"Lot {lot.lot_number} created successfully.")
                if "save_and_add" in request.POST:
                    return redirect(reverse("admin:projects_project_lots_add", args=[pk]))
                return redirect(lots_url)
        else:
            # Pre-select stage if passed in querystring
            initial = {}
            stage_id = request.GET.get("stage")
            if stage_id:
                initial["stage"] = stage_id
            form = AddLotForm(project=project, initial=initial)

        context = {
            **self.admin_site.each_context(request),
            "title":    f"Add lot — {project.name}",
            "project":  project,
            "form":     form,
            "opts":     Project._meta,
            "back_url": reverse("admin:projects_project_lots", args=[pk]),
        }
        return render(request, "admin/projects/project/add_lot.html", context)

    # ── CSV import ─────────────────────────────────────────────────────────

    def import_lots_view(self, request, pk):
        project  = get_object_or_404(Project, pk=pk)
        lots_url = reverse("admin:projects_project_lots", args=[pk])

        if request.method == "POST":
            form = LotCSVUploadForm(request.POST, request.FILES, project=project)
            if form.is_valid():
                stage     = form.cleaned_data["stage"]
                csv_file  = request.FILES["csv_file"]
                raw_bytes = csv_file.read()

                for encoding in ("utf-8-sig", "utf-8", "cp1252", "latin-1"):
                    try:
                        decoded = raw_bytes.decode(encoding)
                        break
                    except (UnicodeDecodeError, LookupError):
                        continue
                else:
                    messages.error(request, "Could not read CSV file.")
                    return redirect(request.path)

                first_line = decoded.split('\n')[0]
                delimiter  = '\t' if '\t' in first_line else ','
                reader     = csv.DictReader(io.StringIO(decoded, newline=''), delimiter=delimiter)

                fieldnames = [f.strip().lower() for f in (reader.fieldnames or [])]
                missing    = [f for f in REQUIRED_FIELDS if f not in fieldnames]
                if missing:
                    messages.error(request, f"CSV missing required columns: {', '.join(missing)}")
                    return redirect(request.path)

                rows = [{k.strip().lower(): v for k, v in row.items()} for row in reader]
                existing_numbers = set(stage.lots.values_list("lot_number", flat=True))

                validated = []
                for i, row in enumerate(rows, start=2):
                    cleaned, errors = validate_row(i, row, existing_numbers)
                    validated.append({
                        "row": i, "raw": row, "cleaned": cleaned,
                        "errors": errors, "ok": not errors,
                    })
                    if cleaned:
                        existing_numbers.add(cleaned.get("lot_number", ""))

                if "confirm_import" in request.POST:
                    imported = skipped = 0
                    for v in validated:
                        if not v["ok"]:
                            skipped += 1
                            continue
                        d   = v["cleaned"]
                        lot = Lot.objects.create(
                            stage          = stage,
                            lot_number     = d["lot_number"],
                            lot_type       = d["lot_type"],
                            is_released    = False,
                            bedrooms       = d.get("bedrooms"),
                            bathrooms      = d.get("bathrooms"),
                            car_spaces     = d.get("car_spaces"),
                            land_area      = d.get("land_area"),
                            floor_area     = d.get("floor_area"),
                            aspect         = d.get("aspect") or "",
                            level          = d.get("level"),
                            building       = d.get("building") or "",
                            inclusions     = d.get("inclusions") or "",
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

                    lvl = messages.SUCCESS if not skipped else messages.WARNING
                    self.message_user(
                        request,
                        f"Import complete — {imported} lots created, {skipped} rows skipped.",
                        level=lvl,
                    )
                    return redirect(lots_url)

                # Preview
                context = {
                    **self.admin_site.each_context(request),
                    "title":         f"Import lots — {project.name}",
                    "project":       project,
                    "stage":         stage,
                    "form":          form,
                    "validated":     validated,
                    "valid_count":   sum(1 for v in validated if v["ok"]),
                    "invalid_count": sum(1 for v in validated if not v["ok"]),
                    "preview":       True,
                    "opts":          Project._meta,
                    "back_url":      reverse("admin:projects_project_lots", args=[pk]),
                }
                return render(request, "admin/projects/project/import_lots.html", context)

        else:
            form = LotCSVUploadForm(project=project)

        context = {
            **self.admin_site.each_context(request),
            "title":        f"Import lots — {project.name}",
            "project":      project,
            "form":         form,
            "preview":      False,
            "opts":         Project._meta,
            "back_url":     reverse("admin:projects_project_lots", args=[pk]),
            "template_url": reverse("admin:projects_project_lots_template", args=[pk]),
        }
        return render(request, "admin/projects/project/import_lots.html", context)

    # ── CSV template download ──────────────────────────────────────────────

    def download_template_view(self, request, pk):
        from django.http import HttpResponse
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="lot_import_template.csv"'
        writer   = csv.writer(response)
        writer.writerow(ALL_FIELDS)
        writer.writerow(["101", "house_and_land", 4, 2, 2, 450.00, 210.00, "North", "", "", "", "", 620000, date.today()])
        writer.writerow(["102", "apartment",      2, 1, 1, "",     85.50,  "East",  3, "Tower A", "", "", 495000, ""])
        return response

    # ── Bulk actions ───────────────────────────────────────────────────────

    def bulk_action_view(self, request, pk):
        project  = get_object_or_404(Project, pk=pk)
        lots_url = reverse("admin:projects_project_lots", args=[pk])

        if request.method != "POST":
            return redirect(lots_url)

        selected_ids = request.POST.getlist("selected_lots")
        action       = request.POST.get("bulk_action")

        if not selected_ids:
            messages.warning(request, "No lots selected.")
            return redirect(lots_url)

        lots = Lot.objects.filter(pk__in=selected_ids, stage__project=project)

        if action == "release":
            updated = lots.filter(is_released=False).update(is_released=True)
            messages.success(request, f"{updated} lot(s) released to market.")

        elif action == "unrelease":
            from apps.sales.models import Sale
            safe    = lots.filter(is_released=True).exclude(
                sales__status__in=[
                    Sale.Status.ON_HOLD, Sale.Status.PENDING, Sale.Status.DECLINED,
                    Sale.Status.RESERVED, Sale.Status.CONTRACT_ISSUED,
                    Sale.Status.EXCHANGED, Sale.Status.SETTLED,
                ]
            )
            updated = safe.update(is_released=False)
            messages.success(request, f"{updated} lot(s) moved back to Draft.")

        elif action == "change_stage":
            new_stage_id = request.POST.get("new_stage")
            if new_stage_id:
                try:
                    new_stage = Stage.objects.get(pk=new_stage_id, project=project)
                    updated   = lots.update(stage=new_stage)
                    messages.success(request, f"{updated} lot(s) moved to {new_stage.name}.")
                except Stage.DoesNotExist:
                    messages.error(request, "Invalid stage selected.")
            else:
                messages.error(request, "Please select a stage to move lots to.")

        else:
            messages.error(request, "Unknown action.")

        return redirect(lots_url)


# ─────────────────────────────────────────────────────────────────────────────
# Stage admin — kept for direct stage management / legacy CSV import
# ─────────────────────────────────────────────────────────────────────────────

@admin.register(Stage)
class StageAdmin(admin.ModelAdmin):
    list_display    = ["name", "project", "stage_number", "expected_release", "lot_count"]
    list_filter     = ["project__organisation", "project"]
    search_fields   = ["name", "project__name"]
    readonly_fields = ["created_at", "updated_at"]

    def lot_count(self, obj):
        return obj.lots.count()
    lot_count.short_description = "Lots"


# ─────────────────────────────────────────────────────────────────────────────
# Lot admin — hidden from nav, accessible via project lots page change links
# ─────────────────────────────────────────────────────────────────────────────

@admin.register(Lot)
class LotAdmin(admin.ModelAdmin):
    list_display    = ["lot_number", "stage", "project_name", "lot_type", "is_released", "current_price"]
    list_filter     = ["lot_type", "is_released", "stage__project__organisation", "stage__project"]
    search_fields   = ["lot_number", "stage__project__name"]
    readonly_fields = ["created_at", "updated_at"]
    inlines         = [LotPriceHistoryInline]

    fieldsets = [
        (None, {"fields": [
            "stage", "lot_number", "lot_type", "is_released",
            "bedrooms", "bathrooms", "car_spaces",
            "land_area", "floor_area", "aspect", "level", "building",
            "inclusions", "floor_plan_url",
        ]}),
        ("Timestamps", {"fields": ["created_at", "updated_at"], "classes": ["collapse"]}),
    ]

    def project_name(self, obj):
        return obj.stage.project.name
    project_name.short_description  = "Project"
    project_name.admin_order_field  = "stage__project__name"

    def has_module_perms(self, request):
        # Hidden from sidebar — accessed via project lots page
        return False