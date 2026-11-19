import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Ic, Btn, Bdg, Modal } from '../../components/ui'
import { InlineAlert, CenterState, LoadingBlock, Seg, fd, centroLabel } from '../shared/parts'
import api from '../../lib/api'
import {
  coordCorta, mensajeError, n, descargarCatalogo,
} from './integridadComun'
import type { Coordinacion, Regla, Importacion } from './integridadComun'
import './CatalogoVista.css'

// ─── Catálogo: seguimiento de la asignación de coordinaciones ────────────────
// Lo primero que se ve es cuántas fichas de cada centro ya tienen coordinación
// (el objetivo es llegar al 100%). El detalle por coordinación se abre al tocar
// un centro, y las reglas del catálogo (registros) quedan en un panel lateral.
//
// Cada ficha: con coordinación (según el catálogo, o con coordinación pero su
// registro todavía sin definir) o sin coordinación. Siempre suman el total.

interface Cifras {
  fichas: number; coincide: number
  no_coincide: number; no_coincide_distinta: number; no_coincide_sin_regla: number
  sin_coordinacion: number; sin_resuelve: number; sin_regla: number
}
interface CoordConciliada {
  id: number; nombre: string; activa: boolean; coordinador_nombre: string | null; reglas: number
  total: Cifras; vigentes: Cifras
}
interface CentroConciliado {
  id: number; nombre: string; codigo: string; total: Cifras; vigentes: Cifras
  reglas: number; reglas_incompletas: number; coordinaciones: CoordConciliada[]
}
interface CatalogoData {
  forma_inicio: string; coordinaciones: Coordinacion[]; conciliacion: CentroConciliado[]; reglas: Regla[]
}

type Alcance = 'vigentes' | 'total'

// Un color por centro, estable por código.
const TONOS: Record<string, string> = { '9302': '#6366f1', '9207': '#0ea5a4', '9208': '#f97316', '9103': '#22c55e' }
const TONOS_EXTRA = ['#a855f7', '#ec4899', '#0ea5e9', '#eab308']
const tonoDe = (c: CentroConciliado, i: number) => TONOS[c.codigo] ?? TONOS_EXTRA[i % TONOS_EXTRA.length]

// Iniciales del centro ("Nacional Colombo Alemán" -> "CA").
function sigla(nombre: string): string {
  const pal = centroLabel(nombre).split(/\s+/).filter(p => p.length > 2 && !/^(de|del|la|las|los|para|y)$/i.test(p))
  return (pal.length >= 2 ? pal[pal.length - 2][0] + pal[pal.length - 1][0] : (pal[0] ?? nombre).slice(0, 2)).toUpperCase()
}

const conCoord = (k: Cifras) => k.coincide + k.no_coincide
const pct = (x: number, t: number) => (t ? Math.round((x / t) * 100) : 0)

const reducido = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Cuenta de 0 al valor (o del valor anterior al nuevo) al montar o cambiar.
function useCuenta(valor: number, ms = 900): number {
  const [v, setV] = useState(0)
  const desde = useRef(0)
  const quieto = reducido()
  useEffect(() => {
    if (quieto) return
    const inicio = performance.now()
    const a = desde.current
    let raf = 0
    const paso = (t: number) => {
      const p = Math.min(1, (t - inicio) / ms)
      const e = 1 - Math.pow(1 - p, 3)
      setV(Math.round(a + (valor - a) * e))
      if (p < 1) raf = requestAnimationFrame(paso)
      else desde.current = valor
    }
    raf = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(raf)
  }, [valor, ms, quieto])
  return quieto ? valor : v
}

// Se vuelve true un frame después de montar: dispara las transiciones CSS.
function useMontado(): boolean {
  const [m, setM] = useState(false)
  useEffect(() => { const r = requestAnimationFrame(() => setM(true)); return () => cancelAnimationFrame(r) }, [])
  return m
}

function Anillo({ valor, color, size = 132, grosor = 12 }: { valor: number; color: string; size?: number; grosor?: number }) {
  const montado = useMontado()
  const r = (size - grosor) / 2
  const c = 2 * Math.PI * r
  const mostrado = useCuenta(valor)
  return (
    <div className="cv-anillo" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--cv-pista)" strokeWidth={grosor}/>
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={grosor} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={montado ? c * (1 - valor / 100) : c}
          transform={`rotate(-90 ${size / 2} ${size / 2})`} className="cv-anillo__arco"
        />
      </svg>
      <div className="cv-anillo__centro">
        <b>{mostrado}<small>%</small></b>
        <span>con coordinación</span>
      </div>
    </div>
  )
}

