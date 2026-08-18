from pathlib import Path

for path in sorted(Path('src/pages').rglob('*.tsx')):
    text = path.read_text(errors='ignore')
    if not any(marker in text for marker in ('BackButton', 'ArrowLeft', 'ফিরে', 'ফিরুন', 'AdminShell')):
        print(path)
