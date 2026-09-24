// "Mis fichas" del instructor en el Home, como carpetas: los aprendices viven
// dentro y asoman apilados por encima, y la mitad inferior es una cortina con
// backdrop-filter sobre la que va el texto -- por eso se alcanza a ver el
// contenido difuminado de fondo.
//
// Cada item es un aprendiz con su caso (los mismos 5 de AprendicesPractica,
// que vienen de /fichas/:id/detalle). Van apilados juntos, desfasados apenas
// lo necesario para leer el nombre del que está detrás, y en hover los tres se
// separan en paralelo. El color del caso se usa sutil: un punto, no un bloque.
import { Ic } from '../../components/ui'
import { CASO_META } from '../shared/AprendicesPractica'
import type { AprendizPractica, CasoAprendizPractica } from '../shared/AprendicesPractica'
import { faseFicha, FASE_META } from '../shared/fichaFase'
import { jornadaLabel } from '../shared/parts'
import type { FichaInstructor, AgendaItem } from './types'

// Mismo texto/colores que diasChip en FichasInstructorTable, para no decir
// "vencida" en una vista y "atrasada" en otra.
function diasTxt(d: number | null): { txt: string; color: string } {
  if (d == null) return { txt: 'sin fecha de cierre', color: '#a1a1aa' }
  if (d < 0) return { txt: `${Math.abs(d)} d vencida`, color: '#dc2626' }
  if (d === 0) return { txt: 'cierra hoy', color: '#c2410c' }
  return { txt: `faltan ${d} d`, color: d <= 30 ? '#c2410c' : '#a1a1aa' }
}

// Orden en que se asoman los aprendices en la carpeta. Al frente va el que
// está EN_CURSO -- es el trabajo del día a día del instructor -- y detrás los
// demás casos por lo que exigen atención. No es el orden del roster
// (CASO_ORDER, que va de "ya terminó" a "crítico").
const ORDEN_PILA: CasoAprendizPractica[] = [
  'EN_CURSO',
  'SIN_ALTERNATIVA',
  'LISTO_PARA_INICIAR',
  'TERMINADA_SIN_JUICIO',
  'CONCLUIDA',
]

// Tinte suave por caso. Es lo que se alcanza a ver difuminado tras la cortina
// (sin color, el blur sobre tarjetas blancas no se nota) y lo que hace que la
// pila se lea como casos distintos, sin recurrir a bloques saturados.
const CASO_TINTE: Record<CasoAprendizPractica, { bg: string; bd: string }> = {
  SIN_ALTERNATIVA:      { bg: '#fef2f2', bd: '#fee2e2' },
  LISTO_PARA_INICIAR:   { bg: '#fffbeb', bd: '#fef3c7' },
  EN_CURSO:             { bg: '#eef2ff', bd: '#e0e7ff' },
  TERMINADA_SIN_JUICIO: { bg: '#ecfeff', bd: '#cffafe' },
  CONCLUIDA:            { bg: '#f0fdf4', bd: '#dcfce7' },
}

function nombreCorto(nombre: string): string {
  const p = nombre.trim().split(/\s+/)
  return p.length <= 2 ? nombre : `${p[0]} ${p[p.length - 2]}`
}

// Muestra casos distintos en vez de tres veces el mismo: uno por caso. Al
// frente siempre el primero de ORDEN_PILA (el que está en curso), y de ahí en
// adelante el resto va rotado según la ficha, para que la segunda capa no sea
// siempre la misma. La rotación va sembrada con el id de la ficha y no con
// Math.random: así varía entre carpetas pero no cambia en cada render.
function muestraVariada(ordenados: AprendizPractica[], cupos: number, semilla: number): AprendizPractica[] {
  const vistos = new Set<CasoAprendizPractica>()
  const porCaso: AprendizPractica[] = []
  for (const a of ordenados) {
    if (vistos.has(a.caso)) continue
    vistos.add(a.caso)
    porCaso.push(a)
  }

  const elegidos = porCaso.slice(0, 1)
  const resto = porCaso.slice(1)
  if (resto.length > 0) {
    const off = Math.abs(semilla) % resto.length
    elegidos.push(...resto.slice(off), ...resto.slice(0, off))
  }
  for (const a of ordenados) {
    if (elegidos.length >= cupos) break
    if (!elegidos.includes(a)) elegidos.push(a)
  }
  return elegidos.slice(0, cupos)
}

