import type { CSSProperties } from 'react'
import { KIT_BLUE } from '@/lib/neumorphism'

/**
 * AikitLogo — the official AiKit lockup (blue symbol + "Aikit" wordmark) as an
 * inline, resolution-independent SVG. Single source of truth for the brand mark
 * across the app, Storybook, Remotion scenes and prints. Source files also live at
 * `public/brand/Logo-aikit.svg` (light) and `public/brand/Logo-aikitdark.svg` (dark).
 *
 *   <AikitLogo height={32} />              ink wordmark, for light backgrounds
 *   <AikitLogo height={32} tone="dark" />  white wordmark, for dark backgrounds
 *   <AikitLogo height={32} variant="mark" /> just the blue symbol (e.g. an avatar)
 */

const ASPECT = 360 / 76 // full lockup viewBox aspect ratio
const MARK_ASPECT = 100 / 76 // symbol-only viewBox aspect ratio

export type AikitLogoProps = {
  /** Rendered height in px; width follows the aspect for the chosen `variant`. */
  height?: number
  /** `lockup` = symbol + "Aikit" wordmark · `mark` = the symbol on its own. */
  variant?: 'lockup' | 'mark'
  /** `light` = ink wordmark (#1E1E20) for light bg · `dark` = white (#FDFDFD) for dark bg. */
  tone?: 'light' | 'dark'
  /** Override the symbol colour (default KIT_BLUE). */
  markColor?: string
  /** Override the wordmark colour (else derived from `tone`). */
  wordmarkColor?: string
  title?: string
  style?: CSSProperties
}

