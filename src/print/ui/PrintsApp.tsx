import { Component, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { KIT_BLUE } from '@/lib/neumorphism'
import { PrintStage } from '../PrintRenderer'
import { buildGeometry } from '../geometry'
import { getPrintPage } from '../pages'
import { PrintScaleScene } from './PrintScaleScene'
import { EventSpaceScene } from './EventSpaceScene'
import type { PrintDoc } from '../types'

/**
 * PrintsApp — the operator GUI (the only UI a human touches).
 * ───────────────────────────────────────────────────────────
 *   · an INDEX of every print (live previews),
 *   · a per-print viewport with zoom + fit-to-window (for very wide pieces),
 *   · an EXPORT panel (PDF CMYK / PNG / JPG, DPI, quality) wired to the dev plugin.
 * The page content itself is authored in code (src/print/pages/); this just lists,
 * previews and exports.
 */

const SHELL_BG = '#0d0f13'
const PANEL_BG = '#15181e'
const BORDER = '1px solid rgba(255,255,255,0.10)'
const UI_FONT = 'system-ui, -apple-system, sans-serif'

export function PrintsApp() {
  const [docs, setDocs] = useState<PrintDoc[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showSpace, setShowSpace] = useState(false)

  const reload = useCallback(() => {
    fetch('/api/prints')
      .then((r) => r.json())
      .then((d: PrintDoc[]) => setDocs(d))
      .catch((e) => setError(`No se pudo leer /api/prints — ¿estás en \`npm run dev\`? (${e})`))
  }, [])

  useEffect(reload, [reload])

  const deletePrint = useCallback(
    async (doc: PrintDoc) => {
      if (!window.confirm(`¿Eliminar “${doc.title}”?\n\nSe borrará public/prints/${doc.id}/ y sus exportaciones en out/prints/. No se puede deshacer.`)) return
      try {
        const res = await fetch('/api/delete-print', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: doc.id }),
        })
        if (!res.ok) throw new Error(await res.text())
        setSelectedId((cur) => (cur === doc.id ? null : cur))
        reload()
      } catch (e) {
        window.alert(`No se pudo eliminar: ${e}`)
      }
    },
    [reload],
  )

  const selected = docs?.find((d) => d.id === selectedId) ?? null
  if (showSpace && docs) return <EventSpaceScene docs={docs} onBack={() => setShowSpace(false)} />
  if (selected) return <PrintDetail doc={selected} onBack={() => setSelectedId(null)} />
  return <PrintIndex docs={docs} error={error} onOpen={setSelectedId} onDelete={deletePrint} onReload={reload} onOpenSpace={() => setShowSpace(true)} />
}

/* ── live page render (browser; fonts come from index.css) ─────────────────── */

function LivePrintPage({ doc, showGuides = false }: { doc: PrintDoc; showGuides?: boolean }) {
  const page = getPrintPage(doc.pageComponentId)
  const geo = buildGeometry(doc.dimensions, doc.dpi)
  return (
    <PreviewBoundary>
      <PrintStage doc={doc} showGuides={showGuides}>
        {page ? (
          page({ doc, geo })
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#ff2d55', fontSize: geo.pt(20), textAlign: 'center', padding: geo.mm(10) }}>
            Falta registrar la página “{doc.pageComponentId}”
          </div>
        )}
      </PrintStage>
    </PreviewBoundary>
  )
}

/**
 * PreviewBoundary — keeps one broken page from blanking the whole index. A page
 * that throws while previewing (e.g. a widget that needs a context the live
 * browser doesn't provide) is contained to its own card/viewport, which shows a
 * fallback instead. The export pipeline (renderStill) is unaffected.
 */
class PreviewBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    if (this.state.failed) {
      return (
        <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', background: '#1a0e12', color: '#ff6b7d', fontFamily: UI_FONT, fontSize: 'clamp(11px, 6vw, 40px)', fontWeight: 600, textAlign: 'center', padding: 16 }}>
          Vista previa no disponible
        </div>
      )
    }
    return this.props.children
  }
}

const fmtMm = (d: PrintDoc) => `${trim(d.dimensions.trimWidthMm)} × ${trim(d.dimensions.trimHeightMm)} mm`
const trim = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

/* ── index ─────────────────────────────────────────────────────────────────── */

