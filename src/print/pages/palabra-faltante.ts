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

/* ── the corpus: reasoning-only, un-memorizable phrases ───────────────────────── */

/**
 * The corpus. Every phrase is a fill-in-the-blank whose missing LAST word can only be
 * supplied by *reasoning about that specific, novel situation* — model another mind,
 * simulate the physics, run the mechanism, deduce, compute, rotate the scene, infer the
 * unsaid. None is a known riddle, quote, fact or cliché: each is an arbitrary instance
 * that exists written nowhere, so it cannot be completed from memory. That is the whole
 * thesis — predicting this word *is* intelligence, not recall.
 *
 * Authored by generation + adversarial filtering: a solver kept only the determinate,
 * novel, non-obvious phrases, and a memory-only attacker discarded anything completable
 * without reasoning. Weights drive the sea's depth: the evocative world-model phrases sit
 * in the foreground (w 2); the (equally un-memorizable but visually repetitive) numeric
 * puzzles recede into the haze (w 0).
 */
export const GEMS: Phrase[] = [
  // ── la tesis (hero) + meta: frases sobre la propia pared, no memorizables ──
  { t: 'Para acertar esta última palabra hace falta algo más que memoria: hace falta', a: 'inteligencia', w: 2 },
  { t: 'Si pudieras contestar esto de memoria, no demostraría nada; por eso hay que', a: 'razonarlo', w: 2 },
  { t: 'Ningún texto del mundo traía ya escrita esta palabra: hay que', a: 'deducirla', w: 2 },
  { t: 'Esta palabra no se recuerda, se', a: 'piensa', w: 2 },
  { t: 'De nada sirve aquí haber leído mucho si no has', a: 'entendido', w: 2 },
  // ── teoría de la mente — modelar otra mente ──
  { t: 'Le digo a Nuria que el regalo está bajo la cama, pero lo cambio al armario; Nuria mirará bajo la', a: 'cama', w: 2 },
  { t: 'Le juro a Hugo que el dinero está en el sobre, pero lo escondo en el libro; Hugo abrirá el', a: 'sobre', w: 2 },
  { t: 'Aitor cree que su tren sale del andén 3; lo mueven al 7 sin avisarle; Aitor irá al andén', a: '3', w: 2 },
  { t: 'Elsa cree que la reunión es a las cuatro; la adelantaron a las dos y nadie le avisó; Elsa llegará a las', a: 'cuatro', w: 2 },
  { t: 'Dani guarda su carta en el zapato; sin verlo la paso a la mochila; la buscará primero en su', a: 'zapato', w: 2 },
  { t: 'Cambio el bombón de la caja roja a la dorada mientras Noa no mira; Noa, al elegir, abrirá la', a: 'roja', w: 2 },
  { t: 'Iván cree que el partido es el sábado; lo cambiaron al domingo sin decírselo; Iván irá el', a: 'sábado', w: 2 },
  { t: 'Le digo a Saúl que las pinturas están en el estante de arriba, pero las bajé al de abajo; Saúl mirará', a: 'arriba', w: 1 },
  { t: 'Le prometo a Celia que el cargador está en el cajón, pero lo dejé en el coche; Celia abrirá el', a: 'cajón', w: 1 },
  { t: 'Gael guarda su diario bajo el colchón; sin que lo note lo paso a la estantería; Gael alzará el', a: 'colchón', w: 1 },
  { t: 'Ruth cree que la peluquería abre a las nueve; cambió a las once y nadie se lo dijo; Ruth llegará a las', a: 'nueve', w: 1 },
  { t: 'Le digo a Inés que su sombrero está en la entrada, mas lo colgué en su cuarto; Inés irá a la', a: 'entrada', w: 1 },
  { t: 'Bea cree que su perro duerme en la cesta; lo subieron al sofá sin avisarle; Bea lo buscará en la', a: 'cesta', w: 1 },
  { t: 'Oscar esconde el mapa en su bota; yo lo escondo en su gorro mientras come; Oscar revisará primero la', a: 'bota', w: 1 },
  { t: 'Crees que mi calma significa que no sé nada, cuando es justo lo que más debería', a: 'preocuparte', w: 1 },
  // ── pragmática — inferir lo que NO se dice ──
  { t: 'Mi cuñado prueba el vino que traje y dice «para cocinar va de lujo»; quiere decir que es', a: 'malo', w: 2 },
  { t: 'Pregunto si llegaré a tiempo; el taxista mira el reloj y suspira «yo iría rezando»: llegaré', a: 'tarde', w: 2 },
  { t: 'El mecánico chasquea la lengua, mira el capó y dice «con esto te compras otro coche»; la avería es', a: 'cara', w: 1 },
  { t: 'Le pido al técnico que arregle el portátil hoy y resopla «hoy, dice usted… qué optimista»; me deja claro que hoy', a: 'no', w: 1 },
  { t: 'Pregunté si el hotel estaba cerca y el folleto dijo «a un agradable paseo matutino»: está', a: 'lejos', w: 1 },
  // ── mundo contrafactual — razonar con otras reglas ──
  { t: 'Si la lluvia cayera de abajo hacia arriba, para no mojarte llevarías el paraguas en los', a: 'pies', w: 2 },
  { t: 'Si el agua hirviera al enfriarse, para hacer una sopa caliente meterías la olla en el', a: 'congelador', w: 1 },
  { t: 'Si el invierno fuera la estación más calurosa, para esquiar viajarías en pleno', a: 'verano', w: 2 },
  { t: 'Si el azúcar supiera amargo y la sal dulce, el postre lo endulzarías con un poco de', a: 'sal', w: 2 },
  { t: 'Si las escaleras subieran cuando bajas, para llegar al ático tendrías que ir hacia', a: 'abajo', w: 2 },
  { t: 'Si los gatos ladraran y los perros maullaran, para imitar a un perro tendrías que', a: 'maullar', w: 2 },
  { t: 'Si el agua cayera hacia el techo, el desagüe de la bañera tendría que estar', a: 'arriba', w: 1 },
  { t: 'Si las velas crecieran al arder, la vela más vieja sería siempre la más', a: 'alta', w: 1 },
  { t: 'Si lo pesado flotara y lo ligero se hundiera, para que un globo subiera habría que', a: 'lastrarlo', w: 2 },
  { t: 'Si la nieve fuera negra y el carbón blanco, de noche solo verías a lo lejos el', a: 'carbón', w: 1 },
  { t: 'Si comer diera hambre y ayunar saciara, el banquete más copioso te dejaría', a: 'hambriento', w: 2 },
  { t: 'Si los caminos se alargaran cuanto más andas, para llegar antes valdría más quedarse', a: 'quieto', w: 2 },
  { t: 'Si los recuerdos se formaran del futuro, recordarías a quién conocerás pero no a quién', a: 'conociste', w: 2 },
  // ── física — simular, no recordar ──
  { t: 'Apoyo una escalera casi vertical y subo: el peso me empuja el pie de la escalera hacia', a: 'afuera', w: 1 },
  { t: 'Hundo el centro del tablero de un puente colgante de juguete; las cimas de las torres se inclinan hacia', a: 'dentro', w: 1 },
  { t: 'Pego un chicle a la llanta de una bici que avanza; va más rápido cuando el chicle está', a: 'arriba', w: 2 },
  // ── mecanismos — simular el dispositivo ──
  { t: 'Engranaje de 30 dientes mueve a otro de 10; cuando el grande da una vuelta, el chico da', a: 'tres', w: 2 },
  { t: 'Engranaje de 12 dientes arrastra a uno de 36; por cada vuelta del chico, el grande gira un', a: 'tercio', w: 2 },
  { t: 'Tres engranajes forman triángulo y se tocan entre sí; intento girar uno y el conjunto queda', a: 'trabado', w: 2 },
  { t: 'Echo una piedra al cubo lleno de agua hasta el borde; el agua que se derrama vuelve el cubo más', a: 'pesado', w: 2 },
  { t: 'Pongo dos pesas de 3 kg en un platillo y una de 5 kg en el otro; baja el platillo de las', a: 'pesas de 3 kg', w: 2 },
  { t: 'Tubo en U con mercurio: soplo fuerte por la rama izquierda y el mercurio de esa rama', a: 'baja', w: 1 },
  { t: 'Cuelgo un cubo de un muelle largo; al quitarle agua el muelle se estira', a: 'menos', w: 2 },
  { t: 'El niño gordo se sienta cerca del eje del balancín para equilibrar al flaco, que está mucho más', a: 'lejos', w: 1 },
  { t: 'Sujeto el cascanueces muy cerca de la bisagra para apretar la nuez, así que me cuesta', a: 'más', w: 1 },
  // ── semántica de palabras inventadas — componer reglas nuevas ──
  { t: 'Si «mor» es duplicar y «kan» es restar tres, aplicar «mor» y luego «kan» a cinco da', a: 'siete', w: 2 },
  { t: 'En este idioma «pum» es el doble y «mox» resta tres; un «pum-mox» de ocho vale', a: 'trece', w: 1 },
  { t: 'Si «zir» es ayer y «zir-zir» anteayer, el «zir» del martes fue un', a: 'lunes', w: 1 },
  { t: 'En tron «kel» es izquierda y «ker» derecha; si giras «kel», luego «kel», luego «ker», miras a la', a: 'izquierda', w: 2 },
  { t: 'Si «vra» significa cero de algo, un «vra-pelo» en la cabeza significa estar', a: 'calvo', w: 1 },
  { t: 'Si «hek» es restar la mitad, aplicar «hek» dos veces a veinte deja', a: 'cinco', w: 2 },
  { t: 'Si «kli» quiere decir frío y «kli-kli» helado, un hielo está casi siempre', a: 'kli-kli', w: 2 },
  { t: 'Si «bek» significa hace una hora y «bek-bek» hace dos, el «bek» de las cinco fueron las', a: 'cuatro', w: 2 },
  { t: 'En este idioma «lum» es brillante y «lum-no» apagado; una bombilla rota está', a: 'lum-no', w: 1 },
  { t: 'Si «zum» pinta de azul y «rojín» mezcla rojo encima, un objeto «zum-rojín» se ve', a: 'morado', w: 1 },
  { t: 'Si «kip» gira 90° a la izquierda y miras al sur, «kip-kip-kip» te deja mirando al', a: 'oeste', w: 1 },
  { t: 'Si «vor» avanza una casilla y «rev» invierte el sentido de avance, tras «vor-rev-vor» estás en la casilla', a: 'inicial', w: 2 },
  { t: 'Si «luz» aclara hasta blanco y «som» oscurece hasta negro, un gris tras «som-luz-som» tira a', a: 'negro', w: 1 },
  // ── perspectiva y rotación mental ──
  { t: 'Bárbara conduce hacia el sur y al llegar al cruce gira a su izquierda; ahora va hacia el', a: 'este', w: 2 },
  { t: 'Si te sientas justo enfrente de mí, mi flanco izquierdo te queda a tu mano', a: 'derecha', w: 2 },
  { t: 'Pinto en la ventana un 6 mirando a la calle; desde dentro de casa lo veo como un', a: 'nueve', w: 2 },
  { t: 'Vamos cara a cara y doy un paso a mi derecha; para ti me he movido hacia tu', a: 'izquierda', w: 2 },
  { t: 'El barco va al norte y a babor avisto un faro; si después doy media vuelta, el faro queda a', a: 'estribor', w: 1 },
  { t: 'Voy en bici hacia el oeste y el sol del amanecer me da en la', a: 'espalda', w: 2 },
  { t: 'La grúa mira al este y rota su brazo media vuelta; ahora la pluma señala al', a: 'oeste', w: 1 },
  { t: 'Saludo con mi mano izquierda a alguien sentado frente a mí; desde su perspectiva el saludo llega por su lado', a: 'derecho', w: 2 },
  { t: 'Giro tres cuartos de vuelta a la derecha partiendo de mirar al norte; acabo mirando al', a: 'oeste', w: 1 },
  { t: 'El avión despega al norte, gira a estribor y sube; ahora vuela rumbo al', a: 'este', w: 1 },
  { t: 'Estamos cara a cara dándonos la mano; mi pulgar derecho toca tu pulgar', a: 'derecho', w: 1 },
  { t: 'El caballo del jinete que viene de frente cojea de su pata izquierda; yo la veo a mí', a: 'derecha', w: 1 },
  { t: 'Camino de espaldas hacia el sur y giro la cabeza a mi derecha; miro hacia el', a: 'este', w: 1 },
  // ── deducción de solución única ──
  { t: 'Cuatro corredores: Ana llegó tras Bea, Bea tras Cid, Cid tras Dux. El primero en cruzar fue', a: 'Dux', w: 1 },
  { t: 'En círculo de tres, Gus va a la derecha de Tin, y Tin a la de Beo; a la derecha de Gus va', a: 'Beo', w: 2 },
  { t: 'Ren llegó antes que Sol pero después que Tao; nadie llegó entre Ren y Tao. Justo antes de Ren llegó', a: 'Tao', w: 1 },
  { t: 'Tres corredores: gorra no llegó último y bufanda llegó primera; el último fue el de', a: 'guantes', w: 1 },
  { t: 'Bru no usó rojo ni azul, Cor no usó azul, y alguien sí usó azul: fue', a: 'Dani', w: 1 },
  // ── simulación espacial / estado ──
  { t: 'Apilo platos: primero el hondo, luego el llano, encima el de postre; el que toca la mesa es el', a: 'hondo', w: 1 },
  { t: 'Tengo cartas boca abajo D, F, H, J; doy la vuelta a la pila entera; ahora la de arriba es la', a: 'J', w: 1 },
  { t: 'Toallas de abajo arriba: amarilla, rosa, lila, verde; quito las dos de arriba; queda la', a: 'rosa', w: 1 },
  { t: 'Tres anillas en un palo: ancha, media, fina de abajo arriba; saco la de arriba y la pongo abajo; ahora arriba está la', a: 'media', w: 1 },
  { t: 'Cinco fichas en torre: 2,4,6,8,10 de arriba abajo; intercambio la primera con la última; ahora la cima marca', a: '10', w: 1 },
  { t: 'Apilo cubos de menor a mayor empezando arriba; luego volteo la torre; el cubo más grande queda ahora', a: 'arriba', w: 1 },
  { t: 'Tres vasos boca abajo, volteo el 1 y el 3, luego el 2 y el 3; al final boca arriba quedan el 1 y el', a: '2', w: 1 },
  { t: 'Apilo monedas de 1, 2 y 5; cambio la de arriba por la del medio; ahora arriba está la de', a: '2', w: 1 },
  { t: 'En estantería pongo A sobre B sobre C; quito C de debajo y lo poso encima de A; el que ahora toca el estante es', a: 'B', w: 1 },
  { t: 'Cola de tres taquillas: delante Bea, detrás Ciro, último Dani; Bea se va y Dani corre al frente; segundo queda', a: 'Ciro', w: 1 },
  { t: 'Pila de bandejas 7,3,5,1 de abajo arriba; quito las dos de arriba; la cima la marca ahora el', a: '3', w: 1 },
  { t: 'En mesa pongo de izquierda a derecha sal, aceite, pan; giro el conjunto 180 grados; a la izquierda queda ahora el', a: 'pan', w: 1 },
  { t: 'Tula en lirio 1, Veni en el 2, Zoa en el 3; Tula salta al 3, Zoa al 1; en el centro sigue', a: 'Veni', w: 1 },
  { t: 'Apilo sombreros: copa abajo, gorra, boina arriba; saco el de en medio y lo pongo encima; ahora arriba está la', a: 'gorra', w: 1 },
  { t: 'Cola: Mara, luego Nilo, luego Olga; entra Pol y se cuela tras Mara; tercero queda ahora', a: 'Nilo', w: 1 },
  { t: 'Apilo abajo-arriba parda, beis, crema; cambio la del medio con la de abajo; en medio queda la', a: 'parda', w: 1 },
  // ── orden causal y temporal ──
  { t: 'Apilé los libros: el rojo bajo el azul, y el verde sobre el azul; el de más arriba es el', a: 'verde', w: 1 },
  { t: 'El autobús pasa cada 15 minutos; el último fue a las 8:50, así que el siguiente es a las', a: 'nueve y cinco', w: 1 },
  { t: 'Pongo el pollo 40 minutos al horno; quiero comer a las 2, así que debo encenderlo a la', a: 'una y veinte', w: 1 },
  { t: 'Tomo la pastilla cada 8 horas; la tomé a las 7 de la mañana, la próxima es a las', a: 'tres', w: 1 },
  { t: 'Subí dos pisos, bajé uno y subí tres; partí del 4 y acabé en el piso', a: 'ocho', w: 1 },
  { t: 'El huevo cuece en 7 minutos; lo eché al agua a las 9:58, estará listo a las', a: 'diez y cinco', w: 1 },
  { t: 'El tren tarda 50 min y sale a las 6:40; si quiero llegar a las 7:30 llego con margen de', a: 'cero', w: 1 },
  { t: 'Eché tres monedas al bote: 50 c, luego 20, luego 10; la del medio fue la de', a: 'veinte', w: 1 },
  { t: 'La reunión dura 90 min y empieza a las 16:45; acabará a las', a: 'seis y cuarto', w: 1 },
  { t: 'Salté del azulejo 3 al 7, retrocedí 2 y avancé 4; acabé en el azulejo', a: 'nueve', w: 1 },
  { t: 'La vela mide 12 cm y baja 2 por hora; se encendió a las 5, se apagará a las', a: 'once', w: 1 },
  { t: 'Giré a la derecha tres veces seguidas, así que ahora miro como si hubiera girado una vez', a: 'a la izquierda', w: 1 },
  { t: 'Mezclé la pintura: primero azul, luego rojo, al final amarillo; el penúltimo color fue el', a: 'rojo', w: 1 },
  // ── número por restricciones — calcular, nunca recordar ──
  { t: 'Busco un número de dos cifras, múltiplo de 7 y cuyas cifras suman 11; es el', a: '56', w: 0 },
  { t: 'Pienso un número entre 40 y 60, múltiplo de 9 y par; es el', a: 'cincuenta y cuatro', w: 0 },
  { t: 'El número es primo, está entre 50 y 70 y acaba en 9; ese número es el', a: '59', w: 0 },
  { t: 'Quiero un número de tres cifras iguales que sea múltiplo de 5; es el', a: '555', w: 0 },
  { t: 'Hay un número par entre 70 y 80 cuyas cifras suman 13; es el', a: '76', w: 0 },
  { t: 'Pienso un cuadrado perfecto de dos cifras que es múltiplo de 4 y mayor que 50; es el', a: '64', w: 0 },
  { t: 'El número es impar, mayor que 20, menor que 30 y múltiplo de 5; es el', a: '25', w: 0 },
  { t: 'Quiero un número de dos cifras donde las decenas triplican a las unidades y suman 8; es el', a: '62', w: 0 },
  { t: 'Hay un primo entre 30 y 40 cuyas cifras suman 10; es el', a: '37', w: 0 },
  { t: 'Busco un múltiplo de 8 entre 50 y 70 cuyas cifras suman 11; es el', a: '56', w: 0 },
  { t: 'Pienso un número par de dos cifras, múltiplo de 11, mayor que 70; es el', a: '88', w: 0 },
  { t: 'Es múltiplo de 3 y de 5, mayor que 40 y menor que 50: ese número es el', a: '45', w: 0 },
  { t: 'Quiero un cubo perfecto de dos cifras menor que 50; es el', a: '27', w: 0 },
  { t: 'Hay un número impar entre 80 y 90 cuyas cifras suman 17; es el', a: '89', w: 0 },
  { t: 'Busco un múltiplo de 7 entre 60 y 80 cuyas cifras suman 9; es el', a: '63', w: 0 },
  { t: 'Busco un primo entre 40 y 50 cuyas cifras suman 5; es el', a: '41', w: 0 },
  { t: 'Pienso un número par de tres cifras, capicúa, menor que 250 y múltiplo de 11; es el', a: '242', w: 0 },
  { t: 'Quiero un número de dos cifras donde la unidad es 4 más que la decena y suman 10; es el', a: '37', w: 0 },
  // ── edades / álgebra — plantear y resolver ──
  { t: 'Tengo el cuádruple de años que mi sobrina; dentro de 6 años le doblaré, así que ahora ella tiene', a: 'tres', w: 0 },
  { t: 'La suma de las edades de Nora y su abuelo es 70 y él le saca 56 años; Nora tiene', a: '7', w: 0 },
  { t: 'Hace 8 años Iván tenía la mitad de los que tendrá dentro de 4, luego hoy tiene', a: '20', w: 0 },
  { t: 'Dos hermanos suman 40 años y el mayor tiene 6 más que el menor; el menor tiene', a: '17', w: 0 },
  { t: 'Si a la edad de Lucía le restas su tercera parte quedan 18, entonces Lucía tiene', a: '27', w: 0 },
  { t: 'Mi padre tiene 33 años más que yo y juntos sumamos 51; yo tengo', a: '9', w: 0 },
  { t: 'Dentro de 9 años Tomás tendrá el doble de los que tenía hace 6, así que ahora tiene', a: '21', w: 0 },
  { t: 'Una madre tiene 5 veces los años de su hija y la diferencia es 28; la hija tiene', a: '7', w: 0 },
  { t: 'Si dentro de 4 años mi gato tendrá el triple de edad que hace 2 años, ahora tiene', a: '5', w: 0 },
  { t: 'Hoy Elsa tiene 12 y su tía 39; la tía doblará a Elsa dentro de', a: '15', w: 0 },
  { t: 'La edad de Marcos más la de su hijo es 48 y Marcos triplica al hijo; el hijo tiene', a: '12', w: 0 },
  { t: 'Hace 5 años yo tenía cuatro veces los de mi prima y hoy ella tiene 10; yo tengo', a: '25', w: 0 },
  { t: 'Si sumo mi edad a su mitad obtengo 36, entonces tengo exactamente', a: '24', w: 0 },
  { t: 'Pedro le saca 21 años a Sara y dentro de 7 le doblará; ahora Sara tiene', a: '14', w: 0 },
  { t: 'Dos amigas tienen edades que se diferencian en 9 y cuyo cociente es 4; la menor tiene', a: '3', w: 0 },
  { t: 'Mi abuela tenía 26 al nacer mi madre, que tenía 24 al nacer yo; hoy tengo 8 y ella tiene', a: '58', w: 0 },
  { t: 'Si a mi edad le sumo 7 y multiplico por 2 obtengo 50; mi edad es', a: '18', w: 0 },
  { t: 'Carla tiene el triple que Dani y hace 4 años tenía el quíntuple; hoy Dani tiene', a: '8', w: 0 },
  // ── proporciones — calcular ──
  { t: 'Si un ciclista a 24 km/h tarda 25 minutos, a 30 km/h tardará', a: '20 minutos', w: 0 },
  { t: 'Para 8 raciones de sopa uso 1,2 litros de caldo; para 14 raciones usaré', a: '2,1 litros', w: 0 },
  { t: 'Una fuente echa 45 litros cada 9 minutos; en media hora echará', a: '150 litros', w: 0 },
]

