// Shared helpers for game modules.
export const NS = 'http://www.w3.org/2000/svg';
export const col = i => `var(--c${i})`;

export function svgEl(tag, attrs = {}) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}
export function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'style') e.setAttribute('style', v);
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v === true) e.setAttribute(k, '');
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k != null) e.append(k);
  return e;
}
export const setAt = (str, i, ch) => str.slice(0, i) + ch + str.slice(i + 1);

// X / O marks as small SVGs, colored by the player who owns them.
export function markSvg(mark, color) {
  const s = svgEl('svg', { viewBox: '0 0 100 100', class: 'mark', 'aria-label': mark });
  if (mark === 'X') {
    s.append(
      svgEl('line', { x1: 22, y1: 22, x2: 78, y2: 78, stroke: color }),
      svgEl('line', { x1: 78, y1: 22, x2: 22, y2: 78, stroke: color })
    );
  } else {
    s.append(svgEl('circle', { cx: 50, cy: 50, r: 30, stroke: color, fill: 'none' }));
  }
  return s;
}
