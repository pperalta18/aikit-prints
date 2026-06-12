import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { computeWallFrames, PARED_COMPLETA_FACES } from '../src/print/space/wallFrames.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const KIT_BLUE = '#0070f9'
const BLACK = '#111111'

// ── rules from the operator ──────────────────────────────────────────────
const EXCLUDE = new Set(['13-n-1', '1-s-1'])      // sin print → fuera del plano (13-N-1, 1-S-1)
const CUBE_ONLY_OUTER = false            // expositores 33-36 son a DOBLE CARA → imprimir las 2 caras
const BLACK_CODES = ['1-n-1', '2-w-2', '4-w-3', '6-e-1', '7-n-1', '9-e-2', '14-n-1', '15-e-1', '21-s-1', '26-n-1'] // paint black, no print

// ── walls + frames (same derivation the 3D scene uses) ───────────────────
const L = JSON.parse(readFileSync(join(ROOT, 'src/print/space/event-layout.json'), 'utf8'))
const offX = -L.spaceWidth / 2, offZ = -L.spaceDepth / 2
const wh = L.wallHeight > 0 ? L.wallHeight : 2.5
const walls = L.elements.filter(e => e.type === 'wall').map((e, i) => {
  const sx = e.w, sz = e.h, na = sx <= sz ? 'x' : 'z'
  const explicit = typeof e.alturaM === 'number' && e.alturaM > 0
  return { id: `wall-${i}`, cx: e.x + e.w / 2 + offX, cz: e.y + e.h / 2 + offZ, sx, sz, normalAxis: na,
    length: na === 'x' ? sz : sx, thickness: na === 'x' ? sx : sz, height: explicit ? e.alturaM : wh, hasExplicitHeight: explicit,
    registry: e.invId == null ? undefined : { invId: e.invId, sala: e.sala ?? '', tema: e.tema ?? '', rol: e.rol ?? '', track: e.track ?? 'C/I', research: e.research ?? false, estado: e.estado ?? 'pend' } }
})
const REG = walls.filter(w => w.registry).sort((a, b) => a.registry.invId - b.registry.invId)
const frames = computeWallFrames({ walls: REG, allWalls: walls, fallbackHeight: wh, fullFaces: PARED_COMPLETA_FACES })
const wallById = new Map(walls.map(w => [w.id, w]))
const frameById = new Map(frames.map(f => [f.id, f]))

// ── docs joined to frames by frameId (frameDocRank tiebreak) ─────────────
const slug = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
const docs = []
for (const d of (await import('node:fs')).readdirSync(join(ROOT, 'public/prints'), { withFileTypes: true })) {
  if (!d.isDirectory()) continue
  try { docs.push(JSON.parse(readFileSync(join(ROOT, 'public/prints', d.name, 'doc.json'), 'utf8'))) } catch {}
}
const rank = d => { const fid = d.props?.frameId; const canon = typeof fid === 'string' && d.id === slug(fid); return (d.pageComponentId !== 'blank' ? 2 : 0) + (canon ? 0 : 1) }
const docByFrame = new Map()
for (const d of docs) { const fid = d.props?.frameId; if (typeof fid !== 'string' || !fid) continue; const cur = docByFrame.get(fid); if (!cur || rank(d) > rank(cur)) docByFrame.set(fid, d) }

// geometry helper: face-anchored world position + face tag
function geom(f) {
  const w = wallById.get(f.wallId)
  const tag = w.normalAxis === 'x' ? (f.side > 0 ? 'E' : 'W') : (f.side > 0 ? 'S' : 'N')
  let lx, lz
  if (w.normalAxis === 'x') { lx = w.cx + f.side * (w.thickness / 2); lz = f.alongCenter }
  else { lx = f.alongCenter; lz = w.cz + f.side * (w.thickness / 2) }
  return { w, tag, lx, lz }
}

