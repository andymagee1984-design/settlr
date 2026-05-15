import os, sys

BASE = os.getcwd()
VIEWS_PATH = os.path.join(BASE, "property_crm", "apps", "projects", "views.py")

with open(VIEWS_PATH, "r", encoding="utf-8") as f:
    content = f.read()

# Fix all occurrences in DA viewsets - return instances (with ()) not classes
fixes = [
    ('return [HasPermission("da.manage")]',    'return [HasPermission("da.manage")()]'),
    ('return [HasPermission("report.view")]',   'return [HasPermission("report.view")()]'),
]

changed = 0
for old, new in fixes:
    count = content.count(old)
    if count > 0:
        content = content.replace(old, new)
        changed += count
        print(f"Fixed {count} occurrence(s): {old[:40]}...")

if changed == 0:
    print("No changes needed — patterns not found. Checking what's in the file...")
    # Show relevant lines
    for i, line in enumerate(content.splitlines(), 1):
        if 'get_permissions' in line or 'HasPermission' in line:
            print(f"  Line {i}: {line.strip()}")
else:
    with open(VIEWS_PATH, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"\nSaved. {changed} fix(es) applied.")
    print("Restart Django to pick up the changes.")
