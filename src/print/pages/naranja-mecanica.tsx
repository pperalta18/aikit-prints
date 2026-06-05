import type { PrintPageProps } from '../types'

/**
 * naranja-mecanica — wall 13 (13-N-1, 6.5 × 2.5 m).
 * ──────────────────────────────────────────────────────────────────────────────
 * Cleared to a blank wall, pending a redesign. The previous layout — «La Naranja
 * Mecánica»: each game-asset (camión autónomo, fábrica oscura, flota robotaxi, red
 * de fábricas IA) paired with its real-world proof — lives in git history if it
 * needs to be recovered. When rebuilding, author in mm from the trim origin and
 * size type in points (`geo.mm` / `geo.pt`).
 */
export function NaranjaMecanica({ doc }: PrintPageProps) {
  return <div style={{ position: 'absolute', inset: 0, background: doc.surface ?? '#ffffff' }} />
}