function Numero({ valor }: { valor: number }) {
  return <>{n(useCuenta(valor))}</>
}

// ─── Vista ───────────────────────────────────────────────────────────────────

// Rutas del catálogo: la regional (Integridad) o la de un centro, para el
// subdirector (/catalogo-centro, acotada a su centro en el backend).
const RUTAS = {
  regional: {
    catalogo: '/integridad/catalogo',
    porDefinir: '/integridad/por-asignar/reglas',
    asignar: '/integridad/catalogo/asignar',
    regla: (id: number) => `/integridad/catalogo/${id}`,
  },
  centro: {
    catalogo: '/catalogo-centro',
    porDefinir: '/catalogo-centro/por-asignar/reglas',
    asignar: '/catalogo-centro/asignar',
    regla: (id: number) => `/catalogo-centro/${id}`,
  },
}
const RutasCatalogo = createContext(RUTAS.regional)

export function Catalogo({ deCentro = false }: { deCentro?: boolean }) {
  return (
    <RutasCatalogo.Provider value={deCentro ? RUTAS.centro : RUTAS.regional}>
      <CatalogoInterno deCentro={deCentro}/>
    </RutasCatalogo.Provider>
  )
}

function CatalogoInterno({ deCentro }: { deCentro: boolean }) {
  "use no memo"
  const rutas = useContext(RutasCatalogo)
  const [data, setData] = useState<CatalogoData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [alcance, setAlcance] = useState<Alcance>('vigentes')
  const [sel, setSel] = useState<number | null>(null)
  const [pendientes, setPendientes] = useState<ReglaPorDefinir[] | null>(null)
  const [importar, setImportar] = useState(false)
  const [aplicando, setAplicando] = useState(false)
  const [aviso, setAviso] = useState<{ tono: 'ok' | 'crit'; texto: string } | null>(null)

  function cargar() {
    api.get<CatalogoData>(rutas.catalogo)
      .then(r => setData(r.data))
      .catch(e => setError(mensajeError(e, 'No se pudo cargar el catálogo.')))
    api.get<{ reglas: ReglaPorDefinir[] }>(rutas.porDefinir)
      .then(r => setPendientes(r.data.reglas))
      .catch(() => setPendientes([]))
  }
  // Las rutas no cambian mientras la vista está montada.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(cargar, [])

  if (error) return <CenterState icon="alert" title={error}/>
  if (!data) return <LoadingBlock/>

  const centros = [...data.conciliacion]
    .filter(c => c.total.fichas > 0 || c.reglas > 0)
    .sort((a, b) => b[alcance].fichas - a[alcance].fichas)
  const t = centros.reduce((a, c) => {
    const k = c[alcance]
    return {
      fichas: a.fichas + k.fichas, con: a.con + conCoord(k), sin: a.sin + k.sin_coordinacion,
      resuelve: a.resuelve + k.sin_resuelve, distinta: a.distinta + k.no_coincide_distinta,
    }
  }, { fichas: 0, con: 0, sin: 0, resuelve: 0, distinta: 0 })
  const seleccionado = centros.find(c => c.id === sel) ?? null

  // Si el catálogo ya sabe asignar fichas (llegó un catálogo nuevo o cambió una
  // regla), se ofrece hacerlo en un clic.
  async function ponerAlDia() {
    setAplicando(true); setAviso(null)
    try {
      const incluir_historico = alcance === 'total'
      let total: number
      if (deCentro) {
        const r = await api.post<{ asignadas: number; corregidas: number }>('/catalogo-centro/aplicar', { incluir_historico })
        total = r.data.asignadas + r.data.corregidas
      } else {
        const a = await api.post<{ asignadas: number }>('/integridad/catalogo/aplicar', { incluir_historico })
        const b = await api.post<{ corregidas: number }>('/integridad/catalogo/corregir', { incluir_historico })
        total = a.data.asignadas + b.data.corregidas
      }
      setAviso({ tono: 'ok', texto: `${n(total)} fichas quedaron en la coordinación del catálogo.` })
      cargar()
    } catch (e) {
      setAviso({ tono: 'crit', texto: mensajeError(e, 'No se pudo aplicar el catálogo.') })
    } finally {
      setAplicando(false)
    }
  }

  return (
    <div className="cv">
      <header className="cv-cab">
        <div>
          <h2 className="cv-cab__titulo">Asignación de coordinaciones</h2>
          <p className="cv-cab__sub">Cada ficha debe quedar en la coordinación que dice el catálogo de su centro.</p>
        </div>
        <div className="cv-cab__acciones">
          <Seg name="cv-alcance" value={alcance} onChange={v => setAlcance(v as Alcance)} options={[
            { value: 'vigentes', label: `Vigentes` },
            { value: 'total', label: 'Todas' },
          ]}/>
          {!deCentro && <Btn size="sm" variant="ghost" icon="upload" onClick={() => setImportar(true)}>Importar</Btn>}
          {!deCentro && <Btn size="sm" variant="ghost" icon="download" onClick={() => void descargarCatalogo()}>Excel</Btn>}
        </div>
      </header>

      <section className="cv-hero">
        <div className="cv-hero__num">
          <span className="cv-hero__pct"><Numero valor={pct(t.con, t.fichas)}/><small>%</small></span>
          <span className="cv-hero__txt">
            de las {n(t.fichas)} fichas {alcance === 'vigentes' ? 'vigentes ' : ''}{deCentro ? 'de tu centro' : 'de la regional'} tienen coordinación
            {alcance === 'vigentes' && <em> · desde {fd(data.forma_inicio)}</em>}
          </span>
        </div>
        <BarraRegional con={t.con} sin={t.sin}/>
        <div className="cv-hero__leyenda">
          <span><i className="cv-punto cv-punto--con"/> <b><Numero valor={t.con}/></b> con coordinación</span>
          <span><i className="cv-punto cv-punto--sin"/> <b><Numero valor={t.sin}/></b> sin coordinación</span>
        </div>
      </section>

      {(t.resuelve > 0 || t.distinta > 0) && (
        <div className="cv-pendiente">
          <Ic n="sparkles" s={15}/>
          <span>El catálogo ya sabe dónde van <b>{n(t.resuelve + t.distinta)}</b> fichas.</span>
          <Btn size="sm" icon="check" disabled={aplicando} onClick={() => void ponerAlDia()}>{aplicando ? 'Aplicando…' : 'Aplicar'}</Btn>
        </div>
      )}
      {aviso && <InlineAlert tone={aviso.tono} icon={aviso.tono === 'ok' ? 'checkCircle' : 'alert'}>{aviso.texto}</InlineAlert>}

      <section className="cv-grid">
        {centros.map((c, i) => (
          <TarjetaCentro
            key={c.id} c={c} k={c[alcance]} tono={tonoDe(c, i)} orden={i}
            activo={sel === c.id} onClick={() => setSel(sel === c.id ? null : c.id)}
          />
        ))}
      </section>

      {seleccionado && (
        <DetalleCentro
          key={`${seleccionado.id}-${alcance}`}
          c={seleccionado} alcance={alcance} tono={tonoDe(seleccionado, centros.indexOf(seleccionado))}
          reglas={data.reglas.filter(r => r.centro_formacion_id === seleccionado.id)}
          pendientes={(pendientes ?? []).filter(r => r.centro_formacion_id === seleccionado.id)}
          coordinaciones={data.coordinaciones.filter(co => co.centro_formacion_id === seleccionado.id)}
          onCambio={cargar} onCerrar={() => setSel(null)}
        />
      )}
      {!seleccionado && <p className="cv-pista">Toca un centro para ver sus coordinaciones y editar sus reglas.</p>}
      {importar && (
        <Modal title="Importar catálogo de un centro" icon="upload" onClose={() => setImportar(false)} width={620}>
          <ImportarConsolidado onImportado={cargar}/>
        </Modal>
      )}
    </div>
  )
}