// ── assemble the two sets ────────────────────────────────────────────────
// 1. candidatos = todos los frames con gráfica real (no blank, no excluidos)
const cand = []
for (const f of frames) {
  const d = docByFrame.get(f.id)
  if (!d || d.pageComponentId === 'blank') continue
  if (EXCLUDE.has(d.id)) continue
  const g = geom(f)
  cand.push({ code: d.id.toUpperCase(), inv: f.invId, face: g.tag, side: f.side, frameW: Math.round(f.widthM * 1000),
    page: d.pageComponentId, trimW: d.dimensions?.trimWidthMm, trimH: d.dimensions?.trimHeightMm, ...g })
}
// 2. cubo-cara: quedarnos solo con las caras EXTERIORES (cara que mira hacia fuera del
//    centroide del clúster). Robusto al renumerado (detecta por page='cubo-cara').
if (CUBE_ONLY_OUTER) {
  const cube = cand.filter(c => c.page === 'cubo-cara')
  if (cube.length) {
    const cZ = cube.reduce((s, c) => s + c.w.cz, 0) / cube.length
    const cX = cube.reduce((s, c) => s + c.w.cx, 0) / cube.length
    for (const c of cube) {
      const outer = c.w.normalAxis === 'z' ? (c.w.cz >= cZ ? 1 : -1) : (c.w.cx >= cX ? 1 : -1)
      c._inner = c.side !== outer
    }
  }
}
const real = cand.filter(c => !c._inner)
const black = []
for (const code of BLACK_CODES) {
  const f = frameById.get(code.toUpperCase())
  if (!f) { console.error('BLACK frame missing:', code); continue }
  const g = geom(f)
  black.push({ code: f.id, inv: f.invId, face: g.tag, side: f.side, frameW: Math.round(f.widthM * 1000), ...g })
}
const byWall = (a, b) => a.inv - b.inv || a.code.localeCompare(b.code)
real.sort(byWall); black.sort(byWall)

// ── plano SVG (N up; +x = E right) ───────────────────────────────────────
const CTX = walls.filter(w => w.registry)
const xs = CTX.flatMap(w => [w.cx - w.sx / 2, w.cx + w.sx / 2])
const zs = CTX.flatMap(w => [w.cz - w.sz / 2, w.cz + w.sz / 2])
const PAD = 2.2, S = 38
const minX = Math.min(...xs) - PAD, maxX = Math.max(...xs) + PAD
const minZ = Math.min(...zs) - PAD, maxZ = Math.max(...zs) + PAD
const X = x => (x - minX) * S, Y = z => (z - minZ) * S
const Wpx = (maxX - minX) * S, Hpx = (maxZ - minZ) * S
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

let grid = ''
for (let gx = Math.ceil(minX); gx <= maxX; gx++) { const c = gx % 5 === 0; grid += `<line x1="${X(gx)}" y1="0" x2="${X(gx)}" y2="${Hpx}" stroke="${c ? '#e2e2e2' : '#f1f1f1'}" stroke-width="${c ? 1 : 0.6}"/>` }
for (let gz = Math.ceil(minZ); gz <= maxZ; gz++) { const c = gz % 5 === 0; grid += `<line x1="0" y1="${Y(gz)}" x2="${Wpx}" y2="${Y(gz)}" stroke="${c ? '#e2e2e2' : '#f1f1f1'}" stroke-width="${c ? 1 : 0.6}"/>` }
let wallsSvg = ''
for (const w of CTX) wallsSvg += `<rect x="${X(w.cx - w.sx / 2)}" y="${Y(w.cz - w.sz / 2)}" width="${w.sx * S}" height="${w.sz * S}" fill="#cfcfcf" stroke="#a9a9a9" stroke-width="0.6"/>`

const placed = []
function place(cx, cy, w, h) {
  let y = cy
  for (let i = 0; i < 48; i++) {
    const box = { x: cx - w / 2, y: y - h / 2, w, h }
    const hit = placed.find(b => !(box.x + box.w < b.x || box.x > b.x + b.w || box.y + box.h < b.y || box.y > b.y + b.h))
    if (!hit) { placed.push(box); return y }
    y += (i % 2 ? -1 : 1) * Math.ceil((i + 1) / 2) * (h + 1)
  }
  placed.push({ x: cx - w / 2, y: y - h / 2, w, h }); return y
}

