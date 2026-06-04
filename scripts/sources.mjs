#!/usr/bin/env node
/**
 * Sources deliverable generator (Phase 3 · Phase 6)
 * ─────────────────────────────────────────────────
 * Thin I/O wrapper around the pure core in `src/print/space/sources.ts`. The
 * researched figures live in the typed data file (`wall-data.ts`), so — unlike the
 * control-table / legibility scripts, which scan JSON on disk — this script imports
 * the data registries directly through the pure core and writes the deliverable: a
 * per-piece Markdown document (each piece's note + its `{ figure, value, date,
 * sourceURL }` table) + a flat CSV, plus a one-line summary on stdout. It also fails
 * loudly if any piece is missing its sources note (the Phase 6 confirmation). All of
 * the join / format / summary logic is unit-tested in `sources.test.ts`.
 *
 *   npm run sources             # → out/sources.md + out/sources.csv
 *   npm run sources -- --stdout   # also print the Markdown to stdout
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  buildSourcePieces,
  formatSourcesCsv,
  formatSourcesMarkdown,
  piecesMissingSourcesNote,
  sourcesSummary,
  summaryLine,
} from '../src/print/space/sources.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

function main() {
  const alsoStdout = process.argv.includes('--stdout')
  const pieces = buildSourcePieces()
  const summary = sourcesSummary(pieces)
  const missing = piecesMissingSourcesNote(pieces)

  const md = formatSourcesMarkdown(pieces)
  const csv = formatSourcesCsv(pieces)

  const header = [
    '# Notas de fuentes — AiKit Live wall graphics',
    '',
    `_${summaryLine(summary)}_`,
    '',
    'Cada pieza investigada lleva su **nota de fuentes** y la tabla `{ figura, valor, ' +
      'fecha, fuente }` que la respalda. Nada se imprime sin verificar ' +
      '(`specs/wall-graphics.md` · Methodology).',
    '',
  ].join('\n')

  const missingNote = missing.length
    ? `\n\n> ⚠ Piezas sin nota de fuentes: ${missing.map((p) => p.slug).join(', ')}`
    : '\n\n_Todas las piezas llevan su nota de fuentes._'

  const mdDoc = `${header}${md}${missingNote}\n`

  const outDir = join(ROOT, 'out')
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'sources.md'), mdDoc)
  writeFileSync(join(outDir, 'sources.csv'), `${csv}\n`)

  console.log(summaryLine(summary))
  console.log(`[OK] wrote out/sources.md (${pieces.length} piezas) + out/sources.csv`)
  if (missing.length) {
    console.warn(`[WARN] ${missing.length} pieza(s) sin nota: ${missing.map((p) => p.slug).join(', ')}`)
  }
  if (alsoStdout) console.log(`\n${md}`)
}

main()
