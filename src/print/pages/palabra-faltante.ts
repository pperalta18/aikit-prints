import { PT_PER_MM } from '../geometry'
import { CAP_CM_PER_METRE, capHeightMmToFontPt, minCapHeightMm } from './wayfinding'
import { TEXT_CAP_RATIO } from './tipografia'

/**
 * palabra-faltante — the pure, unit-tested heart of the **«La última palabra»**
 * wall (10-N-1, S1→S2): a sea of phrases, each missing its final word, shown as a
 * blank rule. The thesis is the *experience*: to fill the blank you need a model of
 * the world — physics, logic, intention, arithmetic, theory of mind — not an
 * autocomplete. So predicting the next word *is* intelligence.
 * ──────────────────────────────────────────────────────────────────────────
 * This module owns the two honest, scale-free parts (no React, no DOM):
 *   • the **corpus** — a large pool of {@link Phrase}s (hand gems + deterministic
 *     generators), each a sentence with its last word omitted (`t`) plus the secret
 *     answer (`a`, never rendered — it only sizes the blank) and a `w` weight that
 *     biases how prominent it sits in the sea (2 = a gem you stop to read, 0 = a
 *     faint murmur in the background haze);
 *   • the **packer** ({@link layoutSea}) — a deterministic shelf packer that tiles
 *     a wall (mm) edge-to-edge with the pool, mixing sizes within each row and
 *     receding most phrases into grey, so the field reads as one continuous mass.
 *
 * Sizing follows the print law: cap-heights are anchored to the wall's reading
 * distance (`minCapHeightMm`, the 1 cm / 3 m floor) and converted to point sizes
 * via `capHeightMmToFontPt` — never picked by eye. The presentation (greys, the one
 * KIT_BLUE accent, the blank rule) lives in `palabra-faltante.tsx`.
 */

/* ── the phrase model ─────────────────────────────────────────────────────────── */

/**
 * A sentence with its **last word omitted**. `t` is everything before the blank
 * (no trailing space); `a` is the missing word — *never rendered*, it only sets the
 * blank's width (a longer answer → a longer rule) and is the secret the viewer
 * supplies. `w` is the prominence weight: 2 = a foreground gem, 1 = mid, 0 = haze.
 */
export type Phrase = { t: string; a: string; w?: number }

/* ── deterministic PRNG (mulberry32) ──────────────────────────────────────────── */

