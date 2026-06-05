import type { Meta, StoryObj } from '@storybook/react-vite'
import { Indice } from './Indice'

/**
 * Editorial / Índice — the exhibition contents page.
 * A ghost number, a room title and a one-line description per entry, separated by
 * hairline rules. Two grounds (clean white / ink) and one disciplined brand-blue accent.
 */
const meta: Meta<typeof Indice> = {
  title: 'Editorial/Índice',
  component: Indice,
  parameters: { layout: 'fullscreen' },
  argTypes: {
    theme: { control: 'inline-radio', options: ['light', 'dark'] },
    accent: { control: 'color' },
    startIndex: { control: { type: 'number', min: 0, step: 1 } },
    padDigits: { control: { type: 'number', min: 1, max: 3, step: 1 } },
  },
}

export default meta

type Story = StoryObj<typeof Indice>

/** White ground, brand-blue accent — the default editorial voice. */
export const Default: Story = {}

/** Ink register — the same composition flipped to the dark ground. */
export const Dark: Story = {
  args: { theme: 'dark' },
}

/** Title + numbers only — the leanest, most editorial form (no descriptions, no meta). */
export const Minimal: Story = {
  args: {
    title: 'Salas',
    subtitle: 'El recorrido, en una mirada',
    entries: [
      { title: 'La energía artificial' },
      { title: 'Introducción a la inteligencia artificial' },
      { title: 'La velocidad de escala' },
      { title: 'El telar de la inteligencia' },
      { title: 'La Naranja Mecánica' },
      { title: 'Cóctel de cierre' },
    ],
  },
}
