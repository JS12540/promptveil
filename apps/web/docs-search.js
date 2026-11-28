const search = document.querySelector('#docs-search');
const results = document.querySelector('#docs-results');
const summary = document.querySelector('#docs-search-status');
const docsRoot = new URL('./', import.meta.url);

search.addEventListener('input', () => {
  const terms = search.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
  results.replaceChildren();
  summary.textContent = '';
  if (!terms.length) return;

  const matches = entries.filter(({ title, section }) => {
    const text = (title + ' ' + section).toLowerCase();
    return terms.every(term => text.includes(term));
  });
  summary.textContent = matches.length ? String(Math.min(matches.length, 10)) + ' results shown' : 'No matching guides';
  for (const { title, section, route } of matches.slice(0, 10)) {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = new URL(route, docsRoot);
    link.textContent = section ? title + ' / ' + section : title;
    item.append(link);
    results.append(item);
  }
});