function BarraRegional({ con, sin }: { con: number; sin: number }) {
  const montado = useMontado()
  const total = con + sin
  return (
    <div className="cv-barra" aria-hidden>
      <span className="cv-barra__con" style={{ width: montado && total ? `${(con / total) * 100}%` : '0%' }}/>
      <span className="cv-barra__sin" style={{ width: montado && total ? `${(sin / total) * 100}%` : '0%' }}/>
    </div>
  )
}

function TarjetaCentro({ c, k, tono, orden, activo, onClick }: {
  c: CentroConciliado; k: Cifras; tono: string; orden: number; activo: boolean; onClick: () => void
}) {
  const con = conCoord(k)
  const alDia = k.fichas > 0 && k.sin_coordinacion === 0
  return (
    <button
      type="button" onClick={onClick} aria-pressed={activo}
      className={`cv-tarjeta${activo ? ' cv-tarjeta--activa' : ''}`}
      style={{ '--tono': tono, animationDelay: `${orden * 90}ms` } as CSSProperties}
    >
      <div className="cv-tarjeta__cab">
        <span className="cv-tarjeta__sigla">{sigla(c.nombre)}</span>
        <span className="cv-tarjeta__nombre">{centroLabel(c.nombre)}</span>
      </div>
      <Anillo valor={pct(con, k.fichas)} color={tono}/>
      <div className="cv-tarjeta__nums">
        <div><b><Numero valor={con}/></b><span>con coordinación</span></div>
        <div className={k.sin_coordinacion ? 'cv-rojo' : ''}><b><Numero valor={k.sin_coordinacion}/></b><span>sin coordinación</span></div>
      </div>
      <div className="cv-tarjeta__pie">
        {alDia
          ? <span className="cv-chip cv-chip--ok"><Ic n="checkCircle" s={12}/> Al día</span>
          : c.reglas_incompletas > 0
            ? <span className="cv-chip cv-chip--warn">{n(c.reglas_incompletas)} reglas por definir</span>
            : <span className="cv-chip">{n(k.sin_coordinacion)} por asignar</span>}
        <Ic n={activo ? 'chevronUp' : 'chevronDown'} s={14} className="cv-tarjeta__flecha"/>
      </div>
    </button>
  )
}

