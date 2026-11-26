const html = text => text.replace(/[&<>"]/g, value => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[value]);

export function renderInstallGuide(markdown, sourceLink) {
  const sections = new Set(['laptop', 'mobile', 'terminal']);
  const inline = text => text.split(/(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g)
    .map(fragment => {
      if (fragment.startsWith('`') && fragment.endsWith('`')) return `<code>${html(fragment.slice(1, -1))}</code>`;
      if (fragment.startsWith('**') && fragment.endsWith('**')) return `<strong>${html(fragment.slice(2, -2))}</strong>`;
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(fragment);
      if (link) {
        const [, title, target] = link;
        if (target.startsWith('https://')) return `<a href="${html(target)}">${html(title)}</a>`;
        if (sourceLink && /^[\w.-]+\.md(?:#[\w-]+)?$/.test(target)) {
          return `<a href="${sourceLink}/blob/main/docs/${html(target)}">${html(title)}</a>`;
        }
        return html(title);
      }
      return html(fragment);
    }).join('');

  const rendered = [];
  const lines = markdown.split(/\r?\n/);
  let index = 0;
  while (index < lines.length) {
    const line = lines[index++];
    if (!line.trim() || /^# /.test(line)) continue;
    if (line.startsWith('```')) {
      const code = [];
      while (index < lines.length && !lines[index].startsWith('```')) code.push(lines[index++]);
      index++;
      rendered.push(`<pre><code>${html(code.join('\n'))}</code></pre>`);
      continue;
    }
    const heading = /^(#{2,3})\s+(.*)$/.exec(line);
    if (heading) {
      const id = heading[2].toLowerCase();
      const tag = `h${heading[1].length}`;
      rendered.push(`<${tag}${sections.has(id) ? ` id="${id}"` : ''}>${inline(heading[2])}</${tag}>`);
      continue;
    }
    if (/^\d+\. /.test(line)) {
      const items = [line];
      while (/^\d+\. /.test(lines[index] ?? '')) items.push(lines[index++]);
      rendered.push(`<ol>${items.map(item => `<li>${inline(item.replace(/^\d+\. /, ''))}</li>`).join('')}</ol>`);
      continue;
    }
    rendered.push(`<p>${inline(line)}</p>`);
  }
  return rendered.join('\n');
}
