#!/usr/bin/env node
/**
 * Control table generator (Phase 6 deliverable)
 * ─────────────────────────────────────────────
 * Thin I/O wrapper around the pure core in `src/print/space/controlTable.ts`. It
 * reads the two sources of truth from disk — the wall registry/geometry in
 * `event-layout.json` and every authored `public/prints/<id>/doc.json` — joins them
 * and writes the deliverable: a Markdown table + a CSV, plus a one-line summary on
 * stdout. The join/format/summary logic is unit-tested in `controlTable.test.ts`;
 * this file only does the file reads/writes that a node-pure test can't.
 *
 *   npm run control-table            # → out/control-table.md + out/control-table.csv
 *   npm run control-table -- --stdout  # also print the Markdown table to stdout
 */
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  buildControlTable,
  controlTableSummary,
  docSummary,
  formatControlTableCsv,
  formatControlTableMarkdown,
  orphanPrintDocs,
  summaryLine,
} from '../src/print/space/controlTable.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_WALL_HEIGHT_M = 2.5

/** Read the wall registry + geometry from event-layout.json → ControlWall[]. */
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

/** Read every public/prints/<id>/doc.json → DocSummary[] (wall prints only). */
function loadDocs() {
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
    const s = docSummary(doc)
    if (s) out.push(s)
  }
  return out
}

function main() {
  const alsoStdout = process.argv.includes('--stdout')
  const walls = loadWalls()
  const docs = loadDocs()
  const rows = buildControlTable(walls, docs)
  const summary = controlTableSummary(rows)
  const orphans = orphanPrintDocs(walls, docs)

  const md = formatControlTableMarkdown(rows)
  const csv = formatControlTableCsv(rows)

  const header = [
    '# Tabla de control — AiKit Live wall graphics',
    '',
    `_${summaryLine(summary)}_`,
    '',
  ].join('\n')
  const orphanNote = orphans.length
    ? `\n\n> ⚠ Prints huérfanos (props.invId sin muro): ${orphans.map((o) => `${o.id}→${o.invId}`).join(', ')}`
    : ''
  const mdDoc = `${header}${md}${orphanNote}\n`

  const outDir = join(ROOT, 'out')
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'control-table.md'), mdDoc)
  writeFileSync(join(outDir, 'control-table.csv'), `${csv}\n`)

  console.log(summaryLine(summary))
  console.log(`[OK] wrote out/control-table.md (${rows.length} muros) + out/control-table.csv`)
  if (orphans.length) console.warn(`[WARN] ${orphans.length} print(s) huérfano(s): ${orphans.map((o) => o.id).join(', ')}`)
  if (alsoStdout) console.log(`\n${md}`)
}

main()