function DetalleCentro({ c, alcance, tono, reglas, pendientes, coordinaciones, onCambio, onCerrar }: {
  c: CentroConciliado; alcance: Alcance; tono: string
  reglas: Regla[]; pendientes: ReglaPorDefinir[]; coordinaciones: Coordinacion[]
  onCambio: () => void; onCerrar: () => void
}) {
  const montado = useMontado()
  const ref = useRef<HTMLElement>(null)
  const [vista, setVista] = useState<'definir' | 'definidas'>(pendientes.length ? 'definir' : 'definidas')
  useEffect(() => { ref.current?.scrollIntoView({ behavior: reducido() ? 'auto' : 'smooth', block: 'start' }) }, [])
  const definidas = reglas.filter(r => r.coordinacion_academica_id != null)
  const k = c[alcance]
  const filas = c.coordinaciones
    .map(co => ({ ...co, x: co[alcance] }))
    .filter(co => co.x.fichas > 0 || co.reglas > 0)
    .sort((a, b) => b.x.fichas - a.x.fichas)
  const max = Math.max(1, k.sin_coordinacion, ...filas.map(f => f.x.fichas))
  const ancho = (x: number) => (montado ? `${(x / max) * 100}%` : '0%')
  const hayRegistroSin = filas.some(f => f.x.no_coincide > 0)

  return (
    <section ref={ref} className="cv-detalle" style={{ '--tono': tono } as CSSProperties}>
      <div className="cv-detalle__cab">
        <div>
          <h3>{centroLabel(c.nombre)}</h3>
          <p>{n(k.fichas)} fichas · {pct(conCoord(k), k.fichas)}% con coordinación</p>
        </div>
        <div className="cv-detalle__acciones">
          <Btn size="sm" variant="ghost" icon="download" onClick={() => void descargarCatalogo(c.id)}>Excel</Btn>
          <button type="button" className="cv-cerrar" onClick={onCerrar} aria-label="Cerrar"><Ic n="x" s={15}/></button>
        </div>
      </div>

      <div className="cv-barras">
        {filas.map((f, i) => (
          <div key={f.id} className="cv-fila" style={{ animationDelay: `${i * 45}ms` }}>
            <div className="cv-fila__nombre">
              <span>{coordCorta(f.nombre)}</span>
              <small>{f.coordinador_nombre ?? 'Sin coordinador activo'}</small>
            </div>
            <div className="cv-fila__pista">
              <span className="cv-fila__barra" style={{ width: ancho(f.x.fichas) }}>
                <span className="cv-fila__cat" style={{ width: f.x.fichas ? `${(f.x.coincide / f.x.fichas) * 100}%` : '0%' }}/>
              </span>
            </div>
            <b className="cv-fila__n">{n(f.x.fichas)}</b>
          </div>
        ))}
        {k.sin_coordinacion > 0 && (
          <div className="cv-fila cv-fila--sin" style={{ animationDelay: `${filas.length * 45}ms` }}>
            <div className="cv-fila__nombre"><span>Sin coordinación</span><small>Faltan reglas en el catálogo</small></div>
            <div className="cv-fila__pista"><span className="cv-fila__barra" style={{ width: ancho(k.sin_coordinacion) }}/></div>
            <b className="cv-fila__n">{n(k.sin_coordinacion)}</b>
          </div>
        )}
      </div>
      {hayRegistroSin && (
        <div className="cv-leyenda">
          <span><i className="cv-punto" style={{ background: tono }}/> según el catálogo</span>
          <span><i className="cv-punto cv-punto--suave" style={{ background: tono }}/> con coordinación, su regla aún sin definir</span>
        </div>
      )}

      <div className="cv-reglas-sec">
        <div className="cv-reglas-sec__cab">
          <div>
            <h4>Reglas del catálogo</h4>
            <p>Cada regla es una combinación de programa, nivel, jornada, modalidad y municipio. Sus fichas siguen la coordinación de la regla.</p>
          </div>
          <Seg name={`cv-reglas-${c.id}`} value={vista} onChange={v => setVista(v as 'definir' | 'definidas')} options={[
            { value: 'definir', label: `Por definir ${pendientes.length}` },
            { value: 'definidas', label: `Definidas ${definidas.length}` },
          ]}/>
        </div>
        {vista === 'definir'
          ? <PorDefinir pendientes={pendientes} coordinaciones={coordinaciones} onCambio={onCambio}/>
          : <ReglasCentro
              reglas={definidas}
              coords={c.coordinaciones.filter(co => co.reglas > 0).map(co => ({ id: co.id, nombre: co.nombre }))}
              opciones={coordinaciones} onCambio={onCambio}
            />}
      </div>
    </section>
  )
}