/** A tiny, fast, deterministic PRNG so the whole sea is reproducible from a seed. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Deterministic Fisher–Yates shuffle (returns a new array; does not mutate). */
export function shuffle<T>(items: ReadonlyArray<T>, rng: () => number): T[] {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/* ── the corpus: hand-crafted gems ────────────────────────────────────────────── */

/**
 * The gems — sentences engineered so the missing last word can only be supplied by
 * *reasoning*, not by statistics: logic, theory of mind, intuitive & counter-
 * intuitive physics, arithmetic traps, common sense, causality, intention, self-
 * reference, riddles. Most are weight 2 (foreground); a few 1. The answer (`a`) is
 * the secret — it never prints, it only sizes the blank.
 */
export const GEMS: Phrase[] = [
  // ── lógica / silogismos ──
  { t: 'Si todos los Bloops son Razzies y todos los Razzies son Lazzies, entonces todos los Bloops son', a: 'Lazzies' },
  { t: 'O llueve o hace sol. No hace sol. Por tanto,', a: 'llueve' },
  { t: 'Si p implica q, y q es falso, entonces p también es', a: 'falso' },
  { t: 'Ningún sabio teme a la muerte; Sócrates es sabio; luego Sócrates no la', a: 'teme' },
  { t: 'Si A es más alto que B y B más alto que C, el más bajo de los tres es', a: 'C' },
  { t: 'Todos los cuervos que he visto son negros, así que apuesto a que el próximo también lo', a: 'será' },
  { t: 'Si esta caja contiene una sola verdad, la frase «esta caja miente» tiene que ser', a: 'falsa' },
  { t: 'Solo uno dice la verdad, y los tres se acusan entre sí; el inocente es el que acusó al', a: 'culpable' },
  { t: 'Para que el argumento sea válido no basta con que las premisas convenzan: tienen que ser', a: 'verdaderas' },

  // ── teoría de la mente ──
  { t: 'Ana guarda su canica en la cesta y se va; Luis la cambia a la caja; al volver, Ana la busca en la', a: 'cesta' },
  { t: 'Él cree que ella no sabe que él lo sabe, así que delante de ella seguirá', a: 'fingiendo' },
  { t: 'Ana sabe que Luis va a mentirle, y Luis sabe que ella lo sabe; por eso, esta vez, Luis le dirá la', a: 'verdad' },
  { t: 'Le regalé justo lo que a mí me habría gustado, sin pararme a pensar en lo que quería', a: 'él' },
  { t: 'Sé que sabes que lo sé, pero finjo no saberlo para que tú sigas', a: 'tranquilo' },
  { t: 'No me lo dijo con palabras: me lo dijo evitando mirarme a los', a: 'ojos' },
  { t: 'Sonreía en la foto, pero al que de verdad miraba no era a la cámara: era a', a: 'ella' },
  { t: 'Calló no porque no supiera la respuesta, sino para no dejar en evidencia a su', a: 'amigo' },

  // ── física intuitiva ──
  { t: 'Suelto un martillo y una pluma a la vez en la Luna: los dos tocan el suelo a la', a: 'vez' },
  { t: 'Metí el helado en el coche, conduje dos horas bajo el sol y al llegar estaba', a: 'derretido' },
  { t: 'Empujo el vaso un poco más hacia el borde de la mesa y al final acaba en el', a: 'suelo' },
  { t: 'Lleno el globo de helio, abro la mano y sube hasta tocar el', a: 'techo' },
  { t: 'Si bajo de golpe mi lado del balancín, el lado de mi hermano', a: 'sube' },
  { t: 'El hielo flota porque, al congelarse, el agua se vuelve menos', a: 'densa' },
  { t: 'Inclino la taza llena un poco más de la cuenta y el café se', a: 'derrama' },
  { t: 'Tiro la piedra al centro del estanque y, un instante después, a la orilla llegan las', a: 'ondas' },
  { t: 'Corro con el vaso lleno hasta arriba y, si no freno con cuidado, el agua se me', a: 'cae' },
  { t: 'Dejo la cuchara en la sopa caliente y al rato el mango también está', a: 'caliente' },
  { t: 'Suelto la pelota en lo alto de la rampa y, sola, empieza a', a: 'rodar' },
  { t: 'Si quito el vaso de debajo, la torre de monedas se viene', a: 'abajo' },

  // ── física contraintuitiva ──
  { t: 'Si la Tierra dejara de girar de repente, todo lo suelto saldría disparado hacia el', a: 'este' },
  { t: 'En caída libre dentro del ascensor, la báscula bajo mis pies marcaría', a: 'cero' },
  { t: 'Un kilo de hierro y un kilo de plumas, en el vacío, pesan exactamente lo', a: 'mismo' },
  { t: 'El espejo no invierte arriba y abajo; lo que parece invertir es izquierda y', a: 'derecha' },
  { t: 'Cuanto más rápido gira la patinadora, más recoge los brazos para no', a: 'frenar' },

  // ── matemática trampa ──
  { t: 'Un bate y una pelota cuestan 1,10 €; el bate cuesta un euro más que la pelota; la pelota cuesta', a: '5 céntimos' },
  { t: 'Si 5 máquinas tardan 5 minutos en hacer 5 piezas, 100 máquinas harán 100 piezas en', a: '5 minutos' },
  { t: 'El nenúfar dobla su superficie cada día y cubre el lago entero el día 48; medio lago lo cubrió el día', a: '47' },
  { t: 'Tengo tantos hermanos como hermanas, pero cada hermana tiene la mitad de hermanas que de', a: 'hermanos' },
  { t: 'Pagué con un billete de 20, la cuenta era de 13,40 y me devolvieron', a: '6,60 €' },
  { t: 'Si giro la hoja 180 grados dos veces seguidas, vuelvo a leerla del', a: 'derecho' },
  { t: 'La media de 2, 4 y 9 no es 5: es', a: '5' },
  { t: 'Doblo un folio por la mitad siete veces y el grosor pasa a ser de 128', a: 'capas' },
  { t: 'Si un ladrillo pesa un kilo más medio ladrillo, el ladrillo entero pesa', a: '2 kilos' },

  // ── secuencias ──
  { t: '2, 4, 8, 16,', a: '32' },
  { t: '1, 1, 2, 3, 5, 8,', a: '13' },
  { t: '1, 4, 9, 16, 25,', a: '36' },
  { t: '2, 3, 5, 7, 11,', a: '13' },
  { t: '1, 3, 6, 10, 15,', a: '21' },
  { t: 'O, T, T, F, F, S, S,', a: 'E' },
  { t: 'Lunes, martes, miércoles, jueves,', a: 'viernes' },
  { t: 'Do, re, mi, fa, sol, la,', a: 'si' },
  { t: 'Norte, sur, este,', a: 'oeste' },

  // ── sentido común / mundo ──
  { t: 'Se dejó la leche tres días fuera de la nevera y al olerla supo que estaba', a: 'agria' },
  { t: 'Olvidó regar la planta un mes entero y la encontró completamente', a: 'seca' },
  { t: 'Dejó el pan demasiado tiempo en la tostadora y salió todo', a: 'quemado' },
  { t: 'Salió a la calle con aguanieve sin abrigo y volvió a casa', a: 'helado' },
  { t: 'Encendió la cerilla, la acercó a la mecha y la vela por fin se', a: 'encendió' },
  { t: 'El semáforo se puso en rojo y, uno tras otro, los coches se', a: 'pararon' },
  { t: 'Plantó la semilla en marzo y, ya en pleno verano, recogió el', a: 'fruto' },
  { t: 'Tiró la copa sin querer y, contra el suelo de mármol, se hizo', a: 'añicos' },
  { t: 'Dejó las llaves dentro y cerró de un portazo: se había quedado', a: 'fuera' },
  { t: 'Metió el móvil en el bolsillo del pantalón y lo lavó: ahora no', a: 'enciende' },
  { t: 'Pulsa el interruptor al entrar y, de golpe, la habitación se llena de', a: 'luz' },

  // ── causalidad / temporal ──
  { t: 'Primero se ata bien los cordones y solo después echa a', a: 'correr' },
  { t: 'Vio el relámpago, contó despacio hasta tres y entonces llegó el', a: 'trueno' },
  { t: 'Rompió el espejo y, supersticioso, temió siete años de mala', a: 'suerte' },
  { t: 'Sopló las velas de un soplido y todos se pusieron a', a: 'aplaudir' },
  { t: 'Apretó el freno a fondo y, chirriando, el coche por fin se', a: 'detuvo' },
  { t: 'Quitó la última pieza del Jenga y la torre entera se vino', a: 'abajo' },
  { t: 'Llovió toda la noche y por la mañana el río bajaba', a: 'crecido' },

  // ── intención / emoción ──
  { t: 'Llevaba un ramo de flores y no paraba de mirar el reloj: estaba', a: 'esperando' },
  { t: 'Le temblaba la voz y bajaba la mirada cada vez que hablaba: estaba', a: 'mintiendo' },
  { t: 'Leyó la última línea de la carta, sonrió y se le saltaron las', a: 'lágrimas' },
  { t: 'Le devolvió el anillo en silencio, sin decir una sola', a: 'palabra' },
  { t: 'Apagó el móvil, respiró hondo, llamó a la puerta y entró a la', a: 'entrevista' },
  { t: 'Guardó aquel secreto tantos años que ya no recordaba cómo', a: 'contarlo' },
  { t: 'Dejó la nota en la nevera y se marchó antes de que ella se', a: 'despertara' },
  { t: 'Aplaudían todos menos él, que apretaba los dientes de pura', a: 'envidia' },

  // ── autorreferencia / lenguaje ──
  { t: 'Lee esta frase al derecho y luego al revés: entenderás justo lo', a: 'contrario' },
  { t: 'La palabra «corto» se escribe, curiosamente, más larga que la palabra', a: 'larga' },
  { t: 'En la oración «el gato persiguió al ratón», quien acabó persiguiendo fue el', a: 'gato' },
  { t: 'Si a la palabra «rata» le quito la primera letra, me queda', a: 'ata' },
  { t: 'Leída de derecha a izquierda, la palabra ROMA se convierte en', a: 'AMOR' },
  { t: 'Escribir «ortografía» con falta sería, irónicamente, una falta de', a: 'ortografía' },
  { t: 'Esta frase tiene exactamente seis', a: 'palabras' },
  { t: 'Para entender qué significa «recursivo», primero hay que entender qué significa', a: 'recursivo' },

  // ── acertijos ──
  { t: 'El padre de Ana tiene cinco hijas: Lala, Lela, Lila, Lola y', a: 'Ana' },
  { t: 'Anda sobre cuatro patas al amanecer, sobre dos al mediodía y sobre tres al', a: 'atardecer' },
  { t: 'Cuanto más le quitas, más grande se vuelve: el', a: 'agujero' },
  { t: 'Tiene ciudades pero no casas, ríos pero no agua, bosques pero no árboles: el', a: 'mapa' },
  { t: 'Cuanto más se seca, más mojada acaba: la', a: 'toalla' },
  { t: 'El cirujano mira al niño herido y dice «no puedo operarlo, es mi hijo», y sin embargo no es su padre: es su', a: 'madre' },
  { t: 'Vuela sin alas y llora sin ojos; allá donde va, oscurece el cielo: la', a: 'nube' },
  { t: 'Cuántas veces puedes restarle 3 a 27: una sola', a: 'vez' },
  { t: 'Dos padres y dos hijos van a pescar y solo pescan tres peces, uno para cada uno; y sin embargo son solo', a: 'tres' },

  // ── modelo del mundo / abstracto ──
  { t: 'El mapa, por detallado que sea, nunca llega a ser el', a: 'territorio' },
  { t: 'Le di mi palabra, y una palabra dada deja al instante de ser', a: 'mía' },
  { t: 'Si todos pensáramos exactamente igual, nadie tendría ya nada nuevo que', a: 'decir' },
  { t: 'Una mentira repetida mil veces no se convierte por ello en', a: 'verdad' },
  { t: 'Predecir bien la siguiente palabra exige, en el fondo, comprender el', a: 'mundo' },
  { t: 'Para acertar esta última palabra hace falta algo más que memoria: hace falta', a: 'inteligencia', w: 2 },
  { t: 'No completas el hueco buscando en la memoria: lo completas', a: 'razonando' },
  { t: 'Lo que parece un simple autocompletado esconde, en realidad, un modelo del', a: 'mundo' },

  // ── ciencia / cultura general que exige razonar ──
  { t: 'La cura definitiva del cáncer todavía no la conoce', a: 'nadie' },
  { t: 'Si el hielo de los polos se derrite del todo, el nivel del mar no baja: sube hasta cubrir la', a: 'costa' },
  { t: 'Cuando la Luna se mete justo entre el Sol y la Tierra, lo que vemos es un', a: 'eclipse' },
  { t: 'Las plantas, a plena luz, respiran al revés que nosotros: toman CO₂ y sueltan', a: 'oxígeno' },
  { t: 'Un año en Marte dura más que en la Tierra porque su órbita es mucho más', a: 'larga' },
  { t: 'El relámpago se ve antes que el trueno porque la luz viaja más rápido que el', a: 'sonido' },
  { t: 'Si dividieras cualquier número entre cero, el resultado sencillamente no está', a: 'definido' },
]

/* ── deterministic generators (hundreds of unique, intelligence-requiring fillers) ── */

/** Format a number with a Spanish thousands separator left implicit (small ints). */
function n(x: number): string {
  return String(x)
}

/** Arithmetic word problems — each numerically distinct, each needing real computation. */
export function genArithmetic(): Phrase[] {
  const out: Phrase[] = []
  // change-making
  const pays: Array<[number, number]> = [
    [20, 13.4], [50, 18.7], [10, 6.25], [20, 7.8], [50, 41.3], [100, 64.5],
    [20, 11.95], [10, 2.4], [50, 33.85], [20, 16.6], [100, 78.2], [10, 8.7],
    [20, 4.55], [50, 27.9], [100, 52.35], [20, 19.99], [50, 12.6], [10, 3.15],
    [100, 88.4], [20, 8.25], [50, 45.7], [100, 31.8],
  ]
  for (const [pay, cost] of pays) {
    const change = Math.round((pay - cost) * 100) / 100
    out.push({ t: `Pagué con ${pay} euros una cuenta de ${cost.toFixed(2)} y me devolvieron`, a: `${change.toFixed(2)} €`, w: 0 })
  }
  // products — most of the times table, the harder rows
  const prods: Array<[number, number]> = [
    [7, 8], [12, 12], [6, 9], [13, 4], [15, 6], [11, 11], [14, 5], [9, 9], [8, 12], [7, 13],
    [6, 7], [8, 8], [9, 6], [7, 7], [12, 8], [11, 7], [13, 6], [14, 4], [9, 8], [15, 4],
    [6, 12], [8, 9], [7, 9], [11, 9], [12, 6], [13, 3], [16, 4], [6, 11], [7, 12], [9, 11],
  ]
  for (const [a, b] of prods) out.push({ t: `${a} por ${b} son`, a: n(a * b), w: 0 })
  // double minus half
  const ages = [12, 7, 19, 24, 33, 16, 28, 41, 9, 22, 37, 14, 26, 31, 45, 18]
  for (const a of ages) out.push({ t: `El doble de ${a} menos ${Math.floor(a / 2)} es`, a: n(2 * a - Math.floor(a / 2)), w: 0 })
  // percentages
  const pcts: Array<[number, number]> = [
    [20, 80], [10, 250], [25, 60], [50, 36], [15, 200], [30, 90],
    [40, 50], [75, 40], [5, 300], [60, 25], [12, 150], [35, 80],
  ]
  for (const [p, base] of pcts) out.push({ t: `El ${p}% de ${base} es`, a: n((p * base) / 100), w: 0 })
  // halves / thirds (exact)
  const halves = [48, 64, 96, 38, 150, 84]
  for (const a of halves) out.push({ t: `La mitad de ${a} es`, a: n(a / 2), w: 0 })
  const thirds = [99, 63, 144, 81, 27]
  for (const a of thirds) out.push({ t: `Un tercio de ${a} es`, a: n(a / 3), w: 0 })
  return out
}

/** Day-of-week reasoning — modular, must be counted out, not recalled. */
export function genTime(): Phrase[] {
  const days = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
  const offs: Array<[number, string]> = [[2, 'pasado mañana'], [3, 'dentro de tres días'], [5, 'dentro de cinco días']]
  const out: Phrase[] = []
  for (let d = 0; d < days.length; d++) {
    for (const [k, label] of offs) {
      out.push({ t: `Si hoy es ${days[d]}, ${label} será`, a: days[(d + k) % 7], w: 0 })
    }
  }
  return out
}

/** Unit conversions — small facts that still need a step of reasoning. */
export function genUnits(): Phrase[] {
  const items: Array<[string, string]> = [
    ['Media hora son', '30 minutos'], ['Un cuarto de hora son', '15 minutos'],
    ['Dos docenas son', '24'], ['Media docena son', '6'], ['La mitad de un siglo son', '50 años'],
    ['Un día entero son', '24 horas'], ['Tres cuartos de euro son', '75 céntimos'],
    ['Una semana y media son', '10 días y medio'], ['Un milenio son', '1000 años'],
    ['Cien centímetros son', '1 metro'],
  ]
  return items.map(([t, a]) => ({ t, a, w: 0 }))
}

/** Categories — pick the superordinate set the three members share. */
export function genCategories(): Phrase[] {
  const cats: Array<[string, string]> = [
    ['El perro, el gato y el caballo son todos', 'mamíferos'],
    ['El rojo, el azul y el verde son todos', 'colores'],
    ['La rosa, el tulipán y el clavel son todas', 'flores'],
    ['El roble, el pino y el abedul son todos', 'árboles'],
    ['Júpiter, Saturno y Marte son todos', 'planetas'],
    ['El cobre, el hierro y el oro son todos', 'metales'],
    ['El violín, la viola y el chelo son todos de', 'cuerda'],
    ['El cuadrado, el rombo y el trapecio son todos', 'cuadriláteros'],
    ['El águila, el gorrión y el búho son todas', 'aves'],
    ['Enero, marzo y agosto son todos', 'meses'],
    ['El Nilo, el Amazonas y el Ebro son todos', 'ríos'],
    ['El francés, el portugués y el rumano son todas lenguas', 'romances'],
  ]
  return cats.map(([t, a]) => ({ t, a, w: 0 }))
}

/** Roman numerals — a small decoding, not a lookup. */
export function genRoman(): Phrase[] {
  const r: Array<[string, string]> = [
    ['IX', '9'], ['XL', '40'], ['XIV', '14'], ['XC', '90'], ['LXVI', '66'],
    ['CD', '400'], ['XIX', '19'], ['MCM', '1900'], ['XXIV', '24'], ['CM', '900'],
    ['XLII', '42'], ['LXXX', '80'],
  ]
  return r.map(([sym, a]) => ({ t: `El número romano ${sym} vale`, a, w: 0 }))
}

/** Ordering / superlatives — relational facts that need comparing, not recalling. */
export function genOrdering(): Phrase[] {
  const items: Array<[string, string]> = [
    ['Entre el Everest, el Mont Blanc y el Teide, el más alto es el', 'Everest'],
    ['Entre Mercurio, la Tierra y Júpiter, el planeta más grande es', 'Júpiter'],
    ['Entre una hormiga, un perro y una ballena, el más pesado es la', 'ballena'],
    ['Entre el segundo, la hora y el año, el periodo más largo es el', 'año'],
    ['Entre el milímetro, el metro y el kilómetro, el más corto es el', 'milímetro'],
    ['Entre 1/2, 1/3 y 1/4, la fracción mayor es', '1/2'],
    ['Entre el gramo, el kilo y la tonelada, el mayor es la', 'tonelada'],
    ['Entre marzo, junio y diciembre, el mes más cercano al verano es', 'junio'],
  ]
  return items.map(([t, a]) => ({ t, a, w: 0 }))
}

/** Number / letter sequences — each a distinct pattern that must be inferred. */
export function genSequences(): Phrase[] {
  const seqs: Array<[number[] | string[], string]> = [
    [[3, 6, 12, 24], '48'],
    [[1, 2, 4, 7, 11], '16'],
    [[2, 6, 12, 20, 30], '42'],
    [[1, 8, 27, 64], '125'],
    [[100, 96, 88, 72], '40'],
    [[5, 10, 20, 40], '80'],
    [[81, 27, 9, 3], '1'],
    [[1, 2, 6, 24, 120], '720'],
    [[7, 14, 28, 56], '112'],
    [[2, 5, 11, 23], '47'],
    [[1, 3, 9, 27], '81'],
    [[64, 32, 16, 8], '4'],
    [[3, 4, 6, 9, 13], '18'],
    [[1, 2, 4, 8, 16], '32'],
    [[10, 9, 7, 4], '0'],
    [[2, 4, 7, 11, 16], '22'],
    [[1, 5, 14, 30], '55'],
    [[0, 1, 1, 2, 3, 5], '8'],
    [['A', 'C', 'E', 'G'], 'I'],
    [['Z', 'Y', 'X', 'W'], 'V'],
    [['A', 'B', 'D', 'G', 'K'], 'P'],
    [['B', 'D', 'F', 'H'], 'J'],
    [['A', 'A', 'B', 'C', 'E', 'H'], 'M'],
  ]
  return seqs.map(([s, a]) => ({ t: `${(s as Array<number | string>).join(', ')},`, a, w: 1 }))
}

/** Capitals — world knowledge, several deliberately counter-intuitive. */
export function genCapitals(): Phrase[] {
  const caps: Array<[string, string]> = [
    ['Australia', 'Canberra'], ['Canadá', 'Ottawa'], ['Turquía', 'Ankara'], ['Brasil', 'Brasilia'],
    ['Suiza', 'Berna'], ['Marruecos', 'Rabat'], ['Estados Unidos', 'Washington'], ['Sudáfrica', 'Pretoria'],
    ['Nueva Zelanda', 'Wellington'], ['Kazajistán', 'Astaná'], ['Birmania', 'Naipyidó'], ['Bolivia', 'Sucre'],
    ['Portugal', 'Lisboa'], ['Egipto', 'El Cairo'], ['Japón', 'Tokio'], ['Noruega', 'Oslo'],
    ['Argentina', 'Buenos Aires'], ['Nigeria', 'Abuya'], ['Vietnam', 'Hanói'], ['India', 'Nueva Delhi'],
    ['Países Bajos', 'Ámsterdam'], ['Tanzania', 'Dodoma'], ['Costa de Marfil', 'Yamusukro'], ['Ecuador', 'Quito'],
    ['Pakistán', 'Islamabad'], ['Sri Lanka', 'Colombo'], ['Belice', 'Belmopán'], ['Malta', 'La Valeta'],
  ]
  return caps.map(([country, city]) => ({ t: `La capital de ${country} es`, a: city, w: 0 }))
}

/** Analogies — relational reasoning, never mere association. */
export function genAnalogies(): Phrase[] {
  const an: Array<[string, string, string, string]> = [
    ['Mano', 'guante', 'pie', 'calcetín'],
    ['Pájaro', 'nido', 'abeja', 'colmena'],
    ['Médico', 'hospital', 'profesor', 'escuela'],
    ['Caliente', 'frío', 'arriba', 'abajo'],
    ['Día', 'noche', 'verano', 'invierno'],
    ['Llave', 'cerradura', 'pregunta', 'respuesta'],
    ['Agua', 'sed', 'comida', 'hambre'],
    ['Autor', 'libro', 'pintor', 'cuadro'],
    ['Oruga', 'mariposa', 'renacuajo', 'rana'],
    ['Reloj', 'tiempo', 'termómetro', 'temperatura'],
    ['Cachorro', 'perro', 'potro', 'caballo'],
    ['Pincel', 'pintar', 'martillo', 'clavar'],
    ['Dedo', 'mano', 'hoja', 'árbol'],
    ['Hambre', 'comer', 'sueño', 'dormir'],
    ['Barco', 'mar', 'avión', 'aire'],
    ['Norte', 'sur', 'izquierda', 'derecha'],
    ['Página', 'libro', 'fotograma', 'película'],
    ['Profesor', 'enseñar', 'juez', 'juzgar'],
    ['Semilla', 'planta', 'huevo', 'pájaro'],
    ['Frío', 'tiritar', 'miedo', 'temblar'],
    ['Uno', 'pocos', 'pocos', 'muchos'],
    ['Lápiz', 'escribir', 'tijeras', 'cortar'],
    ['Abeja', 'miel', 'vaca', 'leche'],
    ['Pez', 'agua', 'topo', 'tierra'],
  ]
  return an.map(([a, b, c, d]) => ({ t: `${a} es a ${b} lo que ${c} es a`, a: d, w: 1 }))
}

/** Antonyms in a sentence frame — semantics with a turn. */
export function genAntonyms(): Phrase[] {
  const pairs: Array<[string, string, string]> = [
    ['Subió', 'el ascensor entero y al llegar arriba ya solo le quedaba', 'bajar'],
    ['Empezó', 'el libro por la última página, justo por donde otros lo', 'terminan'],
    ['Encendió', 'todas las luces de casa para no tener que apagar ni', 'una'],
    ['Llenó', 'la jarra hasta el borde sin derramar ni media', 'gota'],
  ]
  return pairs.map(([head, mid, a]) => ({ t: `${head} ${mid}`, a, w: 0 }))
}

/** Build the full corpus: gems + every generator, in declaration order. */
export function buildCorpus(): Phrase[] {
  return [
    ...GEMS,
    ...genSequences(),
    ...genAnalogies(),
    ...genCapitals(),
    ...genArithmetic(),
    ...genAntonyms(),
    ...genTime(),
    ...genUnits(),
    ...genCategories(),
    ...genRoman(),
    ...genOrdering(),
  ]
}

/* ── the packer ───────────────────────────────────────────────────────────────── */

export type LayoutOpts = {
  /** Wall trim width (mm). */
  trimWidthMm: number
  /** Wall trim height (mm). */
  trimHeightMm: number
  /** Real reading distance (m) — anchors the legibility floor. */
  readingDistanceM: number
  /** Reproducibility seed. */
  seed?: number
  /** The phrase pool. Defaults to {@link buildCorpus}. */
  phrases?: ReadonlyArray<Phrase>
  /** Side margins as a fraction of width. Default 0.025. */
  marginXFraction?: number
  /** Top/bottom margins as a fraction of height. Default 0.04. */
  marginYFraction?: number
  /** Cap-height of each size tier as a multiple of the legibility floor. Default [2.3, 1.45, 1.0]. */
  tierCapMultiples?: number[]
  /** Average glyph advance as a fraction of the em (Universal Sans Text ≈ 0.52). */
  avgCharEm?: number
  /** Hard cap on placements (runaway guard). Default 6000. */
  maxPlacements?: number
  /** The phrase whose blank gets the single KIT_BLUE accent (matched on `t`). */
  accentText?: string
}

/** One phrase placed in the wall, in millimetres from the trim origin. */
export type PlacedPhrase = {
  text: string
  /** Left edge of the text (mm). */
  xMm: number
  /** Top of the line box (mm). */
  yMm: number
  /** Font size (pt) — feed to `geo.pt`. */
  fontPt: number
  /** Rendered cap-height (mm) — for QA. */
  capMm: number
  /** Em box height (mm) — the line box used for packing. */
  emMm: number
  /** Estimated rendered width of the text (mm) — for QA / bound checks. */
  textWidthMm: number
  /** Width of the blank rule (mm), sized by the omitted word's length. */
  blankWidthMm: number
  /** Gap between the text and the blank (mm). */
  blankGapMm: number
  /** Size tier (0 = foreground … last = smallest). */
  tier: number
  /** Depth 0 (dark foreground) … 1 (light haze) — drives the grey ramp. */
  depth: number
  /** The single accented phrase (its blank renders in KIT_BLUE). */
  accent: boolean
}

export type SeaLayout = {
  placed: PlacedPhrase[]
  floorCapMm: number
  usable: { x: number; y: number; w: number; h: number }
  /** Echoed for QA / the control table. */
  tierCapsMm: number[]
}

type Prepared = {
  phrase: Phrase
  tier: number
  fontPt: number
  capMm: number
  emMm: number
  textWidthMm: number
  blankWidthMm: number
  blankGapMm: number
  depth: number
}

/** Tier-pick probabilities by phrase weight (rows are [P(tier0), P(tier1), P(tier2)]). */
const TIER_PROBS: Record<number, number[]> = {
  2: [0.5, 0.4, 0.1],
  1: [0.18, 0.42, 0.4],
  0: [0.04, 0.26, 0.7],
}
/** Base depth per tier (0 dark … 1 light); noise is added per phrase. */
const TIER_DEPTH = [0.06, 0.42, 0.74]

function pickTier(rng: () => number, weight: number, nTiers: number): number {
  const probs = TIER_PROBS[weight] ?? TIER_PROBS[1]
  const r = rng()
  let acc = 0
  for (let i = 0; i < probs.length && i < nTiers; i++) {
    acc += probs[i]
    if (r < acc) return i
  }
  return Math.min(probs.length, nTiers) - 1
}

/**
 * Pack a wall edge-to-edge into a deterministic sea of phrases. Shelf packer: rows
 * fill left→right with phrases drawn from the shuffled pool (mixing tiers within a
 * row so the field never looks like a paragraph), each phrase vertically centred in
 * its row; rows stack top→bottom until the wall is full. The pool is reshuffled each
 * pass (so the tiling never visibly repeats) and recycled if it runs out. Sizes come
 * from the reading-distance cap-height floor — never picked by eye. Deterministic;
 * throws on a non-positive wall size or distance.
 */
export function layoutSea(opts: LayoutOpts): SeaLayout {
  const {
    trimWidthMm,
    trimHeightMm,
    readingDistanceM,
    seed = 1,
    phrases = buildCorpus(),
    marginXFraction = 0.025,
    marginYFraction = 0.04,
    tierCapMultiples = [2.0, 1.4, 1.0],
    avgCharEm = 0.52,
    maxPlacements = 6000,
    accentText,
  } = opts

  if (!(trimWidthMm > 0)) throw new Error(`layoutSea: trimWidthMm must be > 0 (got ${trimWidthMm})`)
  if (!(trimHeightMm > 0)) throw new Error(`layoutSea: trimHeightMm must be > 0 (got ${trimHeightMm})`)
  if (!(readingDistanceM > 0)) throw new Error(`layoutSea: readingDistanceM must be > 0 (got ${readingDistanceM})`)
  if (phrases.length === 0) throw new Error('layoutSea: phrases must not be empty')

  const floorCapMm = minCapHeightMm(readingDistanceM, CAP_CM_PER_METRE)
  const tierCapsMm = tierCapMultiples.map((m) => floorCapMm * m)
  const nTiers = tierCapsMm.length

  const usable = {
    x: trimWidthMm * marginXFraction,
    y: trimHeightMm * marginYFraction,
    w: trimWidthMm * (1 - 2 * marginXFraction),
    h: trimHeightMm * (1 - 2 * marginYFraction),
  }
  const usableRight = usable.x + usable.w
  const usableBottom = usable.y + usable.h

  const rng = mulberry32(seed)

  // Pre-size a phrase into a chosen tier; optionally shrink so it fits one row.
  const prepare = (phrase: Phrase, tier: number): Prepared => {
    let capMm = tierCapsMm[tier]
    let emMm = capMm / TEXT_CAP_RATIO
    const blankChars = Math.max(2, Math.min(9, phrase.a.length))
    const measure = (em: number) => {
      const textWidthMm = phrase.t.length * avgCharEm * em
      const blankWidthMm = Math.max(1.8, blankChars * avgCharEm) * em
      const blankGapMm = 0.45 * em
      return { textWidthMm, blankWidthMm, blankGapMm }
    }
    let m = measure(emMm)
    const total = m.textWidthMm + m.blankGapMm + m.blankWidthMm
    if (total > usable.w) {
      // A long phrase at this tier overruns the row — shrink it to fit exactly.
      const k = (usable.w * 0.98) / total
      emMm *= k
      capMm *= k
      m = measure(emMm)
    }
    const depth = Math.max(0, Math.min(0.92, TIER_DEPTH[tier] + (rng() - 0.5) * 0.32))
    return {
      phrase,
      tier,
      fontPt: capHeightMmToFontPt(capMm, TEXT_CAP_RATIO),
      capMm,
      emMm,
      textWidthMm: m.textWidthMm,
      blankWidthMm: m.blankWidthMm,
      blankGapMm: m.blankGapMm,
      depth,
    }
  }

  // A recycling, reshuffled queue of prepared phrases.
  let bag: Prepared[] = []
  let pass = 0
  const refill = () => {
    const order = shuffle(phrases, mulberry32(seed + 0x9e37 * (pass + 1)))
    // The thesis phrase always sits in the foreground tier (it carries the one accent).
    bag = order.map((p) => prepare(p, accentText != null && p.t === accentText ? 0 : pickTier(rng, p.w ?? 1, nTiers)))
    pass++
  }
  const next = (): Prepared => {
    if (bag.length === 0) refill()
    return bag.shift() as Prepared
  }

  const placed: PlacedPhrase[] = []
  let accentDone = false
  let y = usable.y
  const smallestEm = tierCapsMm[nTiers - 1] / TEXT_CAP_RATIO

  while (y + smallestEm <= usableBottom && placed.length < maxPlacements) {
    // Build one shelf (row): fill left→right with a small look-ahead so the *tail*
    // of the row gets packed with whatever short phrase still fits — that kills the
    // ragged right whitespace and makes the field read as a dense sea, not lines.
    const row: Array<{ p: Prepared; x: number }> = []
    let x = usable.x + rng() * smallestEm * 1.2 // tiny left indent so the edge isn't a column
    let shelfEm = 0
    const deferred: Prepared[] = []
    let misses = 0
    while (placed.length + row.length < maxPlacements && misses < 14) {
      const p = next()
      const total = p.textWidthMm + p.blankGapMm + p.blankWidthMm
      const gap = row.length === 0 ? 0 : (0.45 + rng() * 0.7) * p.emMm
      if (row.length === 0 || x + gap + total <= usableRight) {
        x += gap
        row.push({ p, x })
        x += total
        if (p.emMm > shelfEm) shelfEm = p.emMm
        misses = 0
      } else {
        deferred.push(p) // doesn't fit the remaining width — try a shorter one
        misses++
      }
    }
    // Return the look-ahead misses to the front of the bag, in original order.
    for (let i = deferred.length - 1; i >= 0; i--) bag.unshift(deferred[i])
    if (row.length === 0) break

    // Would this shelf overflow the bottom? Stop before placing it (keep the bound).
    if (y + shelfEm > usableBottom) break

    for (const { p, x: px } of row) {
      const yTop = y + (shelfEm - p.emMm) / 2
      const isAccent = !accentDone && accentText != null && p.phrase.t === accentText
      if (isAccent) accentDone = true
      placed.push({
        text: p.phrase.t,
        xMm: px,
        yMm: yTop,
        fontPt: p.fontPt,
        capMm: p.capMm,
        emMm: p.emMm,
        textWidthMm: p.textWidthMm,
        blankWidthMm: p.blankWidthMm,
        blankGapMm: p.blankGapMm,
        tier: p.tier,
        depth: p.depth,
        accent: isAccent,
      })
    }
    y += shelfEm * (1.04 + rng() * 0.1)
  }

  return { placed, floorCapMm, usable, tierCapsMm }
}
