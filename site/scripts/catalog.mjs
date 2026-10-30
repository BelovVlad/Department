import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, relative, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const site = resolve(fileURLToPath(new URL('../', import.meta.url)));
export const content = resolve(site, '..');
// Folders of Department that are not courses.
const excluded = new Set(['site', 'node_modules', '__pycache__']);
const viewable = new Set(['.pdf']);
const kinds = { '.pdf':'PDF', '.docx':'Word', '.doc':'Word', '.djvu':'DjVu', '.par':'Solid Edge', '.asm':'Solid Edge', '.stp':'STEP', '.step':'STEP', '.xlsx':'Excel', '.pptx':'PowerPoint', '.ipynb':'Jupyter', '.zip':'Архив' };

const posix = path => path.split('\\').join('/');
const plainTitle = name => name.replace(/\.[^.]+$/, '').replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();

export async function readMeta(root = site) {
  let meta = {};
  try { meta = JSON.parse(await readFile(join(root, 'meta.json'), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw new Error('Проверьте JSON в site/meta.json: ' + error.message); }
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) throw new Error('site/meta.json должен содержать объект.');
  return meta;
}

// Sections are the courses (top-level folders); groups are their subfolders.
// On the site a file is served at files/<path>.
export async function collect(root = content, meta = {}) {
  const described = path => {
    const entry = meta[path] ?? {};
    return { title: typeof entry.title === 'string' && entry.title.trim() ? entry.title.trim() : null, description: typeof entry.description === 'string' ? entry.description : '', collapsed: entry.collapsed === true };
  };
  const files = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink() || entry.name.startsWith('.') || entry.name.startsWith('~$')) continue;
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) { await walk(absolute); continue; }
      if (!entry.isFile()) continue;
      const path = posix(relative(root, absolute)), parts = path.split('/'), ext = extname(entry.name).toLowerCase(), info = await stat(absolute);
      const { title, description } = described(path);
      files.push({ path, section: parts[0], group: parts.length > 2 ? parts[1] : '', folder: parts.slice(2, -1).join('/'), name: entry.name, title: title ?? plainTitle(entry.name), description, ext: ext.slice(1), kind: kinds[ext] ?? (ext.slice(1).toUpperCase() || 'Файл'), bytes: info.size, modified: info.mtime.toISOString(), view: viewable.has(ext) ? 'files/' + path : null });
    }
  }
  // "$order" lists section and group names that go first, in that order.
  const order = Array.isArray(meta.$order) ? meta.$order : [];
  const rank = name => { const i = order.indexOf(name); return i < 0 ? order.length : i; };
  const sections = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.isSymbolicLink() || entry.name.startsWith('.') || excluded.has(entry.name)) continue;
    const before = files.length;
    await walk(join(root, entry.name));
    const own = files.slice(before), groups = [...new Set(own.map(f => f.group).filter(Boolean))].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, 'ru'));
    const { title, description, collapsed } = described(entry.name);
    sections.push({ name: entry.name, title: title ?? entry.name, description, collapsed, groups: groups.map(name => ({ name, ...described(entry.name + '/' + name), title: described(entry.name + '/' + name).title ?? name })) });
  }
  sections.sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name, 'ru'));
  files.sort((a, b) => a.title.localeCompare(b.title, 'ru'));
  return { version: 2, sections, files };
}

export async function writeCatalog() {
  const catalog = await collect(content, await readMeta());
  await writeFile(join(site, 'materials.json'), JSON.stringify(catalog, null, 2) + '\n');
  return catalog;
}
