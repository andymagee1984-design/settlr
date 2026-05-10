from django.db import migrations

PERMISSIONS = [
    ("sale.create",      "Create a new sale",              "Sales"),
    ("sale.submit",      "Submit a sale for approval",     "Sales"),
    ("sale.approve",     "Approve or decline a sale",      "Sales"),
    ("sale.progress",    "Progress a sale through stages", "Sales"),
    ("sale.fall_over",   "Mark a sale as fallen over",     "Sales"),
    ("sale.view_all",    "View all sales in the org",      "Sales"),
    ("lot.edit",         "Edit lot specifications",        "Lots"),
    ("lot.release",      "Release a lot to market",        "Lots"),
    ("lot.price",        "Update lot pricing",             "Lots"),
    ("project.activate", "Activate a project",             "Admin"),
    ("report.view",      "View reports",                   "Reports"),
    ("admin.users",      "Manage users and roles",         "Admin"),
    ("admin.settings",   "Manage organisation settings",   "Settings"),
]

SYSTEM_ROLES = {
    "Admin": [p[0] for p in PERMISSIONS],
    "Sales Manager": ["sale.create","sale.submit","sale.approve","sale.progress","sale.fall_over","sale.view_all","lot.edit","lot.release","lot.price","report.view"],
    "Agent (Internal)": ["sale.create","sale.submit","sale.progress","sale.view_all"],
    "Agent (External)": ["sale.create","sale.submit"],
    "Read Only": ["sale.view_all","report.view"],
}

def seed(apps, schema_editor):
    CRMPermission = apps.get_model("users", "CRMPermission")
    Role = apps.get_model("users", "Role")
    RolePermission = apps.get_model("users", "RolePermission")
    perm_map = {}
    for code, description, category in PERMISSIONS:
        perm, _ = CRMPermission.objects.get_or_create(code=code, defaults={"description": description, "category": category})
        perm_map[code] = perm
    for role_name, codes in SYSTEM_ROLES.items():
        role, _ = Role.objects.get_or_create(name=role_name, organisation=None, defaults={"is_system_role": True})
        role.is_system_role = True
        role.save()
        for code in codes:
            if code in perm_map:
                RolePermission.objects.get_or_create(role=role, permission=perm_map[code])

def unseed(apps, schema_editor):
    apps.get_model("users", "Role").objects.filter(is_system_role=True, organisation=None).delete()
    apps.get_model("users", "CRMPermission").objects.all().delete()

class Migration(migrations.Migration):
    dependencies = [("users", "0001_initial")]
    operations   = [migrations.RunPython(seed, unseed)]