/** Build the full corpus — every entry is reasoning-only (see {@link GEMS}). */
export function buildCorpus(): Phrase[] {
  return GEMS.slice()
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
  /**
   * The thesis phrase (matched on `t`). It is lifted out of the sea entirely and
   * returned as the centred {@link Hero}; its blank carries the one KIT_BLUE accent.
   */
  accentText?: string
  /** Hero cap-height as a multiple of the legibility floor. Default 6.0 (≈ 3× the sea foreground). */
  heroCapMultiple?: number
  /** Target characters per hero line — drives how the thesis wraps. Default 28. */
  heroLineChars?: number
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

/**
 * The thesis phrase, lifted out of the sea and rendered as one large, dead-centre
 * line block — «destacada, en el centro, en grande». Its blank is the wall's one
 * KIT_BLUE accent: the disciplined point the whole sea is built to make you find.
 */
export type Hero = {
  /** The phrase text (everything before the blank). */
  text: string
  /** The omitted answer — never rendered; it only sizes the blank. */
  answer: string
  /** The phrase pre-wrapped into balanced lines (render each as its own line box). */
  lines: string[]
  /** Font size (pt) — feed to `geo.pt`. */
  fontPt: number
  /** Rendered cap-height (mm). */
  capMm: number
  /** Em box height (mm). */
  emMm: number
  /** Line advance (mm) between hero lines. */
  lineHeightMm: number
  /** Width of the blank rule (mm). */
  blankWidthMm: number
  /** Gap before the blank (mm). */
  blankGapMm: number
  /** Bounding box of the hero stack (mm). */
  box: { wMm: number; hMm: number }
  /** Centre of the hero on the wall (mm from the trim origin). */
  centerXMm: number
  centerYMm: number
}

export type SeaLayout = {
  placed: PlacedPhrase[]
  /** The thesis, promoted to a centred hero (null when no `accentText` is given / found). */
  hero: Hero | null
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

/** Greedy word-wrap into lines no longer than `maxChars` (a line never splits a word). */
function wrapWords(words: string[], maxChars: number): string[] {
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const cand = cur ? `${cur} ${w}` : w
    if (cur === '' || cand.length <= maxChars) cur = cand
    else {
      lines.push(cur)
      cur = w
    }
  }
  if (cur) lines.push(cur)
  return lines
}

type HeroOpts = {
  usable: { x: number; y: number; w: number; h: number }
  floorCapMm: number
  heroCapMultiple: number
  heroLineChars: number
  avgCharEm: number
  trimWidthMm: number
  trimHeightMm: number
}

/** Size and wrap the thesis into a centred hero, anchored to the legibility floor. */
function buildHero(phrase: Phrase, o: HeroOpts): Hero {
  let capMm = o.floorCapMm * o.heroCapMultiple
  let emMm = capMm / TEXT_CAP_RATIO
  const lines = wrapWords(phrase.t.split(/\s+/), Math.max(8, Math.round(o.heroLineChars)))
  const blankChars = Math.max(2, Math.min(9, phrase.a.length))

  // Width of the widest line, with the blank tacked onto the last one.
  const widest = (em: number) => {
    const charMm = o.avgCharEm * em
    const blankWidthMm = Math.max(1.8, blankChars * o.avgCharEm) * em
    const blankGapMm = 0.45 * em
    let w = 0
    lines.forEach((ln, i) => {
      const lw = ln.length * charMm + (i === lines.length - 1 ? blankGapMm + blankWidthMm : 0)
      if (lw > w) w = lw
    })
    return { w, blankWidthMm, blankGapMm }
  }

  // Shrink to fit the usable width if the big size overruns the wall.
  let m = widest(emMm)
  if (m.w > o.usable.w * 0.94) {
    const k = (o.usable.w * 0.94) / m.w
    emMm *= k
    capMm *= k
    m = widest(emMm)
  }

  const lineHeightMm = emMm * 1.12
  return {
    text: phrase.t,
    answer: phrase.a,
    lines,
    fontPt: capHeightMmToFontPt(capMm, TEXT_CAP_RATIO),
    capMm,
    emMm,
    lineHeightMm,
    blankWidthMm: m.blankWidthMm,
    blankGapMm: m.blankGapMm,
    box: { wMm: m.w, hMm: lines.length * lineHeightMm },
    centerXMm: o.trimWidthMm / 2,
    centerYMm: o.trimHeightMm / 2,
  }
}

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
    heroCapMultiple = 6.0,
    heroLineChars = 28,
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

  // Lift the thesis out of the sea: it becomes the centred hero, not a sea phrase.
  const accentPhrase = accentText != null ? phrases.find((p) => p.t === accentText) ?? null : null
  const seaPhrases = accentPhrase ? phrases.filter((p) => p.t !== accentText) : phrases
  const hero = accentPhrase
    ? buildHero(accentPhrase, {
        usable,
        floorCapMm,
        heroCapMultiple,
        heroLineChars,
        avgCharEm,
        trimWidthMm,
        trimHeightMm,
      })
    : null

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
    const order = shuffle(seaPhrases, mulberry32(seed + 0x9e37 * (pass + 1)))
    bag = order.map((p) => prepare(p, pickTier(rng, p.w ?? 1, nTiers)))
    pass++
  }
  const next = (): Prepared => {
    if (bag.length === 0) refill()
    return bag.shift() as Prepared
  }

  const placed: PlacedPhrase[] = []
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
        accent: false,
      })
    }
    y += shelfEm * (1.04 + rng() * 0.1)
  }

  return { placed, hero, floorCapMm, usable, tierCapsMm }
}
