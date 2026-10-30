import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { collect } from '../scripts/catalog.mjs';

test('top-level folders become courses, subfolders become groups; site is skipped', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pweb-department-test-'));
  try {
    for (const dir of ['Литература', 'Разработка/Оригинал', 'Разработка/Модификация/Старое', 'site', '.git']) await mkdir(join(root, dir), { recursive: true });
    await writeFile(join(root, 'Литература', 'Обзор_пучков.pdf'), '%PDF');
    await writeFile(join(root, 'Литература', 'Книга.djvu'), 'x');
    await writeFile(join(root, 'Литература', '~$черновик.docx'), 'x');
    await writeFile(join(root, 'Разработка', 'Оригинал', 'grk.par'), 'x');
    await writeFile(join(root, 'Разработка', 'Модификация', 'Старое', 'Отчёт.docx'), 'x');
    await writeFile(join(root, 'site', 'index.pdf'), '%PDF');
    await writeFile(join(root, 'README.pdf'), '%PDF');
    const catalog = await collect(root, { $order: ['Разработка', 'Оригинал'], 'Разработка/Оригинал': { description: 'Исходные' }, 'Литература/Книга.djvu': { title: 'Лёб' } });
    assert.deepEqual(catalog.sections.map(s => s.name), ['Разработка', 'Литература']);
    assert.deepEqual(catalog.sections[0].groups.map(g => [g.name, g.description]), [['Оригинал', 'Исходные'], ['Модификация', '']]);
    assert.deepEqual(new Set(catalog.files.map(f => f.path)), new Set(['Литература/Обзор_пучков.pdf', 'Литература/Книга.djvu', 'Разработка/Оригинал/grk.par', 'Разработка/Модификация/Старое/Отчёт.docx']));
    const byPath = Object.fromEntries(catalog.files.map(f => [f.path, f]));
    assert.equal(byPath['Литература/Обзор_пучков.pdf'].view, 'files/Литература/Обзор_пучков.pdf');
    assert.equal(byPath['Литература/Обзор_пучков.pdf'].title, 'Обзор пучков');
    assert.equal(byPath['Литература/Книга.djvu'].title, 'Лёб');
    assert.equal(byPath['Литература/Книга.djvu'].view, null);
    assert.equal(byPath['Разработка/Модификация/Старое/Отчёт.docx'].folder, 'Старое');
    assert.equal(byPath['Разработка/Модификация/Старое/Отчёт.docx'].kind, 'Word');
  } finally {
    if (!root.startsWith(join(tmpdir(), 'pweb-department-test-'))) throw new Error('Unsafe fixture path');
    await rm(root, { recursive: true, force: true });
  }
});
