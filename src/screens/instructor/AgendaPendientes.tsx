import { useState } from 'react'
import { Ic, Card } from '../../components/ui'
import type { IcName } from '../../components/ui'
import { CenterState } from '../shared/parts'
import { faseFicha, FASE_META } from '../shared/fichaFase'
import type { CategoriaPendiente, FichaInstructor, GrupoPendiente, Pendiente, PendientesInstructor, TabEtapa } from './types'

// ─── Pendientes: el asistente de la Agenda ───────────────────────────────────
// Todo lo que el instructor tiene por hacer o vigilar (momentos, visitas,
// fichas y alertas), organizado en una tarjeta por ficha. Cada
// pendiente es una frase que ya redactó el backend (instructores/pendientes.ts)
// y lleva a donde se resuelve.

// El color es solo acento (punto, barra, fondo suave): los números van en
// tinta normal. Tonos bien separados para que urgente y "te toca" no se
// confundan de un vistazo.
const GRUPO: Record<GrupoPendiente, { label: string; hint: string; color: string; suave: string }> = {
  URGENTE: { label: 'Urgente',      hint: 'Ya se pasó la fecha',               color: 'var(--fx-atraso)', suave: 'var(--fx-atraso-suave)' },
  TE_TOCA: { label: 'Te toca',      hint: 'Depende de ti y ya puedes hacerlo', color: 'var(--fx-aviso)', suave: 'var(--fx-aviso-suave)' },
  VIGILAR: { label: 'Para vigilar', hint: 'Lo debe otro; solo para estar al tanto', color: 'var(--fx-tinta-2)', suave: 'var(--fx-superficie-1)' },
}
const GRUPOS: GrupoPendiente[] = ['URGENTE', 'TE_TOCA', 'VIGILAR']

const CATEGORIA: Record<CategoriaPendiente, { label: string; singular: string; icon: IcName }> = {
  MOMENTO:  { label: 'Momentos',  singular: 'Momento', icon: 'fileText' },
  VISITA:   { label: 'Visitas',   singular: 'Visita',  icon: 'calendar' },
  FICHA:    { label: 'Fichas',    singular: 'Ficha',   icon: 'folder' },
  ALERTA:   { label: 'Alertas',   singular: 'Alerta',  icon: 'bell' },
}
const CATEGORIAS = Object.keys(CATEGORIA) as CategoriaPendiente[]

// Pendientes que se ven de entrada en cada tarjeta; el resto, con "ver más".
const VISIBLES = 4

interface GrupoFicha {
  fichaId: number
  numero: string
  ficha: FichaInstructor | null
  items: Pendiente[]
  cuenta: Record<GrupoPendiente, number>
}

function agruparPorFicha(pendientes: Pendiente[], fichas: FichaInstructor[]): GrupoFicha[] {
  const mapa = new Map<number, GrupoFicha>()
  const nuevo = (fichaId: number, numero: string, ficha: FichaInstructor | null): GrupoFicha =>
    ({ fichaId, numero, ficha, items: [], cuenta: { URGENTE: 0, TE_TOCA: 0, VIGILAR: 0 } })

  for (const p of pendientes) {
    if (p.ficha_id == null) continue
    let g = mapa.get(p.ficha_id)
    if (!g) {
      g = nuevo(p.ficha_id, p.numero_ficha ?? String(p.ficha_id), fichas.find(f => f.id === p.ficha_id) ?? null)
      mapa.set(p.ficha_id, g)
    }
    g.items.push(p)
    g.cuenta[p.grupo]++
  }
  // Dentro de la tarjeta, urgentes primero (el backend ya ordena por fecha).
  const rango = (p: Pendiente) => GRUPOS.indexOf(p.grupo)
  for (const g of mapa.values()) g.items.sort((a, b) => rango(a) - rango(b))
  // Primero la ficha con más urgentes; a igualdad, más "te toca", etc.
  return [...mapa.values()].sort((a, b) =>
    b.cuenta.URGENTE - a.cuenta.URGENTE ||
    b.cuenta.TE_TOCA - a.cuenta.TE_TOCA ||
    b.cuenta.VIGILAR - a.cuenta.VIGILAR ||
    a.numero.localeCompare(b.numero))
}

function TarjetaFicha({ g, onVerEtapa, onVerFicha }: {
  g: GrupoFicha
  onVerEtapa: (etapaId: number, tab: TabEtapa | null) => void
  onVerFicha: (fichaId: number) => void
}) {
  "use no memo"
  const [todos, setTodos] = useState(false)
  const fase = g.ficha ? FASE_META[faseFicha(g.ficha)] : null
  const visibles = todos ? g.items : g.items.slice(0, VISIBLES)
  const ocultos = g.items.length - visibles.length

  function abrir(p: Pendiente) {
    if (p.etapa_id) onVerEtapa(p.etapa_id, p.tab)
    else onVerFicha(g.fichaId)
  }

  return (
    <div className="card pf-card">
      <button className="pf-head" onClick={() => onVerFicha(g.fichaId)} title="Abrir ficha">
        <span className="pf-head__cuerpo">
          <span className="pf-head__numero">Ficha {g.numero}</span>
          {g.ficha && (
            <span className="pf-head__programa">
              {g.ficha.programa_nombre}
              {fase && <> · {fase.label}</>}
            </span>
          )}
        </span>
        <span className="pf-head__conteos">
          {GRUPOS.filter(x => g.cuenta[x] > 0).map(x => (
            <span key={x} className="pf-badge" title={GRUPO[x].label}
              style={{ color: GRUPO[x].color, background: GRUPO[x].suave }}>
              {g.cuenta[x]}
            </span>
          ))}
        </span>
      </button>

      <div className="pf-items">
        {visibles.map(p => (
          <button key={p.id} className="pf-item" onClick={() => abrir(p)}>
            <span className="pf-item__dot" style={{ background: GRUPO[p.grupo].color }} title={GRUPO[p.grupo].label}/>
            <span className="pf-item__cuerpo">
              <span className="pf-item__linea">
                {/* En pendientes de la ficha misma el título es "Ficha N": sobra. */}
                <span className="pf-item__quien">
                  {p.etapa_id || p.categoria === 'ALERTA' ? p.titulo : 'Toda la ficha'}
                </span>
                <span className="pf-item__cat">
                  <Ic n={CATEGORIA[p.categoria].icon} s={11}/>{CATEGORIA[p.categoria].singular}
                </span>
              </span>
              <span className="pf-item__texto">{p.texto}</span>
            </span>
          </button>
        ))}
      </div>
      {g.items.length > VISIBLES && (
        <button className="pf-mas" onClick={() => setTodos(v => !v)}>
          {todos ? 'Ver menos' : `Ver ${ocultos} más`}
          <Ic n={todos ? 'chevronUp' : 'chevronDown'} s={12}/>
        </button>
      )}
    </div>
  )
}

