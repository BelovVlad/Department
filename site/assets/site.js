const root = document.documentElement;
try {
  const theme = JSON.parse(localStorage.getItem('pweb.home.v1'))?.settings?.theme;
  root.dataset.theme = theme === 'light' || (theme === 'system' && matchMedia('(prefers-color-scheme:light)').matches) ? 'light' : 'dark';
} catch {}
const container = document.querySelector('#sections'), nav = document.querySelector('#nav'), search = document.querySelector('#search');
const downloadIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11m-5-5 5 5 5-5M5 20h14"/></svg>';
const url = path => './' + path.split('/').map(encodeURIComponent).join('/');
const size = bytes => bytes >= 1024 * 1024 ? (bytes / 1024 / 1024).toFixed(1) + ' МБ' : Math.max(1, Math.ceil(bytes / 1024)) + ' КБ';
const date = iso => new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
const anchor = name => 's-' + name;
function el(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text != null) node.textContent = text; return node; }
let catalog = { sections: [], files: [] };
// Folded sections and groups are remembered per browser; meta.json "collapsed" is the default.
const FOLD_KEY = 'pweb.department.folded.v1';
let folded = {};
try { folded = JSON.parse(localStorage.getItem(FOLD_KEY)) || {}; } catch {}
const isOpen = (key, collapsed) => !(folded[key] ?? collapsed);
function remember(key, open) { folded[key] = !open; try { localStorage.setItem(FOLD_KEY, JSON.stringify(folded)); } catch {} }
// <details> that folds into one row: the summary holds the heading.
function fold(className, key, collapsed, heading, forceOpen) {
  const box = el('details', className); box.open = forceOpen || isOpen(key, collapsed);
  const summary = el('summary'); summary.append(heading); box.append(summary);
  box.addEventListener('toggle', () => { if (!search.value.trim()) remember(key, box.open); });
  return box;
}

function fileRow(file) {
  const row = el('div', 'file');
  const main = el('a', 'file-main');
  if (file.view) {
    const params = new URLSearchParams({ file: file.view, title: file.title, subject: file.section });
    if (file.view !== 'files/' + file.path) params.set('source', 'files/' + file.path);
    main.href = './viewer/pdfjs/viewer.html?' + params;
  } else { main.href = url('files/' + file.path); main.download = file.name; }
  const badge = el('span', 'file-icon', file.kind); badge.dataset.kind = file.kind;
  const copy = el('span', 'file-copy');
  copy.append(el('strong', '', file.title), el('small', '', file.description || [file.folder, file.name].filter(Boolean).join(' / ')));
  const meta = el('span', 'file-meta');
  meta.append(el('b', '', size(file.bytes)), document.createTextNode(file.view ? 'открыть' : 'скачать'));
  main.append(badge, copy, meta); row.append(main);
  if (file.view) {
    const download = el('a', 'download'); download.href = url('files/' + file.path); download.download = file.name;
    download.title = download.ariaLabel = 'Скачать ' + file.name + ' · ' + date(file.modified); download.innerHTML = downloadIcon;
    row.append(download);
  }
  return row;
}
function render() {
  const query = search.value.trim().toLocaleLowerCase('ru');
  const match = file => !query || [file.title, file.description, file.path].join(' ').toLocaleLowerCase('ru').includes(query);
  container.replaceChildren(); nav.replaceChildren();
  let shown = 0;
  for (const section of catalog.sections) {
    const files = catalog.files.filter(f => f.section === section.name && match(f));
    const link = el('a', '', section.title); link.href = '#' + anchor(section.name); link.append(el('span', '', String(files.length)));
    nav.append(link);
    if (query && !files.length) continue;
    shown += files.length;
    const heading = el('h2', '', section.title); heading.append(el('small', '', String(files.length)));
    const block = fold('section', section.name, section.collapsed, heading, !!query); block.id = anchor(section.name);
    if (section.description) block.append(el('p', 'description', section.description));
    const direct = files.filter(f => !f.group);
    if (direct.length) { const list = el('div', 'files'); list.append(...direct.map(fileRow)); block.append(list); }
    for (const group of section.groups) {
      const own = files.filter(f => f.group === group.name);
      if (query && !own.length) continue;
      const title = el('h3', '', group.title); title.append(el('small', '', String(own.length)));
      const box = fold('group', section.name + '/' + group.name, group.collapsed, title, !!query);
      if (group.description) box.append(el('p', 'description', group.description));
      const list = el('div', 'files'); list.append(...own.map(fileRow));
      if (!own.length) list.append(el('p', 'empty', 'Пока пусто'));
      box.append(list); block.append(box);
    }
    if (!files.length && !section.groups.length) block.append(el('p', 'empty', 'Пока пусто'));
    container.append(block);
  }
  if (query && !shown) container.append(el('p', 'empty', 'Ничего не нашлось'));
  if (!query && location.hash && !container.dataset.scrolled) { container.dataset.scrolled = '1'; reveal(decodeURIComponent(location.hash.slice(1))); }
}
// A section link or a hash from the viewer's back button opens the folded section.
function reveal(id) { const target = document.getElementById(id); if (!target) return; target.open = true; target.scrollIntoView(); }
nav.addEventListener('click', e => { const link = e.target.closest('a'); if (!link) return; e.preventDefault(); const id = link.hash.slice(1); history.replaceState(null, '', '#' + id); reveal(decodeURIComponent(id)); });
search.addEventListener('input', render);
try {
  const response = await fetch('./materials.json', { cache: 'no-cache' });
  if (!response.ok) throw new Error('catalog');
  catalog = await response.json();
  render();
} catch { container.replaceChildren(el('p', 'empty', 'Не удалось загрузить список файлов. Обновите страницу.')); }
