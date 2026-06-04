import type { CalculateMetadataFunction } from 'remotion'
import { Fonts } from './fonts'
import { PrintStage } from '@/print/PrintRenderer'
import { buildGeometry, mediaSizePx } from '@/print/geometry'
import { getPrintPage } from '@/print/pages'
import { DISPLAY_FONT } from '@/lib/neumorphism'
import type { PrintDoc } from '@/print/types'

/**
 * PrintPage — the single generic Remotion composition behind every print.
 * ───────────────────────────────────────────────────────────────────────
 * It receives a `PrintDoc` as an input prop (the export script reads `doc.json`
 * and passes it in) and renders the page registered under `pageComponentId`
 * inside a <PrintStage>. `calculatePrintMetadata` sizes the composition to the
 * document's media (trim + bleed) in pixels at its DPI, so `renderStill` at
 * scale=1 yields the exact print size. Deterministic: a single frozen frame.
 */

/** Fallback shown in Studio / when no doc is supplied. Mirrors sample-a4/doc.json. */
const DEFAULT_DOC: PrintDoc = {
  id: 'sample-a4',
  title: 'Sample — A4 neumorphic poster',
  createdAt: '2026-05-31T00:00:00.000Z',
  pageComponentId: 'sample-a4',
  theme: 'light',
  dimensions: { trimWidthMm: 210, trimHeightMm: 297, bleedMm: 3, safeMarginMm: 10, cropMarks: true },
  dpi: 300,
  color: { mode: 'cmyk', iccProfile: 'icc/CoatedFOGRA39.icc', renderIntent: 'relative', pdfxVariant: 'x1a' },
  props: {},
}

export type PrintPageInput = {
  doc?: PrintDoc
  /** Preview-only trim/safe guides. Export passes false. */
  showGuides?: boolean
}

export const calculatePrintMetadata: CalculateMetadataFunction<PrintPageInput> = ({ props }) => {
  const doc = props.doc ?? DEFAULT_DOC
  const { width, height } = mediaSizePx(doc.dimensions, doc.dpi)
  return { width, height, durationInFrames: 1, fps: 1 }
}

export function PrintPageVideo({ doc = DEFAULT_DOC, showGuides = false }: PrintPageInput = {}) {
  const page = getPrintPage(doc.pageComponentId)
  const geo = buildGeometry(doc.dimensions, doc.dpi)
  return (
    <>
      <Fonts />
      <PrintStage doc={doc} showGuides={showGuides}>
        {page ? page({ doc, geo }) : <MissingPage id={doc.pageComponentId} />}
      </PrintStage>
    </>
  )
}

function MissingPage({ id }: { id: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: DISPLAY_FONT,
        fontSize: 48,
        color: '#ff2d55',
        textAlign: 'center',
        padding: 64,
      }}
    >
      Print page “{id}” is not registered in src/print/pages/index.ts
    </div>
  )
}
