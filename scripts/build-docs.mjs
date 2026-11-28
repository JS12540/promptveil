import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { escapeHtml, renderGuide } from './markdown.mjs';

const groups = [
  ['Start here', [
    ['', 'Overview', 'docs/README.md'],
    ['quick-start/', 'Quick start', 'docs/quick-start.md'],
    ['install/', 'Installation', 'docs/install.md'],
    ['usage/', 'Everyday usage', 'docs/usage.md'],
  ]],
  ['Use PromptVeil', [
    ['cli/', 'Command-line reference', 'docs/cli.md'],
    ['agents/', 'Coding-agent setup', 'docs/agents.md'],
    ['troubleshooting/', 'Troubleshooting', 'docs/troubleshooting.md'],
    ['compatibility/', 'Compatibility', 'docs/compatibility.md'],
  ]],
  ['Project reference', [
    ['architecture/', 'Architecture', 'docs/architecture.md'],
    ['privacy/', 'Privacy and threat model', 'docs/threat-model.md'],
    ['decisions/', 'Design decisions', 'docs/decisions/README.md'],
    ['testing/', 'Testing and evaluation', 'docs/testing.md'],
    ['deployment/', 'Release and deployment', 'docs/releasing.md'],
  ]],
];

const pages = groups.flatMap(([, entries]) => entries);
const routes = new Map(pages.map(([route, , file]) => [file, route]));

export async function buildDocs(web, html, source, csp) {
  const docs = join(web, 'docs');
  await mkdir(docs, { recursive: true });
  await cp('apps/web/docs.css', join(docs, 'docs.css'));

  const search = [];
  for (const [index, [route, label, file]] of pages.entries()) {
    const docsRoot = route ? '../' : './';
    const root = docsRoot + '../';
    const markdown = await readFile(file, 'utf8');
    const title = /^# (.+)$/m.exec(markdown)?.[1] ?? label;
    const { content, headings } = renderGuide(markdown, { file, routes, docsRoot, source });
    search.push({ title, section: '', route });
    for (const { id, label } of headings) search.push({ title, section: label, route: route + '#' + id });
    const navigation = groups.map(([group, entries]) => (
      '<section><h2>' + group + '</h2><ul>' + entries.map(([destination, name]) => (
        '<li><a href="' + docsRoot + destination + '"' + (destination === route ? ' aria-current="page"' : '') + '>' + name + '</a></li>'
      )).join('') + '</ul></section>'
    )).join('');
    const outline = headings.length ? '<aside class="outline"><nav aria-label="On this page"><strong>On this page</strong><ul>'
      + headings.map(({ id, label, level }) => '<li class="depth-' + level + '"><a href="#' + id + '">' + escapeHtml(label) + '</a></li>').join('')
      + '</ul></nav></aside>' : '';
    const adjacent = [pages[index - 1], pages[index + 1]].map((page, direction) => page
      ? '<a href="' + docsRoot + page[0] + '"><span>' + (direction ? 'Next' : 'Previous') + '</span>' + page[1] + '</a>'
      : '<span></span>').join('');
    const group = groups.find(([, entries]) => entries.some(([destination]) => destination === route))[0];
    const body = `
<a class="skip" href="#content">Skip to guide</a>
<header class="docs-header">
  <a class="docs-brand" href="${root}"><img src="${root}app/icon-192.png" width="32" height="32" alt="">PromptVeil</a>
  <nav aria-label="Site"><a href="${docsRoot}" aria-current="true">Docs</a><a href="${source}">GitHub</a><a class="button" href="${root}app/">Open composer</a></nav>
</header>
<div class="docs-layout">
  <aside class="sidebar"><nav aria-label="Documentation">${navigation}</nav></aside>
  <details class="mobile-nav"><summary>Browse documentation</summary><nav aria-label="Documentation">${navigation}</nav></details>
  <main id="content">
    <details class="docs-search"><summary>Search docs</summary>
      <label for="docs-search">Search guides and sections</label><input id="docs-search" type="search">
      <p id="docs-search-status" role="status"></p><ul id="docs-results"></ul>
    </details>
    <p class="group">${group}</p>
    <h1>${escapeHtml(title)}</h1>
    ${route ? "" : `<img class="docs-banner" src="${root}assets/promptveil-hero.png" width="1774" height="887" alt="PromptVeil masks a fictional customer ID and email while preserving the damaged-package request and $48 refund">`}
    ${content}
    <nav class="adjacent" aria-label="Adjacent guides">${adjacent}</nav>
  </main>
  ${outline}
</div>
<script type="module" src="${docsRoot}search.js"></script>`;
    const head = csp + '<link rel="icon" href="' + root + 'app/icon-192.png"><link rel="stylesheet" href="'
      + root + 'assets/style.css"><link rel="stylesheet" href="' + docsRoot + 'docs.css">';
    const destination = join(docs, route, 'index.html');
    await mkdir(join(docs, route), { recursive: true });
    await writeFile(destination, html(escapeHtml(title) + ' | PromptVeil Docs', head, body));
  }
  const client = await readFile('apps/web/docs-search.js', 'utf8');
  await writeFile(join(docs, 'search.js'), 'const entries = ' + JSON.stringify(search) + ';\n' + client);
}