export function AgendaPendientes({ data, fichas, onVerEtapa, onVerFicha }: {
  data: PendientesInstructor
  fichas: FichaInstructor[]
  onVerEtapa: (etapaId: number, tab: TabEtapa | null) => void
  onVerFicha: (fichaId: number) => void
}) {
  "use no memo"
  const [grupo, setGrupo] = useState<GrupoPendiente | null>(null)
  const [categoria, setCategoria] = useState<CategoriaPendiente | null>(null)

  const { pendientes, conteos } = data
  const filtrando = !!grupo || !!categoria
  const filtrados = pendientes.filter(p =>
    (!grupo || p.grupo === grupo) && (!categoria || p.categoria === categoria))
  const porCategoria = (c: CategoriaPendiente) =>
    pendientes.filter(p => (!grupo || p.grupo === grupo) && p.categoria === c).length
  const tarjetas = agruparPorFicha(filtrados, fichas)
  // Fichas sin ningún pendiente: se nombran en una línea al final (solo sin
  // filtro), para que "no aparece" se lea como "al día" y no como un error.
  const alDia = filtrando ? [] : fichas.filter(f => !pendientes.some(p => p.ficha_id === f.id))

  const conteo: Record<GrupoPendiente, number> = {
    URGENTE: conteos.urgente, TE_TOCA: conteos.te_toca, VIGILAR: conteos.vigilar,
  }

  return (
    <div>
      {data.fallos.length > 0 && (
        <div className="pend-aviso">
          <Ic n="alert" s={14} style={{ color: 'var(--fx-aviso)', flexShrink: 0, marginTop: 1 }}/>
          <span>
            No se pudo revisar: <strong>{data.fallos.join(', ')}</strong>. Los pendientes pueden estar
            incompletos en esa parte.
          </span>
        </div>
      )}

      {/* Los tres grupos son a la vez resumen y filtro. */}
      <div className="card pend-resumen">
        {GRUPOS.map(g => (
          <button
            key={g}
            className={`pend-grupo${grupo === g ? ' pend-grupo--sel' : ''}`}
            onClick={() => setGrupo(x => (x === g ? null : g))}
            aria-pressed={grupo === g}
            style={{ '--pend-color': GRUPO[g].color, '--pend-suave': GRUPO[g].suave } as React.CSSProperties}
          >
            <span className="pend-grupo__label">
              <span className="pend-grupo__dot"/>{GRUPO[g].label}
            </span>
            <span className="pend-grupo__valor">{conteo[g]}</span>
            <span className="pend-grupo__hint">{GRUPO[g].hint}</span>
          </button>
        ))}
      </div>

      <div className="pend-cats">
        <button className={`pend-cat${!categoria ? ' pend-cat--sel' : ''}`} onClick={() => setCategoria(null)}>
          Todo
        </button>
        {CATEGORIAS.map(c => {
          const n = porCategoria(c)
          if (n === 0 && categoria !== c) return null
          return (
            <button key={c} className={`pend-cat${categoria === c ? ' pend-cat--sel' : ''}`} onClick={() => setCategoria(x => (x === c ? null : c))}>
              <Ic n={CATEGORIA[c].icon} s={12}/>{CATEGORIA[c].label}
              <span className="pend-cat__n">{n}</span>
            </button>
          )
        })}
      </div>

      {tarjetas.length === 0 ? (
        <Card style={{ padding: 28 }}>
          {filtrando
            ? <CenterState icon="filter" title="Nada con ese filtro" sub="Quita el filtro para ver el resto de pendientes."/>
            : <CenterState icon="checkCircle" title="Todo al día" sub="No tienes pendientes en ninguna de tus fichas."/>}
        </Card>
      ) : (
        <div className="pf-grid">
          {tarjetas.map(g => (
            <TarjetaFicha key={g.fichaId} g={g} onVerEtapa={onVerEtapa} onVerFicha={onVerFicha}/>
          ))}
        </div>
      )}

      {alDia.length > 0 && (
        <div className="pf-aldia">
          <Ic n="checkCircle" s={14} style={{ color: 'var(--fx-ok)', flexShrink: 0 }}/>
          <span>Al día:</span>
          {alDia.map(f => (
            <button key={f.id} className="pf-aldia__ficha" onClick={() => onVerFicha(f.id)} title={f.programa_nombre}>
              {f.numero_ficha}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
