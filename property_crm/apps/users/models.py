"""
apps/users/models.py

CRMPermission, Role, RolePermission, User.

Notes:
- Model is named CRMPermission (not Permission) to avoid collision with
  Django's built-in Permission model. API and frontend call it "permission".
- User is a custom AbstractBaseUser. Login field: email. No username field.
- AUTH_USER_MODEL = "users.User" must be set before first makemigrations.
- Superusers (is_superuser=True) have no organisation — they use Django Admin only.
"""

import uuid
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models

from apps.core.models import TimeStampedModel, OrgScopedModel, OrgScopedManager


# ---------------------------------------------------------------------------
# CRMPermission
# ---------------------------------------------------------------------------

class CRMPermission(models.Model):
    """
    System-defined action. Defined by the platform team — tenants cannot
    create or modify permissions. Codes use dot-notation: "sale.approve".
    """

    class Category(models.TextChoices):
        SALES    = "Sales",    "Sales"
        LOTS     = "Lots",     "Lots"
        REPORTS  = "Reports",  "Reports"
        ADMIN    = "Admin",    "Admin"
        SETTINGS = "Settings", "Settings"

    code        = models.CharField(max_length=100, unique=True)
    description = models.CharField(max_length=255)
    category    = models.CharField(max_length=20, choices=Category.choices)

    class Meta:
        ordering = ["category", "code"]
        verbose_name = "Permission"
        verbose_name_plural = "Permissions"

    def __str__(self):
        return f"{self.code} — {self.description}"


# ---------------------------------------------------------------------------
# Role
# ---------------------------------------------------------------------------

class Role(TimeStampedModel):
    """
    Named set of permissions. System roles ship with the platform.
    Custom roles are created by the platform team on request.
    """

    id             = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organisation   = models.ForeignKey(
        "core.Organisation",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="roles",
        help_text="Null = system role available to all organisations",
    )
    name           = models.CharField(max_length=100)
    is_system_role = models.BooleanField(default=False)
    permissions    = models.ManyToManyField(CRMPermission, through="RolePermission", blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


# ---------------------------------------------------------------------------
# RolePermission
# ---------------------------------------------------------------------------

class RolePermission(models.Model):
    """Junction table linking Roles to CRMPermissions."""

    role       = models.ForeignKey(Role, on_delete=models.CASCADE)
    permission = models.ForeignKey(CRMPermission, on_delete=models.CASCADE)

    class Meta:
        unique_together = [("role", "permission")]


# ---------------------------------------------------------------------------
# User manager
# ---------------------------------------------------------------------------

class UserManager(BaseUserManager):

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)
        return self.create_user(email, password, **extra_fields)


# ---------------------------------------------------------------------------
# User
# ---------------------------------------------------------------------------

class User(AbstractBaseUser, PermissionsMixin):
    """
    Custom user model. Login field: email.
    agent (OneToOneField, nullable) links a user to their Agent record for
    external agents — used for data scoping in views, not permissions.
    """

    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organisation = models.ForeignKey(
        "core.Organisation",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="users",
        help_text="Null for platform superusers",
    )
    role         = models.ForeignKey(
        Role,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="users",
    )
    agent        = models.OneToOneField(
        "contacts.Agent",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="user",
        help_text="Set for external agents — enables data scoping",
    )
    email        = models.EmailField(unique=True)
    first_name   = models.CharField(max_length=100)
    last_name    = models.CharField(max_length=100)
    is_active    = models.BooleanField(default=True)
    is_staff     = models.BooleanField(default=False)  # required for admin access
    last_login   = models.DateTimeField(null=True, blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)

    USERNAME_FIELD  = "email"
    REQUIRED_FIELDS = ["first_name", "last_name"]

    objects = UserManager()

    class Meta:
        ordering = ["email"]
        indexes = [
            models.Index(fields=["organisation", "id"]),
        ]

    def __str__(self):
        return f"{self.get_full_name()} <{self.email}>"

    def get_full_name(self):
        return f"{self.first_name} {self.last_name}".strip()

    def has_crm_permission(self, code: str) -> bool:
        """
        Check whether this user's Role grants the given permission code.
        Used by HasPermission() in apps.core.permissions.
        """
        if not self.role_id:
            return False
        return self.role.permissions.filter(code=code).exists()

    @property
    def is_external_agent(self) -> bool:
        return self.agent_id is not None
