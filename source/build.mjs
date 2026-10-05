import fs from 'fs';
import { feature } from 'topojson-client';
import { geoConicConformal, geoPath, geoMercator } from 'd3-geo';
import { PLACES, ORCIA_PTS, LOOPS, SCENARIOS, VERSION } from './data.mjs';

const C = { b: '#1f5f99', o: '#c4650c', g: '#2e7d4f', s: '#555b63' };
const WHO = { b: 'Nous deux', o: 'Ensemble', g: 'Chantal et Norm (exemple)', s: 'Nous deux, puis ensemble' };
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---------- base map ----------
const topo = JSON.parse(fs.readFileSync('node_modules/world-atlas/countries-50m.json'));
const land = feature(topo, topo.objects.countries);
const W = 900, H = 720;
const proj = geoConicConformal().parallels([42, 48]).rotate([-7, 0])
  .fitExtent([[10, 10], [W - 10, H - 10]], { type: 'MultiPoint', coordinates: [[-2.5, 50.3], [16.5, 50.3], [-2.5, 40.4], [16.5, 40.4]] })
  .clipExtent([[0, 0], [W, H]]);
const path = geoPath(proj).digits(1);
const hi = new Set(['250', '756', '380']);
let base = `<rect width="${W}" height="${H}" fill="#dce8ef"/>`;
for (const f of land.features) {
  const d = path(f); if (!d) continue;
  base += `<path d="${d}" fill="${hi.has(f.id) ? '#f1ece0' : '#e6e3dc'}" stroke="#b5ae9f" stroke-width="0.8"/>`;
}
const pt = (k) => proj(PLACES[k].at).map((v) => Math.round(v * 10) / 10);

function halo(x, y, txt, { anchor = 'start', size = 18, weight = 'bold', fill = '#1e1e1e', italic = false } = {}) {
  const st = `x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" font-weight="${weight}"${italic ? ' font-style="italic"' : ''}`;
  return `<text ${st} fill="#fff" stroke="#fff" stroke-width="6" stroke-linejoin="round">${esc(txt)}</text><text ${st} fill="${fill}">${esc(txt)}</text>`;
}
const EMO = 'font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif"';
function badge(x, y, icon) {
  return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="15" fill="#fff" stroke="#c9c2b2" stroke-width="1.5"/><text x="${x.toFixed(1)}" y="${(y + 6).toFixed(1)}" text-anchor="middle" font-size="16" ${EMO}>${icon}</text>`;
}
function leg(a, b, kind, bend = 0.12, icon = '') {
  const [x1, y1] = pt(a), [x2, y2] = pt(b);
  let color, dash = '', width = 4;
  if (kind === 'fly') { color = '#6b6b6b'; dash = '2 9'; width = 3; bend = bend === 0.12 ? 0.18 : bend; }
  else if (kind === 'on') { color = C.o; dash = '12 8'; }
  else color = C[kind];
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = x2 - x1, dy = y2 - y1;
  const cx = mx - dy * bend, cy = my + dx * bend, t = 0.68;
  const ax = (1 - t) ** 2 * x1 + 2 * (1 - t) * t * cx + t * t * x2, ay = (1 - t) ** 2 * y1 + 2 * (1 - t) * t * cy + t * t * y2;
  const ang = Math.atan2(2 * (1 - t) * (cy - y1) + 2 * t * (y2 - cy), 2 * (1 - t) * (cx - x1) + 2 * t * (x2 - cx)) * 180 / Math.PI;
  return `<path d="M${x1},${y1} Q${cx.toFixed(1)},${cy.toFixed(1)} ${x2},${y2}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round"${dash ? ` stroke-dasharray="${dash}"` : ''} opacity="0.92"/>
<path d="M-8,-6 L6,0 L-8,6 Z" fill="${color}" transform="translate(${ax.toFixed(1)},${ay.toFixed(1)}) rotate(${ang.toFixed(0)})"/>`
    + (icon ? badge(0.16 * x1 + 0.48 * cx + 0.36 * x2, 0.16 * y1 + 0.48 * cy + 0.36 * y2, icon) : '');
}
function scenarioMap(sc) {
  let s = base;
  const [px, py] = pt('paris');
  if (sc.flights.includes('in')) s += `<path d="M${px - 14},${py - 8} L25,${py - 60}" stroke="#6b6b6b" stroke-width="2.5" stroke-dasharray="2 7" stroke-linecap="round" fill="none"/>` + halo(22, py - 70, "Arrivée d’Ottawa", { size: 16, weight: 'normal', fill: '#333' });
  if (sc.flights.includes('out')) s += `<path d="M${px - 14},${py + 8} L25,${py + 60}" stroke="#6b6b6b" stroke-width="2.5" stroke-dasharray="2 7" stroke-linecap="round" fill="none"/>` + halo(22, py + 80, 'Retour vers Ottawa', { size: 16, weight: 'normal', fill: '#333' });
  if (sc.returnNote) s += halo(22, py + 80, sc.returnNote, { size: 16, weight: 'normal', fill: '#333' });
  const order = (l) => (l[2] === 'g' ? 0 : 1);
  for (const l of [...sc.legs].sort((a, b) => order(a) - order(b))) s += leg(l[0], l[1], l[2], l[3] ?? 0.12, (sc.modes || {})[`${l[0]}-${l[1]}`] === '🚗' ? '🚗' : '');
  for (const [a, b, dx, dy] of sc.night) { const [x1, y1] = pt(a), [x2, y2] = pt(b); s += halo((x1 + x2) / 2 + dx, (y1 + y2) / 2 + dy, 'train de nuit', { size: 16, fill: C.o, italic: true }); }
  for (const [k, who, nights, num, off] of sc.stops) {
    const [x, y] = pt(k), col = C[who];
    const [ox, oy, an = 'start'] = off;
    s += `<g class="stop" data-key="${k}" data-sc="${sc.id}" tabindex="0" role="button" aria-label="${esc(PLACES[k].name)}, ${nights} — voir les sorties">
<circle cx="${x}" cy="${y}" r="24" fill="transparent"/>
<circle class="dot" cx="${x}" cy="${y}" r="14" fill="${col}" stroke="#fff" stroke-width="3"/>
<text x="${x}" y="${y + 5}" text-anchor="middle" font-size="${num.length > 1 ? 11 : 14}" font-weight="bold" fill="#fff">${num}</text>
${halo(x + ox, y + oy, `${PLACES[k].name.replace(/ \(.*\)/, '')} · ${nights}`, { anchor: an })}</g>`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" class="bigmap" role="img" aria-label="Carte du scénario ${sc.id}">${s}</svg>`;
}

