// Shared vector symbols keep Safari and desktop fonts from changing controls.
const paths = {
  '←': '<path d="M21 12H3m7-7-7 7 7 7"/>',
  '↗': '<path d="M5 19 19 5M5 5h14v14"/>',
  '→': '<path d="M3 12h18m-7-7 7 7-7 7"/>',
  '🏆': '<path d="M7 3h10v7a5 5 0 0 1-10 0ZM7 5H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4m-5 3v6m-4 0h8"/>',
  '〽': '<path fill="currentColor" stroke="none" d="m15 1-12 13h8l-2 9 12-13h-8Z"/>',
  'Ⅱ': '<path d="M8 4v16M16 4v16" stroke-width="4"/>',
  '⚠': '<path d="m12 3 10 18H2Zm0 6v5m0 3v.2"/>',
  '↻': '<path d="M20 10a8 8 0 1 0-1 8m1-14v6h-6"/>',
  '×': '<path d="m5 5 14 14M19 5 5 19"/>',
  '✓': '<path d="m4 12 5 5L20 6"/>',
  '★': '<path fill="currentColor" d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z"/>',
  '☆': '<path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z"/>'
};
const symbols = /[←↗→🏆〽Ⅱ⚠↻×✓★☆]/u;
export function iconify(root = document.body) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!node.parentElement.closest('script,style,svg,input,textarea') && symbols.test(node.data)) nodes.push(node);
  }
  for (const node of nodes) {
    const fragment = document.createDocumentFragment();
    for (const character of node.data) {
      if (!paths[character]) { fragment.append(document.createTextNode(character)); continue; }
      const span = document.createElement('span'); span.className = 'ui-symbol';
      span.setAttribute('aria-hidden', 'true');
      span.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" focusable="false">${paths[character]}</svg>`;
      fragment.append(span);
    }
    node.replaceWith(fragment);
  }
}
export function wantedStars(element, level) {
  if (element.dataset.level === String(level)) return;
  element.dataset.level = String(level);
  element.textContent = Array.from({length:5}, (_,i) => i < level ? '★' : '☆').join(' ');
  element.setAttribute('aria-label', `手配レベル ${level}`);
  iconify(element);
}
