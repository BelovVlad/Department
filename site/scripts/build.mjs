// Builds the site into site/dist: the page, the viewer and every course file.
// GitHub Pages publishes site/dist (.github/workflows/deploy-pages.yml).
import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, basename, join, resolve } from 'node:path';
import { site, content, writeCatalog } from './catalog.mjs';
const output = resolve(site, 'dist');
if (dirname(output) !== site || basename(output) !== 'dist') throw new Error('Unsafe build output');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
const catalog = await writeCatalog();
for (const path of ['index.html', 'assets', 'viewer', 'materials.json']) await cp(join(site, path), join(output, path), { recursive: true });
for (const file of catalog.files) {
  const target = join(output, 'files', file.path);
  await mkdir(dirname(target), { recursive: true });
  await cp(join(content, file.path), target);
}
console.log(`Ready: ${output} — ${catalog.sections.length} courses, ${catalog.files.length} files`);