function PrintIndex({
  docs,
  error,
  onOpen,
  onDelete,
  onReload,
  onOpenSpace,
}: {
  docs: PrintDoc[] | null
  error: string | null
  onOpen: (id: string) => void
  onDelete: (doc: PrintDoc) => void
  onReload: () => void
  onOpenSpace: () => void
}) {
  return (
    <div style={{ minHeight: '100vh', background: SHELL_BG, color: '#e8e8f0', fontFamily: UI_FONT, padding: '40px 32px 80px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: -0.5 }}>Prints</h1>
        <span style={{ fontSize: 13, color: '#7c8190', fontWeight: 600 }}>{docs ? `${docs.length} documento${docs.length === 1 ? '' : 's'}` : '…'}</span>
        <div style={{ flex: 1 }} />
        <button onClick={onOpenSpace} style={{ ...ghostBtn, borderColor: KIT_BLUE, color: '#fff', background: KIT_BLUE }}>🏛 Espacio del evento</button>
        <button onClick={onReload} style={ghostBtn}>↻ recargar</button>
      </div>

      {error && <div style={{ color: '#ff6b7d', fontSize: 14, marginBottom: 20 }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, ${THUMB_W}px)`, justifyContent: 'start', gap: 22 }}>
        {docs?.map((doc) => (
          <IndexCard key={doc.id} doc={doc} onOpen={() => onOpen(doc.id)} onDelete={() => onDelete(doc)} />
        ))}
        {docs && docs.length === 0 && (
          <div style={{ color: '#7c8190', fontSize: 14 }}>
            No hay prints todavía. Crea uno: una página en <code>src/print/pages/</code> + su{' '}
            <code>public/prints/&lt;id&gt;/doc.json</code>.
          </div>
        )}
      </div>
    </div>
  )
}

/* Every card is the same size: a fixed preview box holds each print *contained*
   (fitted + centred on a neutral backdrop), so wildly different aspect ratios —
   a 55×85 mm badge vs a 460×1150 mm banner — read as one uniform grid. */
const THUMB_W = 240
const PREVIEW_H = 200
const PREVIEW_PAD = 18

function IndexCard({ doc, onOpen, onDelete }: { doc: PrintDoc; onOpen: () => void; onDelete: () => void }) {
  const [hover, setHover] = useState(false)
  const geo = buildGeometry(doc.dimensions, doc.dpi)

  // Contain: scale the page down to fit the padded preview box, keeping its ratio.
  const innerW = THUMB_W - PREVIEW_PAD * 2
  const innerH = PREVIEW_H - PREVIEW_PAD * 2
  const scale = Math.min(innerW / geo.mediaWidthPx, innerH / geo.mediaHeightPx)
  const pageW = geo.mediaWidthPx * scale
  const pageH = geo.mediaHeightPx * scale

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...cardBtn,
        width: THUMB_W,
        padding: 0,
        position: 'relative',
        borderColor: hover ? KIT_BLUE : 'rgba(255,255,255,0.10)',
        transform: hover ? 'translateY(-2px)' : 'none',
        boxShadow: hover ? '0 10px 30px rgba(0,0,0,0.40)' : 'none',
        transition: 'transform .14s ease, box-shadow .14s ease, border-color .14s ease',
      }}
    >
      <DeleteButton onClick={onDelete} visible={hover} />
      <div onClick={onOpen} style={{ cursor: 'pointer' }}>
        {/* fixed-height preview — page centred + shadowed so light AND dark sheets read */}
        <div
          style={{
            width: THUMB_W,
            height: PREVIEW_H,
            display: 'grid',
            placeItems: 'center',
            overflow: 'hidden',
            background: '#23262e',
            borderTopLeftRadius: 14,
            borderTopRightRadius: 14,
          }}
        >
          <div style={{ width: pageW, height: pageH, boxShadow: '0 4px 18px rgba(0,0,0,0.45)', outline: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ width: geo.mediaWidthPx, height: geo.mediaHeightPx, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
              <LivePrintPage doc={doc} />
            </div>
          </div>
        </div>
        <div style={{ padding: '12px 14px 14px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.title}</div>
          <div style={{ fontSize: 12, color: '#7c8190' }}>
            {fmtMm(doc)} · {doc.dpi} ppp · {doc.color.mode.toUpperCase()}
          </div>
        </div>
      </div>
    </div>
  )
}

function DeleteButton({ onClick, visible }: { onClick: () => void; visible: boolean }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick() }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title="Eliminar print"
      aria-label="Eliminar print"
      style={{
        position: 'absolute', top: 8, right: 8, zIndex: 2, width: 30, height: 30, borderRadius: 9,
        border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer', display: 'grid', placeItems: 'center',
        padding: 0, background: hover ? '#ff2d55' : 'rgba(13,15,19,0.72)', backdropFilter: 'blur(6px)',
        opacity: visible || hover ? 1 : 0, transition: 'opacity .14s ease, background .12s ease',
      }}
    >
      <TrashIcon color={hover ? '#fff' : '#c9cdd6'} />
    </button>
  )
}

function TrashIcon({ color }: { color: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  )
}

/* ── detail: viewport (zoom/fit) + export panel ───────────────────────────── */

function PrintDetail({ doc, onBack }: { doc: PrintDoc; onBack: () => void }) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState<number | null>(null) // media-px → screen-px
  const [showGuides, setShowGuides] = useState(true)
  const [view3d, setView3d] = useState(false) // 2D preview ↔ true-scale 3D scene
  // Bleed + crop marks are tweakable at export time and reflected live in the preview.
  const [bleedMm, setBleedMm] = useState(doc.dimensions.bleedMm)
  const [cropMarks, setCropMarks] = useState(doc.dimensions.cropMarks)
  const effDoc = useMemo(
    () => ({ ...doc, dimensions: { ...doc.dimensions, bleedMm, cropMarks } }),
    [doc, bleedMm, cropMarks],
  )
  const geo = buildGeometry(effDoc.dimensions, effDoc.dpi)

  const fit = useCallback(() => {
    const el = viewportRef.current
    if (!el) return
    const pad = 48
    const z = Math.min((el.clientWidth - pad) / geo.mediaWidthPx, (el.clientHeight - pad) / geo.mediaHeightPx)
    setZoom(Math.max(0.02, z))
  }, [geo.mediaWidthPx, geo.mediaHeightPx])

  useLayoutEffect(() => {
    fit()
    const onResize = () => fit()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [fit])

  const z = zoom ?? 0.1
  const pct = Math.round(z * 100)

  return (
    <div style={{ display: 'flex', height: '100vh', background: SHELL_BG, color: '#e8e8f0', fontFamily: UI_FONT }}>
      {/* viewport */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: BORDER }}>
          <button onClick={onBack} style={ghostBtn}>◀ índice</button>
          <span style={{ fontSize: 14, fontWeight: 700 }}>{doc.title}</span>
          <span style={{ fontSize: 12, color: '#7c8190' }}>{fmtMm(doc)} · {doc.dpi} ppp</span>
          <div style={{ flex: 1 }} />
          {!view3d && (
            <>
              <button onClick={() => setZoom(z * 0.8)} style={ghostBtn}>−</button>
              <span style={{ fontSize: 12, width: 46, textAlign: 'center', color: '#a7adba' }}>{pct}%</span>
              <button onClick={() => setZoom(z * 1.25)} style={ghostBtn}>+</button>
              <button onClick={fit} style={ghostBtn}>ajustar</button>
              <span style={{ width: 1, alignSelf: 'stretch', background: 'rgba(255,255,255,0.1)' }} />
              <button onClick={() => setShowGuides((g) => !g)} style={{ ...ghostBtn, color: showGuides ? KIT_BLUE : '#a7adba' }}>guías</button>
              <span style={{ width: 1, alignSelf: 'stretch', background: 'rgba(255,255,255,0.1)' }} />
            </>
          )}
          <button onClick={() => setView3d((v) => !v)} style={{ ...ghostBtn, color: view3d ? KIT_BLUE : '#a7adba' }}>escena 3D</button>
        </div>

        {view3d ? (
          <div style={{ flex: 1, position: 'relative', background: '#15171d' }}>
            <PrintScaleScene doc={effDoc} />
          </div>
        ) : (
          <div ref={viewportRef} style={{ flex: 1, overflow: 'auto', background: '#23262e', display: 'grid', placeItems: 'center', padding: 24 }}>
            <div
              style={{
                width: geo.mediaWidthPx * z,
                height: geo.mediaHeightPx * z,
                flex: 'none',
                boxShadow: '0 12px 48px rgba(0,0,0,0.5)',
              }}
            >
              <div style={{ width: geo.mediaWidthPx, height: geo.mediaHeightPx, transform: `scale(${z})`, transformOrigin: 'top left' }}>
                <LivePrintPage doc={effDoc} showGuides={showGuides} />
              </div>
            </div>
          </div>
        )}
      </div>

      <ExportPanel doc={effDoc} onBleed={setBleedMm} onMarks={setCropMarks} />
    </div>
  )
}

/* ── export panel ──────────────────────────────────────────────────────────── */

type ExportStatus = 'idle' | 'running' | 'saving' | 'ok' | 'error'
type ExportState = { status: ExportStatus; log: string; output: string | null; savedTo?: string | null }

const EXT = { pdf: 'pdf', png: 'png', jpg: 'jpg' } as const
const PICKER_TYPES = {
  pdf: { description: 'PDF', accept: { 'application/pdf': ['.pdf'] } },
  png: { description: 'PNG', accept: { 'image/png': ['.png'] } },
  jpg: { description: 'JPEG', accept: { 'image/jpeg': ['.jpg', '.jpeg'] } },
} as const

function ExportPanel({ doc, onBleed, onMarks }: { doc: PrintDoc; onBleed: (mm: number) => void; onMarks: (on: boolean) => void }) {
  const [format, setFormat] = useState<'pdf' | 'png' | 'jpg'>('pdf')
  const [dpi, setDpi] = useState(doc.dpi)
  const [quality, setQuality] = useState(92)
  const [ex, setEx] = useState<ExportState>({ status: 'idle', log: '', output: null })

  const runExport = async () => {
    const suggestedName = `${doc.id}.${EXT[format]}`

    // Ask the OS where to save FIRST: the native save panel must open while the
    // click is still a live user gesture (a File System Access API requirement).
    const pickSave = (window as unknown as {
      showSaveFilePicker?: (o: unknown) => Promise<FileSystemFileHandle>
    }).showSaveFilePicker
    let handle: FileSystemFileHandle | null = null
    if (pickSave) {
      try {
        handle = await pickSave({ suggestedName, types: [PICKER_TYPES[format]] })
      } catch (e) {
        if ((e as DOMException)?.name === 'AbortError') return // user cancelled the dialog
        handle = null // not allowed in this context → fall back to a normal download
      }
    }

    setEx({ status: 'running', log: 'Renderizando y exportando… (el primer bundle tarda)', output: null })
    try {
      const res = await fetch('/api/export-print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: doc.id, format, dpi, quality, bleed: doc.dimensions.bleedMm, marks: doc.dimensions.cropMarks }),
      })
      const data = await res.json()
      if (!data.ok || !data.output) {
        setEx({ status: 'error', log: data.log ?? '', output: data.output ?? null })
        return
      }

      // Pull the rendered file and write it to wherever the user chose.
      setEx({ status: 'saving', log: data.log ?? '', output: data.output })
      const blob = await (await fetch(data.output)).blob()
      if (handle) {
        const writable = await handle.createWritable()
        await writable.write(blob)
        await writable.close()
        setEx({ status: 'ok', log: data.log ?? '', output: data.output, savedTo: handle.name })
      } else {
        downloadBlob(blob, suggestedName) // browsers without the native picker (Safari/Firefox)
        setEx({ status: 'ok', log: data.log ?? '', output: data.output, savedTo: suggestedName })
      }
    } catch (e) {
      setEx({ status: 'error', log: String(e), output: null })
    }
  }

  return (
    <aside style={{ width: 320, flex: 'none', background: PANEL_BG, borderLeft: BORDER, padding: 20, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, letterSpacing: 0.3 }}>Exportar</h2>

      <Field label="Formato">
        <div style={{ display: 'flex', gap: 8 }}>
          {(['pdf', 'png', 'jpg'] as const).map((f) => (
            <button key={f} onClick={() => setFormat(f)} style={{ ...segBtn, ...(format === f ? segActive : null) }}>
              {f.toUpperCase()}
            </button>
          ))}
        </div>
        <p style={{ margin: '6px 0 0', fontSize: 11, color: '#7c8190', lineHeight: 1.4 }}>
          {format === 'pdf'
            ? `CMYK PDF/X (${doc.color.pdfxVariant.toUpperCase()}) · ICC ${doc.color.iccProfile.split('/').pop()}`
            : format === 'png'
              ? 'PNG sRGB sin pérdida'
              : 'JPEG sRGB'}
        </p>
      </Field>

      <Field label={`Resolución — ${dpi} ppp`}>
        <input type="range" min={72} max={600} step={1} value={dpi} onChange={(e) => setDpi(Number(e.target.value))} style={{ width: '100%' }} />
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          {[150, 300, 600].map((d) => (
            <button key={d} onClick={() => setDpi(d)} style={{ ...chip, ...(dpi === d ? segActive : null) }}>{d}</button>
          ))}
        </div>
      </Field>

      {format === 'jpg' && (
        <Field label={`Calidad JPG — ${quality}`}>
          <input type="range" min={50} max={100} step={1} value={quality} onChange={(e) => setQuality(Number(e.target.value))} style={{ width: '100%' }} />
        </Field>
      )}

      <div style={{ borderTop: BORDER, paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <Field label={`Sangrado — ${trim(doc.dimensions.bleedMm)} mm`}>
          <input type="range" min={0} max={10} step={0.5} value={doc.dimensions.bleedMm} onChange={(e) => onBleed(Number(e.target.value))} style={{ width: '100%' }} />
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            {[0, 3, 5].map((b) => (
              <button key={b} onClick={() => onBleed(b)} style={{ ...chip, ...(doc.dimensions.bleedMm === b ? segActive : null) }}>{b} mm</button>
            ))}
          </div>
        </Field>

        <Field label="Marcas de corte">
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => onMarks(true)} style={{ ...segBtn, ...(doc.dimensions.cropMarks ? segActive : null) }}>Sí</button>
            <button onClick={() => onMarks(false)} style={{ ...segBtn, ...(!doc.dimensions.cropMarks ? segActive : null) }}>No</button>
          </div>
          {doc.dimensions.cropMarks && doc.dimensions.bleedMm < 3 && (
            <p style={{ margin: '6px 0 0', fontSize: 11, color: '#e0a23a', lineHeight: 1.4 }}>Las marcas necesitan ≥3 mm de sangrado para verse.</p>
          )}
          <p style={{ margin: '6px 0 0', fontSize: 11, color: '#7c8190', lineHeight: 1.4 }}>Margen seguro {trim(doc.dimensions.safeMarginMm)} mm (fijo en el documento).</p>
        </Field>
      </div>

      {(() => {
        const busy = ex.status === 'running' || ex.status === 'saving'
        return (
          <button onClick={runExport} disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }}>
            {ex.status === 'running' ? 'Exportando…' : ex.status === 'saving' ? 'Guardando…' : `Exportar ${format.toUpperCase()}…`}
          </button>
        )
      })()}

      {ex.status !== 'idle' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ex.status === 'ok' && ex.savedTo && (
            <div style={{ color: '#2ada56', fontSize: 12, fontWeight: 700 }}>Guardado: {ex.savedTo}</div>
          )}
          {ex.status === 'ok' && ex.output && (
            <a href={ex.output} target="_blank" rel="noreferrer" style={{ ...primaryBtn, background: '#2ada56', color: '#062b12', textDecoration: 'none', textAlign: 'center' }}>
              Abrir resultado ↗
            </a>
          )}
          {ex.status === 'error' && <div style={{ color: '#ff6b7d', fontSize: 12, fontWeight: 600 }}>Falló la exportación</div>}
          <pre style={{ margin: 0, maxHeight: 220, overflow: 'auto', background: '#0c0e12', borderRadius: 8, padding: 10, fontSize: 11, lineHeight: 1.45, color: '#9aa0ac', whiteSpace: 'pre-wrap' }}>
            {ex.log}
          </pre>
        </div>
      )}
    </aside>
  )
}

/** Fallback for browsers without showSaveFilePicker (Safari/Firefox): a plain download. */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#a7adba', marginBottom: 8 }}>{label}</div>
      {children}
    </label>
  )
}

/* ── shared button styles ──────────────────────────────────────────────────── */

const ghostBtn: React.CSSProperties = {
  padding: '6px 11px', borderRadius: 8, border: BORDER, cursor: 'pointer',
  background: 'rgba(255,255,255,0.05)', color: '#c9cdd6', fontSize: 13, fontWeight: 600, fontFamily: UI_FONT,
}
const cardBtn: React.CSSProperties = {
  border: BORDER, borderRadius: 14, background: PANEL_BG, cursor: 'pointer', overflow: 'hidden', color: '#e8e8f0',
}
const segBtn: React.CSSProperties = {
  flex: 1, padding: '8px 0', borderRadius: 8, border: BORDER, cursor: 'pointer',
  background: 'rgba(255,255,255,0.05)', color: '#c9cdd6', fontSize: 12, fontWeight: 700, fontFamily: UI_FONT,
}
const segActive: React.CSSProperties = { background: KIT_BLUE, color: '#fff', borderColor: KIT_BLUE }
const chip: React.CSSProperties = {
  padding: '5px 10px', borderRadius: 7, border: BORDER, cursor: 'pointer',
  background: 'rgba(255,255,255,0.05)', color: '#c9cdd6', fontSize: 12, fontWeight: 600, fontFamily: UI_FONT,
}
const primaryBtn: React.CSSProperties = {
  padding: '11px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
  background: KIT_BLUE, color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: UI_FONT,
}
