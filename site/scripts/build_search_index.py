#!/usr/bin/env python3
"""Full-text index of the course PDFs and code files, in the format of the NSU Y4 S1 site's search.

Writes site/viewer/search-index/ (files.json, manifest.json, one part per course). The shared
search worker (site/viewer/search-worker.js) reads it: the reader uses it for its search and
page layout, and the hub at hyle.space searches the books through it.
Scanned books without a text layer are listed but cannot be found by their text.

    python site/scripts/build_search_index.py      # needs PyMuPDF (pip install pymupdf)
"""
from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parents[2]
SITE = ROOT / 'site'
OUT = SITE / 'viewer' / 'search-index'
EXCLUDED = {'site', 'node_modules', '__pycache__'}  # same as site/scripts/catalog.mjs
# Code files open in viewer/notebook/code.html; their type is the extension, a hit is a line (pieces of 30 lines).
CODE = {'.py', '.c', '.h', '.cc', '.cpp', '.cxx', '.hpp', '.hh', '.sh', '.ps1', '.js', '.mjs', '.json', '.yaml', '.yml',
        '.toml', '.ini', '.cfg', '.md', '.txt', '.m', '.jl', '.wl', '.tex', '.r'}
CODE_CHUNK = 30


def clean(text: str) -> str:
    return re.sub(r'\s+', ' ', text.replace('\x00', ' ')).strip()


def plain_title(name: str) -> str:
    return re.sub(r'\s+', ' ', re.sub(r'_+', ' ', name.rsplit('.', 1)[0])).strip()


def page_sizes(doc) -> list[list]:
    """Displayed page sizes run-length encoded as [width, height, count], as in NSU Y4 S1."""
    runs: list[list] = []
    for page in doc:
        size = [round(page.rect.width, 1), round(page.rect.height, 1)]
        if runs and runs[-1][:2] == size:
            runs[-1][2] += 1
        else:
            runs.append([*size, 1])
    return runs


def main() -> None:
    meta = json.loads((SITE / 'meta.json').read_text('utf-8')) if (SITE / 'meta.json').is_file() else {}
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob('part-*.json'):
        old.unlink()
    generated = datetime.now(timezone.utc).isoformat()
    files, shards = [], []
    courses = sorted(p for p in ROOT.iterdir() if p.is_dir() and not p.name.startswith('.') and p.name not in EXCLUDED)
    for number, course in enumerate(courses):
        records = []
        for pdf in sorted(course.rglob('*.pdf')):
            rel = pdf.relative_to(ROOT).as_posix()
            if any(part.startswith('.') for part in rel.split('/')):
                continue
            # The reader opens files/<path>, so the index uses the same path.
            path = 'files/' + rel
            parts = rel.split('/')
            entry = meta.get(rel, {})
            row = {'path': path, 'type': 'pdf', 'title': entry.get('title') or plain_title(pdf.name),
                   'subject': course.name, 'section': parts[1] if len(parts) > 2 else '',
                   'version': hashlib.sha1(pdf.read_bytes()).hexdigest()[:12], 'size': pdf.stat().st_size}
            pages = []
            with pymupdf.open(pdf) as doc:
                row['page_count'] = doc.page_count
                row['page_sizes'] = page_sizes(doc)
                for n, page in enumerate(doc, 1):
                    text = clean(page.get_text('text', sort=True))
                    if text:
                        pages.append({'n': n, 't': text})
            row['indexed'] = bool(pages)
            files.append(row)
            records.append({'path': path, 'pages': pages})
        for source in sorted(course.rglob('*')):
            rel = source.relative_to(ROOT).as_posix()
            if not source.is_file() or not (source.suffix.lower() in CODE or source.name.lower() == 'makefile') or                     any(part.startswith('.') or part in EXCLUDED for part in rel.split('/')):
                continue
            path, parts, entry = 'files/' + rel, rel.split('/'), meta.get(rel, {})
            lines = source.read_text('utf-8', errors='replace').splitlines()
            files.append({'path': path, 'type': source.suffix.lower().lstrip('.') or 'makefile', 'title': entry.get('title') or source.name,
                          'subject': course.name, 'section': parts[1] if len(parts) > 2 else '',
                          'version': hashlib.sha1(source.read_bytes()).hexdigest()[:12], 'size': source.stat().st_size,
                          'line_count': len(lines), 'indexed': True})
            pages = [{'n': start + 1, 't': text} for start in range(0, len(lines), CODE_CHUNK)
                     if (text := clean(' '.join(lines[start:start + CODE_CHUNK])))]
            records.append({'path': path, 'pages': pages})
        name = f'part-{number:02d}.json'
        body = json.dumps({'records': records}, ensure_ascii=False, separators=(',', ':'))
        (OUT / name).write_text(body, 'utf-8')
        shards.append({'subject': course.name, 'file': name, 'version': hashlib.sha1(body.encode()).hexdigest()[:10]})
    (OUT / 'files.json').write_text(json.dumps({'version': 2, 'generated_at': generated, 'files': files}, ensure_ascii=False, indent=1), 'utf-8')
    (OUT / 'manifest.json').write_text(json.dumps({'version': 3, 'generated_at': generated, 'shards': shards}, ensure_ascii=False, indent=1), 'utf-8')
    found = sum(f['indexed'] for f in files)
    print(f'Search index: {len(files)} files, {found} with text, {len(shards)} parts in {OUT}')


if __name__ == '__main__':
    main()
