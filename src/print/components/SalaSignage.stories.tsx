import type { Meta, StoryObj } from '@storybook/react-vite'
import { SalaSignage, type SignageStep } from './SalaSignage'

// The six rooms of the expo (see specs/expo-guion.md), as the signage dial sees
// them: each room is a stop; the current one is the protagonist.
const SALAS: SignageStep[] = [
  { id: '01', label: 'Bici', description: 'Disrupción sensorial. ¿WTF?' },
  { id: '02', label: 'Intro a la IA', description: 'Desmistificación. Sin miedo.' },
  { id: '03', label: 'Velocidad de progreso', description: 'Ya está aquí y no se detiene.' },
  { id: '04', label: 'Ineficiencias del humano', description: 'El humano es un paquete.' },
  { id: '05', label: 'Cuellos de botella', description: 'De dónde viene el coste.' },
  { id: '06', label: 'Pobreza histórica', description: 'Ya pasó antes.' },
]

const meta: Meta<typeof SalaSignage> = {
  title: 'Señalética/SalaSignage',
  component: SalaSignage,
  parameters: { layout: 'fullscreen' },
  args: {
    steps: SALAS,
    activeIndex: 2,
    theme: 'light',
  },
  argTypes: {
    activeIndex: { control: { type: 'range', min: 0, max: 5, step: 1 } },
    theme: { control: { type: 'inline-radio' }, options: ['light', 'dark'] },
  },
  // It's a wall graphic — show it at size, full-bleed, no device/window frame.
  decorators: [
    (Story) => (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', background: '#e9e9ee', padding: 0 }}>
        <div style={{ height: '100vh', aspectRatio: '1080 / 1920' }}>
          <Story />
        </div>
      </div>
    ),
  ],
}

export default meta

type Story = StoryObj<typeof SalaSignage>

/** Sala 3 active — mirrors the reference ("03 · already on and never turns off"). */
export const Default: Story = {}

/** First room of the run. */
export const PrimeraSala: Story = { args: { activeIndex: 0 } }

/** Last room of the run. */
export const UltimaSala: Story = { args: { activeIndex: 5 } }

/** Dark register — neutral ink ground, no warm/cream cast. */
export const Dark: Story = { args: { theme: 'dark' } }

/** A short 3-room run, to check the dial spacing adapts to step count. */
export const TresSalas: Story = {
  args: {
    activeIndex: 1,
    steps: [
      { id: '01', label: 'Acceso', description: 'Bienvenida.' },
      { id: '02', label: 'Showroom', description: 'La evidencia.' },
      { id: '03', label: 'Salida', description: 'El regalo.' },
    ],
  },
}
