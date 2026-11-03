// Code reader: a text file of the site (Python, C++, Makefile, Markdown…) with line numbers and highlighting
// (highlight.js), in the site's palette. ?file=files/<path>&title=…&subject=…; #L12 marks a line.
// Notebooks (.ipynb) show their saved cells: text, code and outputs; nothing is run.
'use strict';
const params = new URLSearchParams(location.search);
const file = params.get('file') || '', subject = params.get('subject') || '';
const name = file.split('/').pop() || 'Файл';
const $ = id => document.getElementById(id);
const main = $('main');
const source = new URL('../../' + file.split('/').map(encodeURIComponent).join('/'), location.href);

// Language by file name: [highlight.js language, label].
const LANGUAGES = {
  py:['python','Python'], pyw:['python','Python'], ipynb:['python','Jupyter'],
  c:['c','C'], h:['cpp','C++'], cc:['cpp','C++'], cpp:['cpp','C++'], cxx:['cpp','C++'], hpp:['cpp','C++'], hh:['cpp','C++'], hxx:['cpp','C++'],
  sh:['bash','Shell'], bash:['bash','Shell'], ps1:['plaintext','PowerShell'],
  js:['javascript','JavaScript'], mjs:['javascript','JavaScript'], ts:['typescript','TypeScript'], css:['css','CSS'], html:['xml','HTML'], xml:['xml','XML'], svg:['xml','SVG'],
  json:['json','JSON'], yaml:['yaml','YAML'], yml:['yaml','YAML'], toml:['ini','TOML'], ini:['ini','INI'], cfg:['ini','Config'],
  md:['markdown','Markdown'], txt:['plaintext','Текст'], csv:['plaintext','CSV'], r:['r','R'], m:['plaintext','MATLAB'], jl:['plaintext','Julia'],
  wl:['plaintext','Wolfram'], tex:['plaintext','LaTeX'], sql:['sql','SQL'], rs:['rust','Rust'], go:['go','Go'], java:['java','Java'], lua:['lua','Lua'],
};
const NAMES = { makefile:['makefile','Makefile'], dockerfile:['bash','Dockerfile'], cmakelists:['plaintext','CMake'] };
const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
const [language, label] = NAMES[name.toLowerCase().replace(/\.txt$/, '')] || LANGUAGES[ext] || ['plaintext', ext.toUpperCase() || 'Текст'];

const escape = text => text.replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const plural = (n, one, few, many) => n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many;
function highlight(text, lang) {
  // Very long files stay plain: highlighting them would hold the page for seconds.
  if (window.hljs && text.length < 1.5e6 && hljs.getLanguage(lang) && lang !== 'plaintext') {
    try { return hljs.highlight(text, { language: lang, ignoreIllegals: true }).value; } catch {}
  }
  return escape(text);
}
// Highlighted HTML split into lines; a span open across a line break is closed and reopened.
function splitLines(html) {
  const lines = [], open = [];
  let line = '';
  for (const token of html.split(/(<span[^>]*>|<\/span>|\n)/)) {
    if (!token) continue;
    if (token === '\n') { lines.push(line + '</span>'.repeat(open.length)); line = open.join(''); }
    else if (token.startsWith('<span')) { open.push(token); line += token; }
    else if (token === '</span>') { open.pop(); line += token; }
    else line += token;
  }
  lines.push(line);
  return lines;
}

function renderSource(text) {
  const lines = splitLines(highlight(text.replace(/\r\n?/g, '\n'), language));
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  const box = document.createElement('div');
  box.className = 'lines';
  box.innerHTML = lines.map((html, i) => `<div class="row" id="L${i + 1}"><a href="#L${i + 1}">${i + 1}</a><span>${html || ' '}</span></div>`).join('');
  main.replaceChildren(box);
  return `${label} · ${lines.length} ${plural(lines.length, 'строка', 'строки', 'строк')}`;
}

// Markdown (.md files, notebook text): headings, lists, paragraphs, code, links; formulas stay as TeX text.
// A relative link opens that file of the site: text files in this reader, others as they are.
function linkTo(target) {
  if (/^https?:\/\//i.test(target)) return [target, true];
  if (/^[a-z]+:/i.test(target)) return ['#', false];
  if (target.startsWith('#')) return [target, false];
  const path = decodeURIComponent(new URL(target, 'https://site/' + file).pathname.slice(1));
  const reader = /\.(py|ipynb|c|h|cpp|hpp|cc|sh|js|mjs|json|ya?ml|md|txt|ini|cfg)$|(^|\/)makefile$/i.test(path);
  return [reader ? '?' + new URLSearchParams({ file: path, title: path.split('/').pop(), subject }) : '../../' + path, false];
}
function inline(text) {
  return escape(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (all, label, target) => {
      const [href, external] = linkTo(target.replace(/&amp;/g, '&'));
      return `<a href="${escape(href)}"${external ? ' target="_blank" rel="noopener"' : ''}>${label}</a>`;
    });
}
function markdown(text) {
  const out = [], lines = text.replace(/\r\n?/g, '\n').split('\n');
  let list = null, para = [];
  const flush = () => {
    if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; }
    if (list) { out.push(`</${list}>`); list = null; }
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = line.match(/^\s*```\s*(\w*)/);
    if (fence) {
      flush();
      const body = [];
      while (++i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i]);
      out.push(`<pre><code>${highlight(body.join('\n'), fence[1] || 'plaintext')}</code></pre>`);
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.*)/);
    const item = line.match(/^\s*([-*+]|\d+[.)])\s+(.*)/);
    if (heading) { flush(); out.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`); }
    else if (item) {
      if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; }
      const kind = /\d/.test(item[1]) ? 'ol' : 'ul';
      if (list !== kind) { if (list) out.push(`</${list}>`); out.push(`<${kind}>`); list = kind; }
      out.push(`<li>${inline(item[2])}</li>`);
    } else if (!line.trim()) flush();
    else { if (list) { out.push(`</${list}>`); list = null; } para.push(line.trim()); }
  }
  flush();
  return out.join('');
}

