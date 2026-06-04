import { createContext, useContext, type ReactNode } from 'react'
import { lightTheme, type LightSource, type NeoTheme } from '@/lib/neumorphism'

/**
 * NeoThemeContext
 * ───────────────
 * Lets the Storybook toolbar (theme + light source globals) re-light every
 * neumorphic component at once, without threading props through each story.
 * Components read the active theme with `useNeoTheme()`.
 */
const NeoThemeContext = createContext<NeoTheme>(lightTheme)

export function useNeoTheme(): NeoTheme {
  return useContext(NeoThemeContext)
}

export function NeoThemeProvider({
  theme,
  lightSource,
  intensity,
  children,
}: {
  theme: NeoTheme
  lightSource?: LightSource
  /** Override the theme's relief strength (shadow distance + blur multiplier). */
  intensity?: number
  children: ReactNode
}) {
  const lit: NeoTheme = {
    ...theme,
    ...(lightSource ? { lightSource } : null),
    ...(intensity != null ? { intensity } : null),
  }
  return <NeoThemeContext.Provider value={lit}>{children}</NeoThemeContext.Provider>
}