// Reglas del centro sin coordinación: se definen aquí, varias a la vez. La pista
// es la coordinación donde ya están sus fichas (si todas coinciden).
interface ReglaPorDefinir {
  id: number; centro_formacion_id: number
  nivel_formacion: string; jornada: string; modalidad_formacion: string
  programa_nombre: string; municipio: string | null
  fichas: number; fichas_vigentes: number; fichas_sin_coordinacion: number
  en_fichas: { coordinacion_academica_id: number; fichas: number }[]
}

function PorDefinir({ pendientes, coordinaciones, onCambio }: {
  pendientes: ReglaPorDefinir[]; coordinaciones: Coordinacion[]; onCambio: () => void
}) {
  const rutas = useContext(RutasCatalogo)
  const [eleccion, setEleccion] = useState<Map<number, number>>(new Map())
  const [q, setQ] = useState('')
  const [soloVigentes, setSoloVigentes] = useState(true)
  const [todas, setTodas] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState<{ tono: 'ok' | 'crit'; texto: string } | null>(null)
  const nombre = new Map(coordinaciones.map(c => [c.id, coordCorta(c.nombre)]))
  const pista = (r: ReglaPorDefinir) => (r.en_fichas.length === 1 ? r.en_fichas[0].coordinacion_academica_id : null)

  const ql = q.trim().toLowerCase()
  const lista = pendientes
    .filter(r => (!soloVigentes || r.fichas_vigentes > 0)
      && (!ql || `${r.programa_nombre} ${r.municipio ?? ''} ${r.jornada} ${r.modalidad_formacion}`.toLowerCase().includes(ql)))
  const visibles = todas ? lista : lista.slice(0, 25)
  const conPista = lista.filter(r => pista(r) != null && !eleccion.has(r.id))

  function elegir(id: number, coord: number | null) {
    setEleccion(prev => { const m = new Map(prev); if (coord == null) m.delete(id); else m.set(id, coord); return m })
  }
  async function guardar() {
    setGuardando(true); setMsg(null)
    try {
      const r = await api.post<{ reglas: number; fichas: number }>(rutas.asignar, {
        items: [...eleccion].map(([regla_id, coordinacion_academica_id]) => ({ regla_id, coordinacion_academica_id })),
      })
      setMsg({ tono: 'ok', texto: `${r.data.reglas} regla${r.data.reglas === 1 ? '' : 's'} definida${r.data.reglas === 1 ? '' : 's'}; ${n(r.data.fichas)} fichas quedaron en su coordinación.` })
      setEleccion(new Map())
      onCambio()
    } catch (e) {
      setMsg({ tono: 'crit', texto: mensajeError(e, 'No se pudo guardar.') })
    } finally {
      setGuardando(false)
    }
  }

  if (!pendientes.length) {
    return <div className="cv-vacio"><Ic n="checkCircle" s={18}/><br/>Todas las reglas de este centro tienen coordinación.</div>
  }

  return (
    <div className="cv-definir">
      <div className="cv-reglas__barra">
        <label className="cv-buscar">
          <Ic n="search" s={13}/>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar programa, jornada o municipio"/>
        </label>
        <label className="cv-check">
          <input type="checkbox" checked={soloVigentes} onChange={e => setSoloVigentes(e.target.checked)}/> Solo con fichas vigentes
        </label>
      </div>

      {(eleccion.size > 0 || conPista.length > 0) && (
        <div className="cv-definir__accion">
          <span>{eleccion.size > 0 ? <><b>{eleccion.size}</b> lista{eleccion.size === 1 ? '' : 's'} para guardar</> : 'Elige la coordinación de cada regla.'}</span>
          {conPista.length > 0 && (
            <Btn size="sm" variant="secondary" icon="sparkles" onClick={() => setEleccion(prev => { const m = new Map(prev); for (const r of conPista) m.set(r.id, pista(r)!); return m })}>
              Usar la de sus fichas ({conPista.length})
            </Btn>
          )}
          {eleccion.size > 0 && (
            <Btn size="sm" icon="check" disabled={guardando} onClick={() => void guardar()}>{guardando ? 'Guardando…' : `Guardar ${eleccion.size}`}</Btn>
          )}
        </div>
      )}
      {msg && <InlineAlert tone={msg.tono} icon={msg.tono === 'ok' ? 'checkCircle' : 'alert'}>{msg.texto}</InlineAlert>}

      {lista.length === 0 && <div className="cv-vacio">Ninguna regla en este filtro.</div>}
      {visibles.map(r => {
        const elegida = eleccion.get(r.id)
        const p = pista(r)
        return (
          <div key={r.id} className={`cv-regla cv-regla--sin${elegida != null ? ' cv-regla--lista' : ''}`}>
            <div className="cv-regla__txt">
              <div className="cv-regla__prog">{r.programa_nombre}</div>
              <div className="cv-regla__combo">
                {r.nivel_formacion} · {r.jornada} · {r.modalidad_formacion.replace('_', ' ')} · {r.municipio ?? 'cualquier municipio'}
                <span className="cv-gris"> · {n(r.fichas)} ficha{r.fichas === 1 ? '' : 's'}</span>
                {p != null && <span className="cv-pista-coord"> · sus fichas están en {nombre.get(p)}</span>}
              </div>
            </div>
            <select className={`cv-select${elegida != null ? ' cv-select--lista' : ' cv-select--sin'}`} value={elegida ?? ''} onChange={e => elegir(r.id, e.target.value ? Number(e.target.value) : null)}>
              <option value="">Elegir coordinación…</option>
              {coordinaciones.map(c => <option key={c.id} value={c.id}>{coordCorta(c.nombre)}{c.coordinador_nombre ? ` — ${c.coordinador_nombre}` : ''}</option>)}
            </select>
          </div>
        )
      })}
      {lista.length > 25 && (
        <button type="button" className="cv-mas" onClick={() => setTodas(!todas)}>
          {todas ? 'Ver menos' : `Ver las ${n(lista.length)} reglas`}
        </button>
      )}
    </div>
  )
}