function FolderCard({ f, roster, atrasadosF, onOpen }: {
  f: FichaInstructor
  roster: AprendizPractica[] | undefined
  atrasadosF: AgendaItem[]
  onOpen: (f: FichaInstructor) => void
}) {
  const fase = faseFicha(f)
  const meta = FASE_META[fase]
  const total = f.aprendices_en_seguimiento
  const alDia = Math.max(0, total - atrasadosF.length)
  const pct = total > 0 ? Math.round((alDia / total) * 100) : 100
  const dias = diasTxt(f.dias_restantes)

  const ordenados = [...(roster ?? [])].sort(
    (a, b) => ORDEN_PILA.indexOf(a.caso) - ORDEN_PILA.indexOf(b.caso),
  )
  // Siempre 3 capas: si hay más de 3 aprendices, la del fondo dice cuántos más.
  const sobran = ordenados.length - 3
  const visibles = muestraVariada(ordenados, sobran > 0 ? 2 : 3, f.id)
  const restantes = sobran > 0 ? ordenados.length - 2 : 0

  // slot 1 = al frente. Se pinta del último al primero para que el z-index
  // natural deje al más urgente arriba.
  const capas = [
    ...visibles.map((a, i) => ({ key: `a${i}`, slot: (i + 1) as 1 | 2 | 3, aprendiz: a })),
    ...(restantes > 0 ? [{ key: 'mas', slot: 3 as const, aprendiz: null }] : []),
  ]

  return (
    <div className="folder-card" onClick={() => onOpen(f)}>
      <div className="folder-stack">
        {[...capas].reverse().map(c => (
          c.aprendiz ? (
            <div
              key={c.key}
              className={`folder-item folder-item--${c.slot}`}
              style={{
                background: CASO_TINTE[c.aprendiz.caso].bg,
                borderColor: CASO_TINTE[c.aprendiz.caso].bd,
              }}
            >
              <div className="folder-item__head">
                <span className="folder-item__dot" style={{ background: CASO_META[c.aprendiz.caso].color }}/>
                <span className="folder-item__name">{nombreCorto(c.aprendiz.nombre_completo)}</span>
              </div>
              <div className="folder-item__estado" style={{ color: CASO_META[c.aprendiz.caso].color }}>
                {CASO_META[c.aprendiz.caso].label}
              </div>
            </div>
          ) : (
            <div key={c.key} className={`folder-item folder-item--${c.slot} folder-item--mas`}>
              <div className="folder-item__head">
                <span className="folder-item__name">+{restantes} aprendices más</span>
              </div>
            </div>
          )
        ))}

        {capas.length === 0 && (
          <div className="folder-item folder-item--1 folder-item--mas">
            <div className="folder-item__head">
              <span className="folder-item__name">
                {roster ? 'Sin aprendices en el reporte' : 'Cargando aprendices…'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* La cortina: mitad inferior con blur sobre los aprendices. */}
      <div className="folder-curtain">
        <div className="folder-card__kind">
          <Ic n="folder" s={12}/> Ficha <span style={{ color: meta.fg }}>· {meta.label}</span>
        </div>
        <div className="folder-card__title">{f.programa_nombre}</div>
        <div className="folder-card__sub">
          <span style={{ fontFamily: '"JetBrains Mono", monospace' }}>#{f.numero_ficha}</span>
          {' · '}{jornadaLabel(f.jornada)}{f.sede ? ` · ${f.sede}` : ''}
        </div>

        <div className="prog" style={{ marginTop: 12 }}>
          <div className="prog__track" style={{ height: 6, borderRadius: 6 }}>
            <div className="prog__fill" style={{ width: `${pct}%`, background: atrasadosF.length ? '#dc2626' : '#16a34a', borderRadius: 6 }}/>
          </div>
        </div>

        <div className="folder-card__stats">
          <span>{alDia}/{total || 0} al día</span>
          <span style={{ color: dias.color }}>{dias.txt}</span>
        </div>
      </div>
    </div>
  )
}

function groupByFicha(items: AgendaItem[]): Record<string, AgendaItem[]> {
  return items.reduce<Record<string, AgendaItem[]>>((acc, it) => {
    (acc[it.numero_ficha] ??= []).push(it)
    return acc
  }, {})
}

export function FichaFolderCards({ fichas, rosters, atrasados, onOpen }: {
  fichas: FichaInstructor[]
  rosters: Record<number, AprendizPractica[]>
  atrasados: AgendaItem[]
  onOpen: (f: FichaInstructor) => void
}) {
  const atrasadosPorFicha = groupByFicha(atrasados)
  return (
    <div className="folder-grid">
      {fichas.map(f => (
        <FolderCard
          key={f.id}
          f={f}
          roster={rosters[f.id]}
          atrasadosF={atrasadosPorFicha[f.numero_ficha] ?? []}
          onOpen={onOpen}
        />
      ))}
    </div>
  )
}
