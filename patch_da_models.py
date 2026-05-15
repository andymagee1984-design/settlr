import os, subprocess, sys

BASE = os.getcwd()
MODELS_PATH = os.path.join(BASE, "property_crm", "apps", "projects", "models.py")

with open(MODELS_PATH, "r", encoding="utf-8") as f:
    content = f.read()

if "DevelopmentApplication" in content:
    print("DA models already present.")
    sys.exit(0)

DA_MODELS = """

# =============================================================================
# DA & Planning
# =============================================================================

class DevelopmentApplication(models.Model):
    class Status(models.TextChoices):
        PRE_LODGEMENT     = "pre_lodgement",     "Pre-lodgement"
        LODGED            = "lodged",            "Lodged"
        UNDER_ASSESSMENT  = "under_assessment",  "Under Assessment"
        APPROVED          = "approved",          "Approved"
        CONDITIONS_ISSUED = "conditions_issued", "Conditions Issued"
        OPERATIONAL_WORKS = "operational_works", "Operational Works"

    id                     = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project                = models.ForeignKey("projects.Project", on_delete=models.CASCADE, related_name="development_applications")
    stage                  = models.ForeignKey("projects.Stage", on_delete=models.SET_NULL, null=True, blank=True, related_name="development_applications")
    reference_number       = models.CharField(max_length=100, blank=True)
    authority              = models.CharField(max_length=255, blank=True)
    status                 = models.CharField(max_length=30, choices=Status.choices, default=Status.PRE_LODGEMENT)
    lodgement_date         = models.DateField(null=True, blank=True)
    approval_date          = models.DateField(null=True, blank=True)
    lapse_date             = models.DateField(null=True, blank=True)
    commencement_confirmed = models.BooleanField(default=False)
    commencement_date      = models.DateField(null=True, blank=True)
    notes                  = models.TextField(blank=True)
    created_at             = models.DateTimeField(auto_now_add=True)
    updated_at             = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Development Application"
        verbose_name_plural = "Development Applications"

    def __str__(self):
        ref = self.reference_number or "No reference"
        stage = f" - {self.stage.name}" if self.stage else ""
        return f"{self.project.name}{stage} - {ref}"

    @property
    def is_lapsing_soon(self):
        if not self.lapse_date or self.commencement_confirmed:
            return False
        from django.utils import timezone
        from datetime import timedelta
        return self.lapse_date <= (timezone.now().date() + timedelta(days=90))

    @property
    def days_until_lapse(self):
        if not self.lapse_date:
            return None
        from django.utils import timezone
        return (self.lapse_date - timezone.now().date()).days


class DACondition(models.Model):
    class Category(models.TextChoices):
        PRE_CONSTRUCTION  = "pre_construction",  "Pre-construction"
        CONSTRUCTION      = "construction",      "Construction"
        POST_CONSTRUCTION = "post_construction", "Post-construction"
        ONGOING           = "ongoing",           "Ongoing"

    class Status(models.TextChoices):
        OPEN        = "open",        "Open"
        IN_PROGRESS = "in_progress", "In Progress"
        COMPLETE    = "complete",    "Complete"
        WAIVED      = "waived",      "Waived"

    id                = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    da                = models.ForeignKey(DevelopmentApplication, on_delete=models.CASCADE, related_name="conditions")
    condition_number  = models.CharField(max_length=20, blank=True)
    category          = models.CharField(max_length=30, choices=Category.choices, default=Category.PRE_CONSTRUCTION)
    description       = models.TextField()
    status            = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    responsible_party = models.ForeignKey("users.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="da_conditions")
    due_date          = models.DateField(null=True, blank=True)
    completed_date    = models.DateField(null=True, blank=True)
    notes             = models.TextField(blank=True)
    created_at        = models.DateTimeField(auto_now_add=True)
    updated_at        = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["condition_number", "created_at"]
        verbose_name = "DA Condition"
        verbose_name_plural = "DA Conditions"

    def __str__(self):
        return f"{self.da} - {self.condition_number or 'Condition'}"

    @property
    def is_overdue(self):
        if not self.due_date or self.status in ("complete", "waived"):
            return False
        from django.utils import timezone
        return self.due_date < timezone.now().date()


class DAMilestone(models.Model):
    class MilestoneType(models.TextChoices):
        COMMENCEMENT          = "commencement",          "Commencement of Works"
        PRACTICAL_COMPLETION  = "practical_completion",  "Practical Completion"
        OCCUPATION_CERT       = "occupation_cert",       "Occupation Certificate"
        DEFECTS_LIABILITY_END = "defects_liability_end", "Defects Liability End"
        CUSTOM                = "custom",                "Custom"

    id             = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    da             = models.ForeignKey(DevelopmentApplication, on_delete=models.CASCADE, related_name="milestones")
    milestone_type = models.CharField(max_length=30, choices=MilestoneType.choices)
    label          = models.CharField(max_length=100, blank=True)
    planned_date   = models.DateField(null=True, blank=True)
    actual_date    = models.DateField(null=True, blank=True)
    notes          = models.TextField(blank=True)
    created_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["planned_date", "milestone_type"]
        verbose_name = "DA Milestone"
        verbose_name_plural = "DA Milestones"

    def __str__(self):
        label = self.label or self.get_milestone_type_display()
        return f"{self.da} - {label}"

    @property
    def display_label(self):
        if self.milestone_type == "custom" and self.label:
            return self.label
        return self.get_milestone_type_display()

    @property
    def is_overdue(self):
        if self.actual_date or not self.planned_date:
            return False
        from django.utils import timezone
        return self.planned_date < timezone.now().date()
"""

with open(MODELS_PATH, "a", encoding="utf-8") as f:
    f.write(DA_MODELS)
print("models.py: DA models appended.")

print("Running makemigrations...")
subprocess.run([sys.executable, "property_crm/manage.py", "makemigrations", "projects", "--name", "da_planning_models"], cwd=BASE)
print("Running migrate...")
subprocess.run([sys.executable, "property_crm/manage.py", "migrate"], cwd=BASE)
print("Done.")
