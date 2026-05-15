"""
apps/users/migrations/0003_roles_and_permissions_update.py

Changes:
- Adds new permissions: da.manage, agency.assign, sale.view_agency, project.manage
- Creates Developer system role
- Fixes Sales Manager: removes sale.approve, sale.view_all; adds sale.view_agency
- Fixes Agent (Internal): removes sale.view_all (scoped via agent FK instead)
- Admin retains all permissions (gets new ones added)
"""

from django.db import migrations


NEW_PERMISSIONS = [
    ("da.manage",          "Manage development applications and planning",     "Admin"),
    ("agency.assign",      "Assign agencies to projects",                      "Admin"),
    ("sale.view_agency",   "View sales for own agency only",                   "Sales"),
    ("project.manage",     "Manage project setup, lots and pricing",           "Admin"),
    ("project.manage_media","Upload and manage project media and collateral",  "Admin"),
]

DEVELOPER_PERMISSIONS = [
    "sale.create",
    "sale.submit",
    "sale.approve",
    "sale.progress",
    "sale.fall_over",
    "sale.view_all",
    "lot.edit",
    "lot.release",
    "lot.price",
    "project.activate",
    "project.manage",
    "project.manage_media",
    "da.manage",
    "agency.assign",
    "report.view",
]

# Permissions to ADD to existing roles
ADD_TO_ROLES = {
    "Admin": [
        "da.manage",
        "agency.assign",
        "sale.view_agency",
        "project.manage",
        "project.manage_media",
    ],
    "Sales Manager": [
        "sale.view_agency",
    ],
}

# Permissions to REMOVE from existing roles
REMOVE_FROM_ROLES = {
    "Sales Manager": [
        "sale.approve",
        "sale.view_all",
        "lot.edit",
        "lot.release",
        "lot.price",
    ],
    "Agent (Internal)": [
        "sale.view_all",
    ],
}


def apply(apps, schema_editor):
    CRMPermission = apps.get_model("users", "CRMPermission")
    Role          = apps.get_model("users", "Role")
    RolePermission = apps.get_model("users", "RolePermission")

    # ── 1. Create new permissions ──────────────────────────────────────────
    perm_map = {}
    for code, description, category in NEW_PERMISSIONS:
        perm, _ = CRMPermission.objects.get_or_create(
            code=code,
            defaults={"description": description, "category": category},
        )
        perm_map[code] = perm

    # Also load all existing permissions into perm_map
    for perm in CRMPermission.objects.all():
        if perm.code not in perm_map:
            perm_map[perm.code] = perm

    # ── 2. Create Developer system role ────────────────────────────────────
    developer_role, _ = Role.objects.get_or_create(
        name="Developer",
        organisation=None,
        defaults={"is_system_role": True},
    )
    developer_role.is_system_role = True
    developer_role.save()

    for code in DEVELOPER_PERMISSIONS:
        if code in perm_map:
            RolePermission.objects.get_or_create(
                role=developer_role,
                permission=perm_map[code],
            )

    # ── 3. Add permissions to existing roles ───────────────────────────────
    for role_name, codes in ADD_TO_ROLES.items():
        try:
            role = Role.objects.get(name=role_name, organisation=None, is_system_role=True)
        except Role.DoesNotExist:
            continue
        for code in codes:
            if code in perm_map:
                RolePermission.objects.get_or_create(
                    role=role,
                    permission=perm_map[code],
                )

    # ── 4. Remove permissions from existing roles ──────────────────────────
    for role_name, codes in REMOVE_FROM_ROLES.items():
        try:
            role = Role.objects.get(name=role_name, organisation=None, is_system_role=True)
        except Role.DoesNotExist:
            continue
        for code in codes:
            if code in perm_map:
                RolePermission.objects.filter(
                    role=role,
                    permission=perm_map[code],
                ).delete()


def revert(apps, schema_editor):
    CRMPermission  = apps.get_model("users", "CRMPermission")
    Role           = apps.get_model("users", "Role")
    RolePermission = apps.get_model("users", "RolePermission")

    perm_map = {p.code: p for p in CRMPermission.objects.all()}

    # Remove Developer role
    Role.objects.filter(name="Developer", organisation=None, is_system_role=True).delete()

    # Remove new permissions
    for code, _, _ in NEW_PERMISSIONS:
        CRMPermission.objects.filter(code=code).delete()

    # Restore Sales Manager permissions
    try:
        sales_manager = Role.objects.get(name="Sales Manager", organisation=None, is_system_role=True)
        for code in ["sale.approve", "sale.view_all", "lot.edit", "lot.release", "lot.price"]:
            if code in perm_map:
                RolePermission.objects.get_or_create(role=sales_manager, permission=perm_map[code])
        RolePermission.objects.filter(role=sales_manager, permission__code="sale.view_agency").delete()
    except Role.DoesNotExist:
        pass

    # Restore Agent (Internal) sale.view_all
    try:
        agent_internal = Role.objects.get(name="Agent (Internal)", organisation=None, is_system_role=True)
        if "sale.view_all" in perm_map:
            RolePermission.objects.get_or_create(role=agent_internal, permission=perm_map["sale.view_all"])
    except Role.DoesNotExist:
        pass


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0002_initial_data"),
    ]

    operations = [
        migrations.RunPython(apply, revert),
    ]