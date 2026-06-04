import type { Plugin } from 'vite'
import { spawn } from 'node:child_process'
import { createReadStream, existsSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import path from 'node:path'

/**
 * aikit-prints dev plugin
 * ───────────────────────
 * The operator GUI runs under `npm run dev`. This plugin gives it the three
 * server-side things a browser can't do itself:
 *   GET  /api/prints                  list every public/prints/<id>/doc.json
 *   POST /api/export-print            run scripts/export-print.mjs for one doc
 *   GET  /api/prints-output/<file>    stream an exported file from out/prints/
 */

const ID_RE = /^[A-Za-z0-9_-]+$/
const FORMATS = new Set(['png', 'jpg', 'jpeg', 'pdf'])
const FILE_RE = /^[A-Za-z0-9_.-]+$/

export function printsPlugin(): Plugin {
  const root = process.cwd()
  const printsDir = path.join(root, 'public', 'prints')
  const outDir = path.join(root, 'out', 'prints')

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