export function AikitLogo({
  height = 32,
  variant = 'lockup',
  tone = 'light',
  markColor = KIT_BLUE,
  wordmarkColor,
  title = 'Aikit',
  style,
}: AikitLogoProps) {
  const word = wordmarkColor ?? (tone === 'dark' ? '#FDFDFD' : '#1E1E20')
  const isMark = variant === 'mark'
  return (
    <svg
      height={height}
      width={height * (isMark ? MARK_ASPECT : ASPECT)}
      viewBox={isMark ? '0 0 100 76' : '0 0 360 76'}
      fill="none"
      role="img"
      aria-label={title}
      style={{ display: 'block', ...style }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* symbol */}
      <path
        d="M96.983 0C97.8313 0 98.2943 0.989819 97.7505 1.64096L41.8396 68.5964C38.7997 72.2369 34.3013 74.3411 29.5584 74.3411H1.38742C0.704867 74.3411 0.222897 73.6724 0.438739 73.0248L16.6053 24.5249C21.4591 9.96324 35.2543 0 50.5823 0H96.983Z"
        fill={markColor}
      />
      <path
        d="M99.1213 27.7714C99.1213 26.8112 97.8996 26.4029 97.3222 27.1701L63.0283 72.739C62.5324 73.398 63.0025 74.3403 63.8273 74.3403H80.2168C90.6909 74.3403 99.1213 65.9099 99.1213 55.4357V27.7714Z"
        fill={markColor}
      />
      {/* wordmark "Aikit" — omitted for the mark-only variant */}
      {!isMark && (
        <>
          <path
            d="M150.492 74.3411C150.919 74.3411 151.299 74.0702 151.438 73.6666L157.425 56.2767C157.563 55.8731 157.943 55.6022 158.37 55.6022H190.12C190.547 55.6022 190.927 55.8731 191.066 56.2767L197.053 73.6666C197.192 74.0702 197.571 74.3411 197.998 74.3411H207.553C208.24 74.3411 208.723 73.6629 208.497 73.0132L183.387 0.672083C183.247 0.269741 182.868 0 182.442 0H165.744C165.316 0 164.936 0.271437 164.798 0.675576L139.986 73.0167C139.764 73.6657 140.246 74.3411 140.932 74.3411H150.492ZM172.786 11.1234C172.924 10.7176 173.305 10.4446 173.733 10.4446H174.45C174.878 10.4446 175.259 10.7176 175.397 11.1234L186.699 44.4508C186.919 45.0993 186.437 45.772 185.752 45.772H162.431C161.746 45.772 161.264 45.0993 161.484 44.4508L172.786 11.1234Z"
            fill={word}
          />
          <path
            d="M226.39 0C226.942 0 227.39 0.447715 227.39 1V10.6734C227.39 11.2257 226.942 11.6734 226.39 11.6734H217.945C217.393 11.6734 216.945 11.2257 216.945 10.6734V0.999999C216.945 0.447715 217.393 0 217.945 0H226.39ZM217.945 74.3411C217.393 74.3411 216.945 73.8934 216.945 73.3411V20.9676C216.945 20.4154 217.393 19.9676 217.945 19.9676H226.39C226.942 19.9676 227.39 20.4154 227.39 20.9676V73.3411C227.39 73.8934 226.942 74.3411 226.39 74.3411H217.945Z"
            fill={word}
          />
          <path
            d="M293.595 1.64261C294.141 0.991871 293.678 0 292.829 0H281.611C281.318 0 281.039 0.128437 280.849 0.351392L252.805 33.2607C252.202 33.9685 251.044 33.542 251.044 32.6121V1C251.044 0.447715 250.596 0 250.044 0H240.678C240.125 0 239.678 0.447715 239.678 1V73.3411C239.678 73.8934 240.125 74.3411 240.678 74.3411H250.044C250.596 74.3411 251.044 73.8934 251.044 73.3411V44.2256C251.044 43.3301 252.13 42.886 252.758 43.5252L282.698 74.0414C282.886 74.2331 283.143 74.3411 283.412 74.3411H295.395C296.276 74.3411 296.726 73.2854 296.117 72.6494L263.644 38.7395C263.292 38.3711 263.273 37.7962 263.6 37.4053L293.595 1.64261Z"
            fill={word}
          />
          <path
            d="M314.862 0C315.414 0 315.862 0.447715 315.862 1V10.6734C315.862 11.2257 315.414 11.6734 314.862 11.6734H306.417C305.865 11.6734 305.417 11.2257 305.417 10.6734V0.999999C305.417 0.447715 305.865 0 306.417 0H314.862ZM306.417 74.3411C305.865 74.3411 305.417 73.8934 305.417 73.3411V20.9676C305.417 20.4154 305.865 19.9676 306.417 19.9676H314.862C315.414 19.9676 315.862 20.4154 315.862 20.9676V73.3411C315.862 73.8934 315.414 74.3411 314.862 74.3411H306.417Z"
            fill={word}
          />
          <path
            d="M343.202 60.2101V29.8763C343.202 29.324 343.65 28.8763 344.202 28.8763H353.876C354.428 28.8763 354.876 28.4286 354.876 27.8763V20.3533C354.876 19.801 354.428 19.3533 353.876 19.3533H344.202C343.65 19.3533 343.202 18.9055 343.202 18.3533V0.999999C343.202 0.447714 342.754 0 342.202 0H333.758C333.205 0 332.758 0.447715 332.758 1V18.3533C332.758 18.9055 332.31 19.3533 331.758 19.3533H326.692C326.14 19.3533 325.692 19.801 325.692 20.3533V27.8763C325.692 28.4286 326.14 28.8763 326.692 28.8763H331.758C332.31 28.8763 332.758 29.324 332.758 29.8763V58.0598C332.758 67.5828 335.829 74.3411 347.81 74.3411H355.104C355.657 74.3411 356.104 73.8934 356.104 73.3411V64.8965C356.104 64.3442 355.657 63.8965 355.104 63.8965H346.274C343.509 63.8965 343.202 63.2821 343.202 60.2101Z"
            fill={word}
          />
        </>
      )}
    </svg>
  )
}
