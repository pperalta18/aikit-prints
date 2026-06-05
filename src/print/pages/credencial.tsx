import type { PrintPageProps } from '../types'
import { COLORWAYS, Field, Keyboard, RoleWord, EventLockup, layout, type CredRole } from './credencial-kit'

/**
 * credencial — one AiKit Live accreditation card, driven by a `role` prop into
 * one of four colourways (see credencial-kit). Reproduces the Figma designs:
 * a flat full-bleed field, two staggered rows of raised neumorphic keys bleeding
 * off the top + sides, the centred AiKit Live lockup, and the big light-weight
 * role word anchored near the bottom. Credentials are sorted BY TYPE — the role
 * is the hero and there is no holder name.
 *
 * The card is die-cut rounded with a lanyard slot punched through the top; the
 * key texture is set just below the top edge so the punch clears it.
 */

type Props = { role?: CredRole }

export function Credencial({ doc, geo }: PrintPageProps) {
  const p = (doc.props ?? {}) as Props
  const role: CredRole = p.role && COLORWAYS[p.role] ? p.role : 'speaker'
  const cw = COLORWAYS[role]
  const L = layout(geo)
  // PRESS overrides the key texture to a dark tone over its light field; other roles
  // keep one tone (keyCw === cw). The dark strip then bleeds off the top trim edge.
  const keyCw = cw.keyboard ? { ...cw, theme: cw.keyboard.theme, tray: cw.keyboard.tray } : cw

  return (
    <>
      <Field cw={cw} />
      <Keyboard geo={geo} cw={keyCw} bleedTop={Boolean(cw.keyboard)} />

      {/* event lockup — centred, above the role word */}
      <div
        style={{
          position: 'absolute',
          top: L.lockupTop,
          left: L.centerX,
          transform: 'translateX(-50%)',
        }}
      >
        <EventLockup geo={geo} cw={cw} />
      </div>

      {/* role masthead — centred on the trim, vertical centre anchored near the bottom */}
      <div
        style={{
          position: 'absolute',
          top: L.roleCenterY,
          left: L.centerX,
          transform: 'translate(-50%, -50%)',
        }}
      >
        <RoleWord geo={geo} cw={cw} />
      </div>
    </>
  )
}
