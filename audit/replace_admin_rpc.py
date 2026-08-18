from pathlib import Path

root = Path('/home/ubuntu/bikrikoro_task/repo')
for path in sorted((root / 'src/pages/admin').glob('*.tsx')):
    text = path.read_text()
    if "supabase.rpc(" not in text and "adminRpc(" not in text:
        continue
    text = text.replace('supabase.rpc(', 'adminRpc(')
    if "from '@/lib/adminRpc'" not in text:
        lines = text.splitlines(keepends=True)
        insert_at = 0
        while insert_at < len(lines) and lines[insert_at].startswith('import '):
            insert_at += 1
        lines.insert(insert_at, "import { adminRpc } from '@/lib/adminRpc'\n")
        text = ''.join(lines)
    path.write_text(text)
