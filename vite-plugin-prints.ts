import type { Plugin } from 'vite'
import { spawn } from 'node:child_process'
import { createReadStream, existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'

/**
 * aikit-prints dev plugin
 * ───────────────────────
 * The operator GUI runs under `npm run dev`. This plugin gives it the three
 * server-side things a browser can't do itself:
 *   GET  /api/prints                  list every public/prints/<id>/doc.json
 *   POST /api/export-print            run scripts/export-print.mjs for one doc
 *   GET  /api/prints-output/<file>    stream an exported file from out/prints/
 *   POST /api/event-layout            save the movable furniture into event-layout.json
 */

const ID_RE = /^[A-Za-z0-9_-]+$/
const FORMATS = new Set(['png', 'jpg', 'jpeg', 'pdf'])
const FILE_RE = /^[A-Za-z0-9_.-]+$/
const FURNITURE_TYPES = new Set(['table', 'bar', 'plant'])

const isFiniteNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)

export function printsPlugin(): Plugin {
  const root = process.cwd()
  const printsDir = path.join(root, 'public', 'prints')
  const outDir = path.join(root, 'out', 'prints')
  const layoutPath = path.join(root, 'src', 'print', 'space', 'event-layout.json')

  const listDocs = () => {
    if (!existsSync(printsDir)) return []
    const docs: unknown[] = []
    for (const entry of readdirSync(printsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const docPath = path.join(printsDir, entry.name, 'doc.json')
      if (!existsSync(docPath)) continue
      try {
        const doc = JSON.parse(readFileSync(docPath, 'utf8'))
        docs.push({ ...doc, updatedAt: statSync(docPath).mtime.toISOString() })
      } catch {
        /* skip malformed */
      }
    }
    return docs
  }

  return {
    name: 'aikit-prints',
    // The 3D scene saves the venue layout (furniture + walls) by POSTing to the
    // endpoint below, which writes event-layout.json. That write would normally
    // trip Vite's watcher and reload the page mid-edit; suppress it — the scene
    // already holds the edited state, and a fresh load still reads the new file.
    handleHotUpdate(ctx) {
      if (ctx.file === layoutPath) return []
    },
    configureServer(server) {
      server.middlewares.use('/api/prints', (req, res, next) => {
        if (req.method !== 'GET') return next()
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(listDocs()))
      })

      server.middlewares.use('/api/export-print', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          return res.end('POST only')
        }
        let body = ''
        req.on('data', (c) => (body += c))
        req.on('end', () => {
          let p: Record<string, unknown> = {}
          try {
            p = JSON.parse(body || '{}')
          } catch {
            /* empty */
          }
          const id = String(p.id ?? '')
          const format = String(p.format ?? 'pdf')
          const dpi = p.dpi != null ? Number(p.dpi) : null
          const quality = p.quality != null ? Number(p.quality) : null
          const reply = (code: number, obj: unknown) => {
            res.statusCode = code
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(obj))
          }
          if (!ID_RE.test(id) || !FORMATS.has(format)) {
            return reply(400, { ok: false, log: 'invalid id or format' })
          }
          const args = ['scripts/export-print.mjs', id, '--format', format]
          if (dpi && dpi >= 30 && dpi <= 1200) args.push('--dpi', String(Math.round(dpi)))
          if (quality && quality >= 1 && quality <= 100) args.push('--quality', String(Math.round(quality)))
          const bleed = p.bleed != null ? Number(p.bleed) : null
          if (bleed != null && Number.isFinite(bleed) && bleed >= 0 && bleed <= 50) args.push('--bleed', String(bleed))
          if (typeof p.marks === 'boolean') args.push('--marks', p.marks ? 'true' : 'false')

          const child = spawn('node', args, { cwd: root })
          let log = ''
          child.stdout.on('data', (d) => (log += d))
          child.stderr.on('data', (d) => (log += d))
          const killer = setTimeout(() => child.kill('SIGKILL'), 240_000)
          child.on('close', (code) => {
            clearTimeout(killer)
            const ext = format === 'jpeg' ? 'jpg' : format
            reply(200, {
              ok: code === 0,
              code,
              log,
              output: code === 0 ? `/api/prints-output/${id}.${ext}` : null,
            })
          })
        })
      })

      server.middlewares.use('/api/delete-print', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          return res.end('POST only')
        }
        let body = ''
        req.on('data', (c) => (body += c))
        req.on('end', () => {
          let p: Record<string, unknown> = {}
          try {
            p = JSON.parse(body || '{}')
          } catch {
            /* empty */
          }
          const id = String(p.id ?? '')
          const reply = (code: number, obj: unknown) => {
            res.statusCode = code
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(obj))
          }
          if (!ID_RE.test(id)) return reply(400, { ok: false, error: 'invalid id' })
          const dir = path.join(printsDir, id)
          if (!dir.startsWith(printsDir + path.sep) || !existsSync(dir)) return reply(404, { ok: false, error: 'not found' })
          try {
            rmSync(dir, { recursive: true, force: true }) // the document (doc.json + assets)
            for (const ext of ['png', 'jpg', 'jpeg', 'pdf']) {
              const f = path.join(outDir, `${id}.${ext}`) // any exported artifacts
              if (existsSync(f)) rmSync(f, { force: true })
            }
            reply(200, { ok: true })
          } catch (e) {
            reply(500, { ok: false, error: String(e) })
          }
        })
      })

      // Persist the editable venue layout (movable furniture + walls) the 3D scene
      // edited back into event-layout.json. The client sends the full set for each
      // category it edited (`furniture` and/or `walls`); only those categories are
      // replaced — glass, spawn and the crowd `model` rows are preserved untouched,
      // and a category that's absent from the payload is left exactly as it was (so
      // a furniture-only auto-save never wipes the walls, and vice-versa).
      server.middlewares.use('/api/event-layout', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          return res.end('POST only')
        }
        let body = ''
        req.on('data', (c) => (body += c))
        req.on('end', () => {
          const reply = (code: number, obj: unknown) => {
            res.statusCode = code
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(obj))
          }
          let p: Record<string, unknown> = {}
          try {
            p = JSON.parse(body || '{}')
          } catch {
            return reply(400, { ok: false, error: 'bad json' })
          }
          const incomingFurn = Array.isArray(p.furniture) ? p.furniture : null
          const incomingWalls = Array.isArray(p.walls) ? p.walls : null
          if (!incomingFurn && !incomingWalls) return reply(400, { ok: false, error: 'furniture[] or walls[] required' })

          // A planner rectangle is required on every element; reject the whole save
          // on any bad value rather than silently writing a corrupt layout.
          const badRect = (e: Record<string, unknown>) =>
            !isFiniteNum(e.x) || !isFiniteNum(e.y) || !isFiniteNum(e.w) || !isFiniteNum(e.h) || (e.w as number) <= 0 || (e.h as number) <= 0

          const cleanFurn: Array<Record<string, number | string>> = []
          if (incomingFurn) {
            for (const raw of incomingFurn) {
              if (raw == null || typeof raw !== 'object') return reply(400, { ok: false, error: 'invalid furniture element' })
              const e = raw as Record<string, unknown>
              if (typeof e.type !== 'string' || !FURNITURE_TYPES.has(e.type)) return reply(400, { ok: false, error: `invalid furniture type ${String(e.type)}` })
              if (badRect(e)) return reply(400, { ok: false, error: 'invalid furniture rectangle' })
              const el: Record<string, number | string> = { type: e.type, x: e.x as number, y: e.y as number, w: e.w as number, h: e.h as number }
              if (isFiniteNum(e.alturaM) && e.alturaM > 0) el.alturaM = e.alturaM
              if (isFiniteNum(e.elevacionM) && e.elevacionM > 0) el.elevacionM = e.elevacionM
              if (isFiniteNum(e.rotation) && e.rotation !== 0) el.rotation = e.rotation
              cleanFurn.push(el)
            }
          }

          const cleanWalls: Array<Record<string, number | string | boolean>> = []
          if (incomingWalls) {
            for (const raw of incomingWalls) {
              if (raw == null || typeof raw !== 'object') return reply(400, { ok: false, error: 'invalid wall element' })
              const e = raw as Record<string, unknown>
              if (e.type !== 'wall') return reply(400, { ok: false, error: `invalid wall type ${String(e.type)}` })
              if (badRect(e)) return reply(400, { ok: false, error: 'invalid wall rectangle' })
              const el: Record<string, number | string | boolean> = { type: 'wall', x: e.x as number, y: e.y as number, w: e.w as number, h: e.h as number }
              if (isFiniteNum(e.alturaM) && e.alturaM > 0) el.alturaM = e.alturaM
              if (isFiniteNum(e.rotation) && e.rotation !== 0) el.rotation = e.rotation
              if (typeof e.wallId === 'string' && e.wallId) el.wallId = e.wallId
              // Carry an inventory registry through untouched when present (catalogue walls).
              if (isFiniteNum(e.invId)) el.invId = e.invId
              for (const k of ['sala', 'tema', 'rol', 'track', 'estado'] as const) {
                if (typeof e[k] === 'string') el[k] = e[k] as string
              }
              if (typeof e.research === 'boolean') el.research = e.research
              cleanWalls.push(el)
            }
          }

          let layout: { elements: Array<Record<string, unknown>>; wallHeight?: number }
          try {
            layout = JSON.parse(readFileSync(layoutPath, 'utf8'))
          } catch (err) {
            return reply(500, { ok: false, error: `cannot read layout: ${String(err)}` })
          }
          // The single global wall height lives at the layout root (not per wall).
          if (isFiniteNum(p.wallHeight) && p.wallHeight > 0) layout.wallHeight = p.wallHeight
          const elements = Array.isArray(layout.elements) ? layout.elements : []
          // Only the categories actually sent are replaced; the rest pass through.
          const isReplaced = (el: Record<string, unknown>) =>
            typeof el.type === 'string' &&
            ((incomingFurn != null && FURNITURE_TYPES.has(el.type)) || (incomingWalls != null && el.type === 'wall'))
          const firstIdx = elements.findIndex(isReplaced)
          const kept = elements.filter((el) => !isReplaced(el))
          // Splice the rebuilt block back where the first replaced element sat, so the
          // surviving elements keep their relative order and the diff stays local.
          const insertAt = firstIdx === -1 ? kept.length : elements.slice(0, firstIdx).filter((el) => !isReplaced(el)).length
          const block = [...cleanWalls, ...cleanFurn]
          const next = [...kept.slice(0, insertAt), ...block, ...kept.slice(insertAt)]

          try {
            writeFileSync(layoutPath, JSON.stringify({ ...layout, elements: next }, null, 2) + '\n')
          } catch (err) {
            return reply(500, { ok: false, error: `cannot write layout: ${String(err)}` })
          }
          reply(200, { ok: true, furniture: cleanFurn.length, walls: cleanWalls.length })
        })
      })

      server.middlewares.use('/api/prints-output', (req, res, next) => {
        if (req.method !== 'GET') return next()
        const rel = decodeURIComponent((req.url || '').replace(/^\//, '').split('?')[0])
        if (!FILE_RE.test(rel)) {
          res.statusCode = 400
          return res.end('bad name')
        }
        const file = path.join(outDir, rel)
        if (!file.startsWith(outDir) || !existsSync(file)) {
          res.statusCode = 404
          return res.end('not found')
        }
        const ext = path.extname(file).toLowerCase()
        const type =
          ext === '.pdf' ? 'application/pdf' : ext === '.png' ? 'image/png' : ext === '.jpg' ? 'image/jpeg' : 'application/octet-stream'
        res.setHeader('Content-Type', type)
        createReadStream(file).pipe(res)
      })
    },
  }
}