// ---------- spoke diagrams ----------
const MODE_ICON = { 'train': '🚆', 'RER': '🚆', 'train + navette': '🚆🚌', 'métro': '🚇', 'vélo': '🚲', 'auto': '🚗', 'télécabine': '🚠',
  'téléphérique': '🚠', 'bateau': '⛴️', 'bateau rapide': '⛴️', 'autobus': '🚌', 'train + bateau': '🚆⛴️', 'petit train': '🚞' };
function spokeSvg(key, color) {
  const P = PLACES[key], [lon0, lat0] = P.at, k = Math.cos(lat0 * Math.PI / 180);
  const VW = 640, VH = 390, hx = 320, hy = 195;
  let items = P.spokes.map(([n, min, how, [lon, lat]]) => ({ n, min, how, a: Math.atan2(lat - lat0, (lon - lon0) * k) }));
  items.sort((a, b) => a.a - b.a);
  const gap = 40 * Math.PI / 180;
  for (let pass = 0; pass < 30; pass++) {
    for (let i = 0; i < items.length; i++) {
      const a = items[i], b = items[(i + 1) % items.length];
      let d = b.a - a.a; if (i === items.length - 1) d += 2 * Math.PI;
      if (d < gap) { const push = (gap - d) / 2; a.a -= push; b.a += push; }
    }
  }
  let g = '';
  const pts = items.map((it) => { const r = 100 + Math.min(it.min, 90) * 0.55; return { ...it, x: hx + r * Math.cos(it.a), y: hy - r * Math.sin(it.a) }; });
  for (const p of pts) g += `<line x1="${hx}" y1="${hy}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}" stroke="#9a907c" stroke-width="2.5" stroke-dasharray="6 5"/>`;
  for (const p of pts) {
    const c = Math.cos(p.a), s = Math.sin(p.a);
    let an = 'middle', lx = p.x, ly1, ly2;
    if (c > 0.4) { an = 'start'; lx = p.x + 12; ly1 = p.y - 2; ly2 = p.y + 14; }
    else if (c < -0.4) { an = 'end'; lx = p.x - 12; ly1 = p.y - 2; ly2 = p.y + 14; }
    else if (s > 0) { ly1 = p.y - 26; ly2 = p.y - 11; }
    else { ly1 = p.y + 22; ly2 = p.y + 37; }
    const t = p.min >= 60 ? `${Math.floor(p.min / 60)} h${p.min % 60 ? ' ' + String(p.min % 60).padStart(2, '0') : ''}` : `${p.min} min`;
    g += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="6" fill="#9a907c" stroke="#fff" stroke-width="2"/>`
      + halo(lx.toFixed(1), ly1, p.n, { anchor: an, size: 15 }) + halo(lx.toFixed(1), ly2, `${t} · ${p.how}`, { anchor: an, size: 13, weight: 'normal', fill: '#4a4a4a' })
      + (() => { const ic = MODE_ICON[p.how] || ''; const mx = hx + (p.x - hx) * 0.6, my = hy + (p.y - hy) * 0.6, w = ic.length > 2 ? 22 : 13;
          return `<rect x="${(mx - w).toFixed(1)}" y="${(my - 13).toFixed(1)}" width="${2 * w}" height="26" rx="13" fill="#fff" stroke="#c9c2b2" stroke-width="1.2"/><text x="${mx.toFixed(1)}" y="${(my + 6).toFixed(1)}" text-anchor="middle" font-size="15" ${EMO}>${ic}</text>`; })();
  }
  g += `<circle cx="${hx}" cy="${hy}" r="15" fill="${color}" stroke="#fff" stroke-width="3"/>`;
  return `<svg viewBox="0 0 ${VW} ${VH}" xmlns="http://www.w3.org/2000/svg" class="spokes" role="img" aria-label="Sorties à la journée depuis ${esc(P.name)}"><rect width="${VW}" height="${VH}" rx="10" fill="#f6f2e7"/>${g}</svg>`;
}

// ---------- Val d'Orcia loops ----------
function loopsSvg() {
  const VW = 640, VH = 440;
  const near = Object.entries(ORCIA_PTS).filter(([k]) => k !== 'siena' && k !== 'asciano');
  const lp = geoMercator().fitExtent([[70, 70], [VW - 90, VH - 40]], { type: 'MultiPoint', coordinates: near.map(([, p]) => p[1]) });
  const q = (k) => lp(ORCIA_PTS[k][1]);
  let g = '';
  const [px, py] = q('pienza');
  LOOPS.forEach((L, i) => {
    const off = (i - 1.5) * 3;
    if (L.path.includes('siena')) {
      // off-map loop: arrow from Pienza toward the north-west edge
      const ex = 150, ey = 36;
      g += `<path d="M${px},${py} Q${(px + ex) / 2 + 40},${(py + ey) / 2 + 10} ${ex},${ey}" fill="none" stroke="${L.color}" stroke-width="4" stroke-dasharray="10 7" stroke-linecap="round"/>`
        + `<path d="M-9,-7 L7,0 L-9,7 Z" fill="${L.color}" transform="translate(${ex},${ey}) rotate(200)"/>`
        + halo(ex + 4, ey + 30, 'Asciano et Sienne, 1 h', { anchor: 'start', size: 14, fill: L.color });
      return;
    }
    const d = L.path.map((k, j) => { const [x, y] = q(k); return `${j ? 'L' : 'M'}${(x + off).toFixed(1)},${(y + off).toFixed(1)}`; }).join(' ');
    g += `<path d="${d}" fill="none" stroke="${L.color}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round" opacity="0.88"/>`;
  });
  const lab = {
    pienza: [14, -14, 'start'], monticchiello: [10, 24, 'start'], montepulciano: [0, -16, 'middle'], vitaleta: [0, -16, 'middle'],
    sanquirico: [0, 24, 'middle'], bagno: [-12, 5, 'end'], sanfilippo: [12, 5, 'start'], montalcino: [0, -16, 'middle'], rocca: [-12, 5, 'end'] };
  for (const [k, [name]] of near) {
    const [x, y] = q(k), [ox, oy, an] = lab[k];
    const hub = k === 'pienza';
    g += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${hub ? 12 : 6}" fill="${hub ? '#1f5f99' : '#5b5446'}" stroke="#fff" stroke-width="${hub ? 3 : 2}"/>`
      + halo((x + ox).toFixed(1), (y + oy).toFixed(1), name, { anchor: an, size: hub ? 18 : 14 });
  }
  return `<svg viewBox="0 0 ${VW} ${VH}" xmlns="http://www.w3.org/2000/svg" class="spokes" role="img" aria-label="Quatre journées en boucle depuis Pienza"><rect width="${VW}" height="${VH}" rx="10" fill="#f6f2e7"/>${g}</svg>`;
}