const BAR = 0.16
function draw(p, col) {
  let bx, by, bw, bh, lx, ly, anchor = 'middle'
  const w = p.w
  if (w.normalAxis === 'z') {
    const aC = p.lx // along is x for z-normal walls => lx already = alongCenter
    const x0 = X(aC - p.frameW / 2000), x1 = X(aC + p.frameW / 2000)
    const faceZ = w.cz + p.side * (w.thickness / 2)
    by = p.side > 0 ? Y(faceZ) : Y(faceZ) - BAR * S
    bx = x0; bw = x1 - x0; bh = BAR * S
    lx = (x0 + x1) / 2; ly = p.side > 0 ? Y(faceZ) + 13 : Y(faceZ) - 6
  } else {
    const aC = p.lz
    const z0 = Y(aC - p.frameW / 2000), z1 = Y(aC + p.frameW / 2000)
    const faceX = w.cx + p.side * (w.thickness / 2)
    bx = p.side > 0 ? X(faceX) : X(faceX) - BAR * S
    by = z0; bw = BAR * S; bh = z1 - z0
    lx = p.side > 0 ? X(faceX) + 5 : X(faceX) - 5
    anchor = p.side > 0 ? 'start' : 'end'
    ly = (z0 + z1) / 2 + 3
  }
  const bar = `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${Math.max(bw, 2).toFixed(1)}" height="${Math.max(bh, 2).toFixed(1)}" fill="${col}" rx="1"/>`
  const tw = p.code.length * 5.4 + 6, th = 12
  const fy = place(lx, ly, tw, th)
  let leader = ''
  if (Math.abs(fy - ly) > 2) leader = `<line x1="${lx}" y1="${ly - 3}" x2="${lx}" y2="${fy - 3}" stroke="${col}" stroke-width="0.6" stroke-dasharray="2 2"/>`
  const tx = anchor === 'middle' ? lx - tw / 2 : anchor === 'start' ? lx - 2 : lx - tw + 2
  const label = `<g><rect x="${tx.toFixed(1)}" y="${(fy - 9).toFixed(1)}" width="${tw.toFixed(1)}" height="${th}" fill="#ffffff" fill-opacity="0.88" rx="2"/><text x="${lx.toFixed(1)}" y="${fy.toFixed(1)}" text-anchor="${anchor}" font-family="ui-monospace,Menlo,monospace" font-size="9.5" font-weight="700" fill="${col}">${esc(p.code)}</text></g>`
  return { bar, leader, label }
}

let bars = '', leaders = '', labels = ''
for (const p of real) { const d = draw(p, KIT_BLUE); bars += d.bar; leaders += d.leader; labels += d.label }
for (const p of black) { const d = draw(p, BLACK); bars += d.bar; leaders += d.leader; labels += d.label }

