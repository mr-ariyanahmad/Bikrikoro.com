from pathlib import Path
import re

root = Path('/home/ubuntu/bikrikoro_task/repo')
for directory in (root / 'src/pages/admin', root / 'src/components/admin'):
    for path in sorted(directory.glob('*.tsx')):
        text = path.read_text()
        updated = re.sub(r'<button(?![^>]*\btype\s*=)(?=[\s>])', '<button type="button"', text)
        if updated != text:
            path.write_text(updated)