function renderNotebook(text) {
  const notebook = JSON.parse(text);
  const lang = notebook.metadata?.kernelspec?.language || notebook.metadata?.language_info?.name || 'python';
  const joined = value => Array.isArray(value) ? value.join('') : String(value ?? '');
  const cells = notebook.cells || [];
  const html = cells.map(cell => {
    const body = joined(cell.source);
    if (cell.cell_type === 'markdown') return `<section class="cell md">${markdown(body)}</section>`;
    if (cell.cell_type !== 'code') return `<section class="cell"><pre>${escape(body)}</pre></section>`;
    const outputs = (cell.outputs || []).map(output => {
      if (output.output_type === 'stream') return `<pre>${escape(joined(output.text))}</pre>`;
      if (output.output_type === 'error') return `<pre class="error">${escape(joined(output.traceback?.join('\n') || output.evalue).replace(/\x1b\[[0-9;]*m/g, ''))}</pre>`;
      const data = output.data || {};
      for (const type of ['image/png', 'image/jpeg', 'image/gif']) {
        if (data[type]) return `<img alt="" src="data:${type};base64,${joined(data[type]).replace(/\s/g, '')}">`;
      }
      if (data['image/svg+xml']) return `<img alt="" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(joined(data['image/svg+xml']))}">`;
      if (data['text/plain']) return `<pre>${escape(joined(data['text/plain']))}</pre>`;
      return '';
    }).join('');
    const count = cell.execution_count ? `In [${cell.execution_count}]` : 'Код';
    return `<section class="cell"><p class="cell-label">${count}</p><pre><code>${highlight(body, lang)}</code></pre>${outputs ? `<div class="output">${outputs}</div>` : ''}</section>`;
  }).join('');
  main.className = 'notebook';
  main.innerHTML = html || '<p class="status">В блокноте нет ячеек.</p>';
  return `Jupyter · ${cells.length} ${plural(cells.length, 'ячейка', 'ячейки', 'ячеек')}`;
}

function renderMarkdown(text) {
  main.className = 'notebook';
  main.innerHTML = `<article class="cell md">${markdown(text)}</article>`;
  return 'Markdown';
}

function markTarget() {
  for (const row of main.querySelectorAll('.row.target')) row.classList.remove('target');
  const row = /^#L\d+$/.test(location.hash) && document.getElementById(location.hash.slice(1));
  if (row) { row.classList.add('target'); row.scrollIntoView({ block: 'center' }); }
}

const title = params.get('title') || name;
$('title').textContent = title;
document.title = title + ' · Код';
const download = $('download');
download.href = source.href; download.download = name;

let wrap = false;
try { wrap = localStorage.getItem('hyle.code.wrap') === '1'; } catch {}
const applyWrap = () => { document.body.classList.toggle('wrap', wrap); $('wrap').setAttribute('aria-pressed', String(wrap)); };
applyWrap();
$('wrap').onclick = () => { wrap = !wrap; applyWrap(); try { localStorage.setItem('hyle.code.wrap', wrap ? '1' : '0'); } catch {} };

$('back').onclick = () => {
  if (history.length > 1 && document.referrer && new URL(document.referrer).origin === location.origin) history.back();
  else location.href = '../../' + (subject ? '#s-' + encodeURIComponent(subject) : '');
};

let text = '';
$('copy').onclick = async () => {
  try { await navigator.clipboard.writeText(text); } catch { return; }
  const button = $('copy');
  button.classList.add('done'); button.title = 'Скопировано';
  setTimeout(() => { button.classList.remove('done'); button.title = 'Скопировать весь текст'; }, 1400);
};

(async () => {
  try {
    if (!file) throw new Error('не указан файл');
    const response = await fetch(source, { cache: 'no-cache' });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    text = await response.text();
    $('eyebrow').textContent = ext === 'ipynb' ? renderNotebook(text) : ext === 'md' ? renderMarkdown(text) : renderSource(text);
    addEventListener('hashchange', markTarget);
    markTarget();
  } catch (error) {
    main.innerHTML = `<p class="status">Не удалось открыть ${escape(name)}: ${escape(error.message)}</p>`;
    $('eyebrow').textContent = label;
  }
})();
