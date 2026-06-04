import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Agentation } from 'agentation'
import { PrintsApp } from '@/print/ui/PrintsApp'
import '../index.css'
import '../tailwind.css'

/** Standalone entry for the print generator — its own page (prints.html), separate
 * from the keynote/grid app. Mounts the operator GUI directly. Agentation (visual
 * feedback for AI agents) is mounted in dev only. */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PrintsApp />
    {import.meta.env.DEV && <Agentation />}
  </StrictMode>,
)
