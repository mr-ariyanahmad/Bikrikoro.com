from pathlib import Path

root = Path('/home/ubuntu/bikrikoro_task/repo/src/pages/admin')
for path in sorted(root.glob('*.tsx')):
    text = path.read_text()
    if 'supabase.' in text:
        continue
    lines = text.splitlines(keepends=True)
    filtered = [line for line in lines if line.strip() != "import { supabase } from '@/lib/supabase'"]
    if filtered != lines:
        path.write_text(''.join(filtered))
