#!/usr/bin/env node
/**
 * Coverage & spoiler-lint generator (Phase 6 deliverable)
 * ───────────────────────────────────────────────────────
 * Thin I/O wrapper around the pure core in `src/print/space/coverage.ts`. It reads
 * the wall registry from `event-layout.json`, runs the two non-negotiable QA passes
 * — **no blank walls** (a hard guard) and the **spoiler / museographic lint** (S1
 * textless + no funnel jump) — and writes the deliverable: a Markdown table + a CSV,
 * plus a one-line summary on stdout. The pass/lint/format logic is unit-tested in
 * `coverage.test.ts`; this file only does the file reads/writes a node-pure test can't.
 *
 *   npm run coverage              # → out/coverage.md + out/coverage.csv
 *   npm run coverage -- --stdout  # also print the Markdown table to stdout
 *
 * Exit code 1 if any wall is blank (the principle is non-negotiable); spoiler-lint
 * warnings are reported but do not fail the build (a museographic review flag).
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  assertNoBlankWalls,
  buildCoverage,
  coverageSummary,
  formatCoverageCsv,
  formatCoverageMarkdown,
  funnelCoverage,
  spoilerRisks,
  summaryLine,
} from '../src/print/space/coverage.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Read the wall registry from event-layout.json → CoverageWall[]. */
function loadWalls() {
  const layout = JSON.parse(readFileSync(join(ROOT, 'src/print/space/event-layout.json'), 'utf8'))
  const walls = layout.elements.filter((e) => e.type === 'wall')
  return walls.map((e, i) => ({
    id: `wall-${i}`,
    registry:
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
          },
  }))
}

function main() {
  const alsoStdout = process.argv.includes('--stdout')
  const walls = loadWalls()
  const rows = buildCoverage(walls)
  const summary = coverageSummary(rows)
  const warnings = spoilerRisks(rows)
  const cov = funnelCoverage(rows)

  const md = formatCoverageMarkdown(rows)
  const csv = formatCoverageCsv(rows)

  const funnelLine = Object.entries(cov)
    .map(([room, ids]) => `${room}: ${ids.length ? ids.map((n) => `#${n}`).join(' ') : '∅'}`)
    .join(' · ')

  const header = [
    '# Cobertura y spoilers — AiKit Live wall graphics',
    '',
    `_${summaryLine(summary)}_`,
    '',
    `**Recorrido (funnel):** ${funnelLine}`,
    '',
  ].join('\n')
  const warnNote = warnings.length
    ? `\n\n> ⚠ Para revisión: ${warnings.map((w) => `#${w.invId} (${w.concerns.join('; ')})`).join(' · ')}`
    : ''
  const mdDoc = `${header}${md}${warnNote}\n`

  const outDir = join(ROOT, 'out')
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'coverage.md'), mdDoc)
  writeFileSync(join(outDir, 'coverage.csv'), `${csv}\n`)

  // "No blank walls" is non-negotiable → fail loudly if any wall lacks a piece.
  assertNoBlankWalls(rows)

  console.log(summaryLine(summary))
  console.log(`[OK] wrote out/coverage.md (${rows.length} muros) + out/coverage.csv`)
  if (warnings.length) {
    console.warn(`[WARN] ${warnings.length} muro(s) para revisión museográfica: ${warnings.map((w) => `#${w.invId}`).join(', ')}`)
  }
  if (alsoStdout) console.log(`\n${md}`)
}

main()
