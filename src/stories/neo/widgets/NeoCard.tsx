import type { CSSProperties, ReactNode } from 'react'
import { elevation, TEXT_FONT } from '@/lib/neumorphism'
import { useNeoTheme } from '../NeoTheme'

export type NeoCardProps = {
  /** Fixed width of the widget (px). Square by default via minHeight = width. */
  width?: number
  padding?: number
  radius?: number
  /** Center children both axes (the default widget layout). */
  center?: boolean
  children?: ReactNode
  style?: CSSProperties
}

/**
 * NeoCard — the rounded raised panel every widget sits on.
 * ────────────────────────────────────────────────────────
 * The shared container for the widget gallery. Soft, generous radius, lit by
 * the active NeoTheme.
 */
export function NeoCard({
  width = 260,
  padding = 28,
  radius = 34,
  center = true,
  children,
  style,
}: NeoCardProps) {
  const theme = useNeoTheme()
  const plate = elevation(theme, { depth: 'raised', distance: 10, blur: 22, radius })

  return (
    <div
      style={{
        width,
        boxSizing: 'border-box',
        padding,
        fontFamily: TEXT_FONT,
        color: theme.textStrong,
        display: 'flex',
        flexDirection: 'column',
        alignItems: center ? 'center' : 'stretch',
        justifyContent: 'center',
        gap: 18,
        ...plate,
        ...style,
      }}
    >
      {children}
    </div>
  )
}