const NA = `<g transform="translate(${(Wpx - 46).toFixed(0)},42)"><circle r="22" fill="#fff" stroke="#bbb"/><path d="M0,-15 L6,8 L0,3 L-6,8 Z" fill="#111"/><text y="20" text-anchor="middle" font-family="sans-serif" font-size="10" font-weight="700">N</text></g>`
const sm = 5
const SB = `<g transform="translate(20,${(Hpx - 22).toFixed(0)})"><rect x="0" y="0" width="${sm * S}" height="6" fill="#111"/><rect x="0" y="0" width="${sm * S / 2}" height="6" fill="#fff" stroke="#111" stroke-width="0.7"/><rect x="${sm * S / 2}" y="0" width="${sm * S / 2}" height="6" fill="#111"/><text x="0" y="20" font-family="sans-serif" font-size="10">0</text><text x="${(sm * S).toFixed(0)}" y="20" text-anchor="end" font-family="sans-serif" font-size="10">${sm} m</text></g>`

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Wpx.toFixed(0)} ${Hpx.toFixed(0)}" width="${Wpx.toFixed(0)}" height="${Hpx.toFixed(0)}">
<rect width="${Wpx.toFixed(0)}" height="${Hpx.toFixed(0)}" fill="#ffffff"/>
${grid}${wallsSvg}${leaders}${bars}${labels}${NA}${SB}</svg>`

mkdirSync(join(ROOT, 'out/imprenta'), { recursive: true })
writeFileSync(join(ROOT, 'out/imprenta/plano-prints.svg'), svg)

// ── tables ───────────────────────────────────────────────────────────────
const fmt = mm => (mm / 1000).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const faceName = f => ({ N: 'Norte', S: 'Sur', E: 'Este', W: 'Oeste' }[f] || f)
const printRows = real.map(p => `<tr><td class="code">${esc(p.code)}</td><td>${faceName(p.face)} (${p.face})</td><td class="num">${fmt(p.trimW)} × ${fmt(p.trimH)} m</td></tr>`).join('')
const blackRows = black.map(p => `<tr><td class="code">${esc(p.code)}</td><td>${faceName(p.face)} (${p.face})</td><td class="neg">Negro</td></tr>`).join('')

const today = '8 jun 2026'
const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
@page{size:A3 portrait;margin:12mm}*{box-sizing:border-box}
body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#161616;margin:0}
h1{font-size:21px;margin:0 0 2px}.sub{color:#666;font-size:12px}
.head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #111;padding-bottom:8px;margin-bottom:12px}
.brand{font-weight:800;letter-spacing:.3px}
.planowrap{text-align:center;page-break-after:always}
.planowrap svg{max-width:100%;height:auto;border:1px solid #e3e3e3}
.legend{margin:10px 0;font-size:12px;display:flex;gap:24px;justify-content:center}
.lg{display:inline-flex;align-items:center}.dot{width:12px;height:12px;border-radius:2px;margin-right:7px}
.note{font-size:10.5px;color:#555;margin:6px auto 0;max-width:780px;text-align:center}
h2{font-size:15px;margin:0 0 8px;border-bottom:1px solid #ccc;padding-bottom:4px}
h2 .c{color:#888;font-weight:400;font-size:13px}
table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:18px}
th{text-align:left;background:#111;color:#fff;padding:6px 8px;font-size:11px}
td{padding:5px 8px;border-bottom:1px solid #ececec;vertical-align:top}
.code{font-family:ui-monospace,Menlo,monospace;font-weight:800;white-space:nowrap}
.num{font-family:ui-monospace,Menlo,monospace;white-space:nowrap;text-align:right}
.neg{color:#111;font-weight:700;font-size:11px}
.tablepage{page-break-before:always}
.cols{column-count:2;column-gap:22px}
</style></head><body>
<div class="head"><div><h1>Plano de impresión · ubicación de gráficas</h1><div class="sub">AiKit Live — venue 2026 · qué va en cada pared (código)</div></div>
<div style="text-align:right"><div class="brand">AiKit&nbsp;Live</div><div class="sub">${today} · ${real.length} para imprimir · ${black.length} en negro</div></div></div>
<div class="planowrap">${svg}
<div class="legend"><span class="lg"><span class="dot" style="background:${KIT_BLUE}"></span>Gráfica (se imprime)</span><span class="lg"><span class="dot" style="background:${BLACK}"></span>Negro (no se imprime)</span></div>
<div class="note">Vista cenital a escala (Norte arriba). Cada barra marca la <b>cara de la pared</b> y su <b>código</b>. Gris = contexto del local. En <b>negro</b> = pared oscura/pintada, no lleva print (solo se indica). Medida = tamaño final de impresión (ancho × alto); los PDF llevan 10&nbsp;mm de sangrado.</div></div>
<div class="tablepage">
<h2>Gráficas para imprimir <span class="c">— ${real.length}</span></h2>
<table><thead><tr><th>Código</th><th>Cara</th><th>Tamaño impresión</th></tr></thead><tbody>${printRows}</tbody></table>
<h2>Caras en negro <span class="c">— ${black.length} · no imprimir</span></h2>
<table><thead><tr><th>Código</th><th>Cara</th><th></th></tr></thead><tbody>${blackRows}</tbody></table>
</div></body></html>`
writeFileSync(join(ROOT, 'out/imprenta/plano-prints.html'), html)

// ── CSV ──────────────────────────────────────────────────────────────────
const cE = v => /[",\n;]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v)
const rows = [['codigo', 'cara', 'tipo', 'ancho_m', 'alto_m', 'ancho_mm', 'alto_mm']]
for (const p of real) rows.push([p.code, p.face, 'imprimir', fmt(p.trimW), fmt(p.trimH), p.trimW, p.trimH])
for (const p of black) rows.push([p.code, p.face, 'negro', '', '', '', ''])
writeFileSync(join(ROOT, 'out/imprenta/listado-prints.csv'), rows.map(r => r.map(cE).join(';')).join('\n') + '\n')

console.log(`OK — imprimir: ${real.length}, negro: ${black.length}  (${Wpx.toFixed(0)}x${Hpx.toFixed(0)}px)`)
console.log('imprimir:', real.map(p => p.code).join(', '))
console.log('negro   :', black.map(p => p.code).join(', '))
