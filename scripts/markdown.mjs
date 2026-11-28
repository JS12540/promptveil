import { posix } from 'node:path';

export const escapeHtml = text => text.replace(/[&<>"]/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
})[char]);

const slug = text => text.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s+/g, '-');

export function renderGuide(markdown, { file, routes, docsRoot, source }) {
  const headings = [];
  const ids = new Set();
  const inline = text => text.split(/(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g).map(part => {
    if (part.startsWith('`') && part.endsWith('`')) return '<code>' + escapeHtml(part.slice(1, -1)) + '</code>';
    if (part.startsWith('**') && part.endsWith('**')) return '<strong>' + escapeHtml(part.slice(2, -2)) + '</strong>';
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (!link) return escapeHtml(part);
    const [, label, target] = link;
    let href;
    if (/^https?:\/\//.test(target) || target.startsWith('#')) href = target;
    else if (!/^(?:[a-z][a-z\d+.-]*:|\/)/i.test(target)) {
      const [path, fragment] = target.split('#', 2);
      const resolved = posix.normalize(posix.join(posix.dirname(file), path));
      const route = routes.get(resolved);
      href = (route === undefined ? source + '/blob/main/' + resolved : docsRoot + route)
        + (fragment ? '#' + fragment : '');
    }
    return href ? '<a href="' + escapeHtml(href) + '">' + escapeHtml(label) + '</a>' : escapeHtml(label);
  }).join('');
  const lines = markdown.split(/\r?\n/);
  const blocks = [];
  let index = 0;
  const cells = row => row.trim().replace(/^\||\|$/g, '').split('|').map(cell => inline(cell.trim()));
  const list = /^(?:- |\d+\. )/;
  const special = line => !line?.trim() || /^(?:#{1,6} |```|> |\|)/.test(line) || list.test(line);
  while (index < lines.length) {
    const line = lines[index++];
    if (!line.trim() || /^# /.test(line)) continue;
    if (line.startsWith('```')) {
      const code = [];
      while (index < lines.length && !lines[index].startsWith('```')) code.push(lines[index++]);
      if (index === lines.length) throw new Error('Unclosed code fence in ' + file);
      index++;
      blocks.push('<pre tabindex="0"><code>' + escapeHtml(code.join('\n')) + '</code></pre>');
      continue;
    }
    const heading = /^(#{2,6}) +(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const label = heading[2];
      const base = slug(label);
      let id = base;
      for (let suffix = 1; ids.has(id); suffix++) id = base + '-' + suffix;
      ids.add(id);
      if (level <= 3) headings.push({ id, label, level });
      blocks.push('<h' + level + ' id="' + id + '">' + inline(label) + '</h' + level + '>');
      continue;
    }
    if (line.startsWith('|') && /^\|[\s:|-]+$/.test(lines[index] ?? '')) {
      index++;
      const header = cells(line).map(cell => '<th scope="col">' + cell + '</th>').join('');
      const rows = [];
      while (lines[index]?.startsWith('|')) {
        rows.push('<tr>' + cells(lines[index++]).map(cell => '<td>' + cell + '</td>').join('') + '</tr>');
      }
      blocks.push('<div class="table-wrap" tabindex="0"><table><thead><tr>' + header + '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>');
      continue;
    }
    if (list.test(line)) {
      const pattern = line.startsWith('- ') ? /^- / : /^\d+\. /;
      const tag = line.startsWith('- ') ? 'ul' : 'ol';
      const items = [line];
      while (pattern.test(lines[index] ?? '')) items.push(lines[index++]);
      blocks.push('<' + tag + '>' + items.map(item => '<li>' + inline(item.replace(pattern, '')) + '</li>').join('') + '</' + tag + '>');
      continue;
    }
    if (line.startsWith('> ')) {
      blocks.push('<blockquote><p>' + inline(line.slice(2)) + '</p></blockquote>');
      continue;
    }
    const paragraph = [line];
    while (!special(lines[index])) paragraph.push(lines[index++]);
    blocks.push('<p>' + inline(paragraph.join(' ')) + '</p>');
  }
  return { content: blocks.join('\n'), headings };
}