// ---------- outputs for review ----------

// ---------- page ----------
const spokesHtml = {};
for (const k of Object.keys(PLACES)) {
  if (k === 'orcia') continue;
  spokesHtml[k] = spokeSvg(k, '#COLOR#');
}
const loopsHtml = loopsSvg();
const placeData = {};
for (const [k, p] of Object.entries(PLACES)) placeData[k] = { name: p.name, what: p.what, photos: p.photos };

const tpl = fs.readFileSync('page.html', 'utf8')
  .replace('/*MAPS*/', JSON.stringify(Object.fromEntries(SCENARIOS.map((s) => [s.id, scenarioMap(s)]))))
  .replace('/*SPOKES*/', JSON.stringify(spokesHtml))
  .replace('/*LOOPSVG*/', JSON.stringify(loopsHtml))
  .replace('/*LOOPS*/', JSON.stringify(LOOPS.map(({ name, color, steps }) => ({ name, color, steps }))))
  .replace('/*PLACES*/', JSON.stringify(placeData))
  .replace('/*SCEN*/', JSON.stringify(SCENARIOS.map(({ id, title, short, sees, meet, them, good, bad, stops }) => ({ id, title, short, sees, meet, them, good, bad, stops: stops.map(([k, who, n]) => [k, who, n]) }))))
  .replace('/*COLORS*/', JSON.stringify(C))
  .replace('/*WHO*/', JSON.stringify(WHO))
  .replace(/%%VERSION%%/g, VERSION.number).replace(/%%VDATE%%/g, VERSION.date);
fs.mkdirSync('../site', { recursive: true });
fs.writeFileSync('../site/index.html', tpl);
console.log('size', tpl.length);