// Reglas de un centro agrupadas por la coordinación a la que mandan las fichas.
function ReglasCentro({ reglas, coords, opciones, onCambio }: {
  reglas: Regla[]; coords: { id: number; nombre: string }[]; opciones: Coordinacion[]; onCambio: () => void
}) {
  const rutas = useContext(RutasCatalogo)
  const [q, setQ] = useState('')
  const [soloSin, setSoloSin] = useState(false)
  const [guardando, setGuardando] = useState<number | null>(null)
  const ql = q.trim().toLowerCase()
  const visibles = reglas.filter(r =>
    (!soloSin || r.coordinacion_academica_id == null)
    && (!ql || `${r.programa_nombre} ${r.municipio ?? ''} ${r.jornada}`.toLowerCase().includes(ql)))
  const grupos = [
    ...(visibles.some(r => r.coordinacion_academica_id == null) ? [{ id: null as number | null, nombre: 'Sin coordinación' }] : []),
    ...coords.map(x => ({ id: x.id as number | null, nombre: coordCorta(x.nombre) })),
  ].map(g => ({ ...g, reglas: visibles.filter(r => r.coordinacion_academica_id === g.id) }))
    .filter(g => g.reglas.length > 0)

  async function cambiar(r: Regla, coordId: number | null) {
    setGuardando(r.id)
    try {
      await api.patch(rutas.regla(r.id), { coordinacion_academica_id: coordId })
      onCambio()
    } catch (e) {
      alert(mensajeError(e, 'No se pudo cambiar la coordinación.'))
    } finally {
      setGuardando(null)
    }
  }
  async function eliminar(r: Regla) {
    if (!confirm(`¿Quitar del catálogo "${r.programa_nombre}" (${r.jornada}, ${r.modalidad_formacion}${r.municipio ? `, ${r.municipio}` : ''})?`)) return
    await api.delete(rutas.regla(r.id)).then(onCambio).catch(e => alert(mensajeError(e, 'No se pudo eliminar.')))
  }

  return (
    <div className="cv-reglas">
      <div className="cv-reglas__barra">
        <label className="cv-buscar">
          <Ic n="search" s={13}/>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar programa, jornada o municipio"/>
        </label>
        <label className="cv-check">
          <input type="checkbox" checked={soloSin} onChange={e => setSoloSin(e.target.checked)}/> Solo por definir
        </label>
      </div>
      {grupos.length === 0 && <div className="cv-vacio">Ninguna regla coincide.</div>}
      {grupos.map(g => (
        <div key={g.id ?? 'sin'} className="cv-reglas__grupo">
          <div className="cv-reglas__cab">{g.nombre}<span>{g.reglas.length}</span></div>
          {g.reglas.map(r => (
            <div key={r.id} className={`cv-regla${r.coordinacion_academica_id == null ? ' cv-regla--sin' : ''}`}>
              <div className="cv-regla__txt">
                <div className="cv-regla__prog">{r.programa_nombre}</div>
                <div className="cv-regla__combo">
                  {r.nivel_formacion} · {r.jornada} · {r.modalidad_formacion} · {r.municipio ?? <i>cualquier municipio</i>}
                  {r.origen === 'MANUAL' && <> · <Bdg tone="neutral">Manual</Bdg></>}
                  {r.fichas > 0 && <> · <span className="cv-gris">{r.fichas} ficha{r.fichas === 1 ? '' : 's'}</span></>}
                  {r.no_coinciden > 0 && r.coordinacion_academica_id != null && <> · <span className="cv-ambar">{r.no_coinciden} sin seguirla</span></>}
                </div>
              </div>
              <select
                className={`cv-select${r.coordinacion_academica_id != null ? '' : ' cv-select--sin'}`}
                value={r.coordinacion_academica_id ?? ''} disabled={guardando === r.id}
                onChange={e => void cambiar(r, e.target.value ? Number(e.target.value) : null)}
                title={r.coordinador_nombre ? `El centro escribió: ${r.coordinador_nombre}` : undefined}
              >
                <option value="">Sin coordinación</option>
                {opciones.map(c => <option key={c.id} value={c.id}>{coordCorta(c.nombre)}{c.coordinador_nombre ? ` — ${c.coordinador_nombre}` : ''}</option>)}
              </select>
              <button type="button" className="cv-icono" title="Quitar del catálogo" onClick={() => void eliminar(r)}><Ic n="trash" s={13}/></button>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// Sube el consolidado (.xlsx), muestra cómo se resolvió cada coordinador y
// solo guarda cuando se confirma.
function ImportarConsolidado({ onImportado }: { onImportado: () => void }) {
  const [archivo, setArchivo] = useState<File | null>(null)
  const [previa, setPrevia] = useState<Importacion | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hecho, setHecho] = useState<Importacion | null>(null)
  const input = useRef<HTMLInputElement>(null)

  async function enviar(f: File, confirmar: boolean) {
    const datos = new FormData()
    datos.append('archivo', f)
    if (confirmar) datos.append('confirmar', 'true')
    setCargando(true); setError(null)
    try {
      const r = await api.post<Importacion>('/integridad/catalogo/importar', datos)
      if (confirmar) { setHecho(r.data); setPrevia(null); setArchivo(null); onImportado() }
      else setPrevia(r.data)
    } catch (e) {
      setError(mensajeError(e, 'No se pudo leer el consolidado.'))
    } finally {
      setCargando(false)
    }
  }

  function elegir(f: File | undefined) {
    setError(null); setPrevia(null); setHecho(null)
    if (!f) return
    if (!/\.xlsx$/i.test(f.name)) { setError('El consolidado debe ser un .xlsx.'); return }
    setArchivo(f)
    void enviar(f, false)
  }

  const sinResolver = previa?.coordinadores.filter(c => c.coordinacion_academica_id == null) ?? []

  return (
    <div className="cv-importar">
      <p className="sofia-subir__txt">
        Columnas: centro, nivel, jornada, modalidad, programa, municipio y <b>nombre del coordinador académico</b>.
        Se previsualiza antes de guardar; importar de nuevo actualiza las combinaciones que ya estaban.
      </p>
      <div className={`sofia-drop${archivo ? ' sofia-drop--ok' : ''}`} onClick={() => input.current?.click()}>
        <input ref={input} type="file" accept=".xlsx" hidden onChange={e => { elegir(e.target.files?.[0]); e.target.value = '' }}/>
        <Ic n={archivo ? 'fileText' : 'upload'} s={18}/>
        {archivo ? <span><b>{archivo.name}</b>{cargando && ' · leyendo…'}</span> : <span>Haz clic para elegir el .xlsx</span>}
      </div>

      {error && <InlineAlert tone="crit" icon="alert" style={{ marginTop: 12 }}>{error}</InlineAlert>}
      {hecho && (
        <InlineAlert tone="ok" icon="checkCircle" style={{ marginTop: 12 }}>
          Catálogo actualizado: {hecho.nuevas} reglas nuevas, {hecho.cambian} con otra coordinación, {hecho.sin_cambio} iguales.
        </InlineAlert>
      )}

      {previa && archivo && (
        <div className="int-previa">
          <div className="int-previa__txt">
            {previa.filas} filas → <b>{previa.reglas}</b> combinaciones: {previa.nuevas} nuevas, {previa.cambian} cambian de coordinación, {previa.sin_cambio} iguales.
          </div>
          <table className="int-previa__tabla">
            <tbody>
              {previa.coordinadores.map(c => (
                <tr key={`${c.centro}-${c.escrito}`}>
                  <td>{c.escrito}</td>
                  <td>{c.coordinacion_academica_id
                    ? <span className="int-sug--ok"><Ic n="check" s={11}/> {coordCorta(c.coordinacion_nombre)} <span className="int-gris">({c.usuario})</span></span>
                    : <span className="int-sug--warn"><Ic n="alert" s={11}/> No coincide con ningún coordinador</span>}</td>
                  <td className="int-num">{c.reglas}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {sinResolver.length > 0 && (
            <div className="int-sug int-sug--warn" style={{ marginTop: 6 }}>
              Esas reglas se guardan sin coordinación; puedes elegirla en la tabla después de importar.
            </div>
          )}
          {previa.errores.length > 0 && (
            <ul className="sofia-errores int-rojo">
              {previa.errores.slice(0, 8).map(e => <li key={e.fila}>Fila {e.fila}: {e.mensaje}</li>)}
              {previa.errores.length > 8 && <li>… y {previa.errores.length - 8} más</li>}
            </ul>
          )}
          <div className="sofia-subir__fila">
            <Btn size="sm" variant="secondary" onClick={() => { setPrevia(null); setArchivo(null) }}>Cancelar</Btn>
            <Btn size="sm" icon="check" disabled={cargando || previa.reglas === 0} onClick={() => void enviar(archivo, true)}>
              {cargando ? 'Guardando…' : `Guardar ${previa.reglas} reglas`}
            </Btn>
          </div>
        </div>
      )}
    </div>
  )
}

