#!/usr/bin/env node
/**
 * Museographic legibility audit (Phase 6 deliverable)
 * ───────────────────────────────────────────────────
 * Thin I/O wrapper around the pure core in `src/print/space/legibility.ts`. It reads
 * the two sources of truth from disk — the wall registry/geometry in
 * `event-layout.json` and every authored `public/prints/<id>/doc.json` — joins them
 * and writes the deliverable: a Markdown table + a CSV + a per-room coherence block,
 * plus a one-line summary on stdout. The audit logic is unit-tested in
 * `legibility.test.ts`; this file only does the file reads/writes a node-pure test
 * can't.
 *
 *   npm run legibility             # → out/legibility.md + out/legibility.csv
 *   npm run legibility -- --stdout   # also print the Markdown table to stdout
 */
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  buildLegibilityTable,
  formatLegibilityCsv,
  formatLegibilityMarkdown,
  isLegibilityCoherent,
  legibilityIssues,
  legibilitySummary,
  printLegibility,
  roomCoherence,
  summaryLine,
} from '../src/print/space/legibility.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_WALL_HEIGHT_M = 2.5

/** Read the wall registry + geometry from event-layout.json → LegibilityWall[]. */
function loadWalls() {
  const layout = JSON.parse(readFileSync(join(ROOT, 'src/print/space/event-layout.json'), 'utf8'))
  const walls = layout.elements.filter((e) => e.type === 'wall')
  return walls.map((e, i) => {
    const explicit = typeof e.alturaM === 'number' && Number.isFinite(e.alturaM) && e.alturaM > 0
    const registry =
      e.invId == null
        ? undefined
        : {
            invId: e.invId,
            sala: e.sala ?? '',
            tema: e.tema ?? '',
            rol: e.rol ?? '',
            track: e.track ?? 'C/I',
            research: e.research ?? false,
            estado: e.estado ?? 'pend',
          }
    return {
      id: `wall-${i}`,
      length: Math.max(e.w, e.h),
      height: explicit ? e.alturaM : DEFAULT_WALL_HEIGHT_M,
      hasExplicitHeight: explicit,
      registry,
    }
  })
}

/** Read every public/prints/<id>/doc.json → LegibilityPrint[] (wall prints only). */
function loadPrints() {
  const dir = join(ROOT, 'public/prints')
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    let doc
    try {
      doc = JSON.parse(readFileSync(join(dir, entry.name, 'doc.json'), 'utf8'))
    } catch {
      continue
    }
    const p = printLegibility(doc)
    if (p) out.push(p)
  }
  return out
}

function main() {
  const alsoStdout = process.argv.includes('--stdout')
  const walls = loadWalls()
  const prints = loadPrints()
  const rows = buildLegibilityTable(walls, prints)
  const summary = legibilitySummary(rows)
  const issues = legibilityIssues(rows)
  const rooms = roomCoherence(rows)

  const md = formatLegibilityMarkdown(rows)
  const csv = formatLegibilityCsv(rows)

  const roomBlock = [
    '## Coherencia por sala',
    '',
    '| sala | dist. lectura (m) | cap mín. (cm) | muros |',
    '| --- | --- | --- | --- |',
    ...rooms.map((r) => `| ${r.sala} | ${r.readingDistanceM.toFixed(1)} | ${r.minCapHeightCm.toFixed(1)} | ${r.invIds.join(', ')} |`),
  ].join('\n')

  const header = [
    '# Pase de legibilidad museográfica — AiKit Live wall graphics',
    '',
    `_${summaryLine(summary)} · coherente: ${isLegibilityCoherent(rows) ? 'sí' : 'no'}_`,
    '',
    'Estándares (`specs/wall-graphics.md`): centro de montaje **1.45–1.60 m**; ' +
      'altura de mayúscula ≈ **1 cm por cada 3 m** de distancia de lectura.',
    '',
  ].join('\n')

  const issuesBlock = issues.length
    ? `\n\n## Avisos\n\n${issues.map((r) => `- **#${r.invId} ${r.code}** (${r.sala}): ${r.issues.join('; ')}`).join('\n')}`
    : '\n\n_Sin avisos: todas las piezas impresas caen en (o se ajustan honestamente a) la banda y caben en su muro._'

  const mdDoc = `${header}${md}\n\n${roomBlock}${issuesBlock}\n`

  const outDir = join(ROOT, 'out')
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'legibility.md'), mdDoc)
  writeFileSync(join(outDir, 'legibility.csv'), `${csv}\n`)

  console.log(summaryLine(summary))
  console.log(`[OK] wrote out/legibility.md (${rows.length} muros) + out/legibility.csv`)
  if (issues.length) console.warn(`[WARN] ${issues.length} aviso(s): ${issues.map((r) => `#${r.invId}`).join(', ')}`)
  if (alsoStdout) console.log(`\n${md}\n\n${roomBlock}`)
}

main()
