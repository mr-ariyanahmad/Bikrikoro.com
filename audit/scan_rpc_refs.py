from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
source_files = list((root / 'src').rglob('*.ts')) + list((root / 'src').rglob('*.tsx')) + list((root / 'api').rglob('*.ts'))
sql_files = list((root / 'supabase' / 'migrations').glob('*.sql'))

calls = {}
for path in source_files:
    text = path.read_text(errors='ignore')
    for match in re.finditer(r"(?:\.rpc|rpc)\(\s*['\"]([a-zA-Z0-9_]+)", text):
        calls.setdefault(match.group(1), set()).add(str(path.relative_to(root)))

definitions = {}
for path in sql_files:
    text = path.read_text(errors='ignore')
    for match in re.finditer(r"create\s+or\s+replace\s+function\s+(?:public\.)?([a-zA-Z0-9_]+)", text, re.I):
        definitions.setdefault(match.group(1), set()).add(path.name)

print('=== RPC CALLS NOT FOUND IN MIGRATIONS ===')
for name in sorted(calls):
    if name not in definitions:
        print(f'{name}: {", ".join(sorted(calls[name]))}')
print('\n=== RPC CALLS ===')
for name in sorted(calls):
    print(f'{name}: defined in {", ".join(sorted(definitions.get(name, {"MISSING"})))}; called by {", ".join(sorted(calls[name]))}')
print('\n=== MIGRATION FUNCTIONS NOT CALLED FROM FRONTEND/API ===')
for name in sorted(definitions):
    if name not in calls and name.startswith(('admin_', 'get_', 'list_', 'mark_', 'request_', 'create_', 'update_', 'delete_', 'toggle_', 'ask_', 'report_', 'seller_', 'apply_', 'register_', 'disable_', 'notify_')):
        print(f'{name}: {", ".join(sorted(definitions[name]))}')
