import { useEffect, useMemo, useRef, useState } from 'react'
import { Ic } from '../../components/ui'
import type { IcName } from '../../components/ui'
import { CenterState } from '../shared/parts'
import type {
  EstadoAprendiz, EstadoMomentoAprendiz, Pendiente, PendientesInstructor,
  SituacionAprendiz, TabEtapa, TipoMomentoProyectado,
} from './types'

// ─── Calendario del instructor (navegador) ───────────────────────────────────
// Tres columnas que se leen juntas:
//   · Aprendices   quién está en seguimiento, agrupados por ficha, con una
//                  barrita de sus 3 momentos. Elegir uno enfoca todo en él.
//   · Mes          cada cosa en su día, escrita ("Venció planeación · Carla",
//                  "Visita seguimiento · Juan"). Con un aprendiz elegido se
//                  sombrean sus ventanas y se marca el inicio/fin de su etapa.
//   · Panel        contexto: los próximos 14 días, el ciclo del aprendiz
//                  elegido, o el detalle del día que se toque.
// Todo sale de GET /instructores/mi/pendientes (mismas ventanas que la vista
// Pendientes), así que las dos vistas nunca se contradicen.

const MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const DOW = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const DIA_LARGO = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
// Alto de un chip + separación, y lo que ocupa el número del día: con esto
// se calcula cuántos chips caben en la celda según su alto real.
const ALTO_CHIP = 22
const ALTO_CABECERA_DIA = 30
// Debajo de este ancho la vista deja de ocupar una pantalla fija (las
// columnas se apilan y la página hace scroll normal).
const ANCHO_FIJO = 1280

type EstadoEvento = EstadoMomentoAprendiz | 'PASADA' | 'FICHA' | 'MARCA'

const TONO: Record<EstadoEvento, { fg: string; bg: string; dot: string; label: string }> = {
  VENCIDO:  { fg: 'var(--fx-atraso)', bg: 'var(--fx-atraso-suave)', dot: 'var(--fx-atraso)', label: 'Vencido' },
  ABIERTO:  { fg: 'var(--fx-aviso)', bg: 'var(--fx-aviso-suave)', dot: 'var(--fx-aviso)', label: 'Ventana abierta (cierra ese día)' },
  AGENDADO: { fg: 'var(--fx-morado-tinta)', bg: 'var(--fx-morado-suave)', dot: 'var(--fx-morado)', label: 'Visita agendada' },
  PROXIMO:  { fg: 'var(--fx-tinta-2)', bg: 'var(--fx-superficie-2)', dot: 'var(--fx-tinta-3)', label: 'Se habilita ese día' },
  HECHO:    { fg: 'var(--fx-ok)', bg: 'var(--fx-ok-suave)', dot: 'var(--fx-ok)', label: 'Hecho' },
  PASADA:   { fg: 'var(--fx-tinta-3)', bg: 'var(--fx-superficie-2)', dot: 'var(--fx-tinta-4)', label: 'Visita pasada' },
  FICHA:    { fg: 'var(--fx-info)', bg: 'var(--fx-info-suave)', dot: 'var(--fx-info)', label: 'Ficha' },
  MARCA:    { fg: 'var(--fx-tinta-2)', bg: 'var(--fx-superficie)', dot: 'var(--fx-tinta-2)', label: 'Inicio / fin de etapa' },
}
const LEYENDA: EstadoEvento[] = ['VENCIDO', 'ABIERTO', 'AGENDADO', 'PROXIMO', 'HECHO']

const SITUACION: Record<SituacionAprendiz, { label: string; color: string }> = {
  ATRASADO: { label: 'Atrasados', color: 'var(--fx-atraso)' },
  LE_TOCA:  { label: 'Le toca',   color: 'var(--fx-aviso)' },
  AL_DIA:   { label: 'Al día',    color: 'var(--fx-tinta-2)' },
  COMPLETO: { label: 'Completos', color: 'var(--fx-ok)' },
}
const SITUACIONES = Object.keys(SITUACION) as SituacionAprendiz[]

// `abrev` es para las celdas del mes (≈120 px): la frase completa va en el
// panel del día y en el tooltip del chip.
const MOMENTO: Record<TipoMomentoProyectado, { largo: string; corto: string; abrev: string; tab: TabEtapa; femenino: boolean }> = {
  PLANEACION:  { largo: 'Planeación',          corto: 'planeación',  abrev: 'plan.', tab: 'planeacion',   femenino: true },
  SEGUIMIENTO: { largo: 'Seguimiento parcial', corto: 'seguimiento', abrev: 'seg.',  tab: 'seguimientos', femenino: false },
  EVALUACION:  { largo: 'Evaluación final',    corto: 'evaluación',  abrev: 'eval.', tab: 'evaluacion',   femenino: true },
}

const ICONO_ESTADO: Record<EstadoMomentoAprendiz, IcName> = {
  HECHO: 'checkCircle', VENCIDO: 'alert', ABIERTO: 'clock', AGENDADO: 'calendar', PROXIMO: 'minus',
}

// ── Fechas ──────────────────────────────────────────────────────────────────
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function deISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}
function sumar(iso: string, dias: number): string {
  const d = deISO(iso)
  d.setDate(d.getDate() + dias)
  return ymd(d)
}
function entre(a: string, b: string): number {
  return Math.round((deISO(b).getTime() - deISO(a).getTime()) / 864e5)
}
function corta(iso: string): string {
  const d = deISO(iso)
  return `${d.getDate()} ${MES_CORTO[d.getMonth()]}`
}
// "Martes 29 de septiembre" (solo la primera letra en mayúscula).
function larga(iso: string): string {
  const d = deISO(iso)
  const t = `${DIA_LARGO[d.getDay()]} ${d.getDate()} de ${MES[d.getMonth()].toLowerCase()}`
  return t.charAt(0).toUpperCase() + t.slice(1)
}
// Lunes de la semana en que cae el día 1, para que la grilla arranque en lunes.
function inicioGrilla(anio: number, mes: number): Date {
  const dow = (new Date(anio, mes, 1).getDay() + 6) % 7
  return new Date(anio, mes, 1 - dow)
}
function primerNombre(n: string): string {
  const p = n.trim().split(/\s+/)
  return p.length > 1 ? `${p[0]} ${p[1][0]}.` : p[0]
}
// Los nombres llegan de Sofía en MAYÚSCULAS: "ISAAC DAVID SANTOS" se lee
// mejor como "Isaac David Santos". Si ya vienen en mixto se dejan igual.
const MINUSCULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y'])
function nombrePropio(n: string): string {
  if (n !== n.toUpperCase()) return n
  return n.toLowerCase().split(/\s+/).map((w, i) =>
    i > 0 && MINUSCULAS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}
function sinTildes(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

// ── Eventos ─────────────────────────────────────────────────────────────────
interface Evento {
  key:      string
  fecha:    string
  estado:   EstadoEvento
  etapaId:  number | null
  fichaId:  number | null
  quien:    string          // aprendiz o "Ficha N"
  corto:    string          // lo que cabe en la celda
  largo:    string          // la frase completa del panel
  tab:      TabEtapa | null
}

function cortoMomento(tipo: TipoMomentoProyectado, estado: EstadoMomentoAprendiz): string {
  const m = MOMENTO[tipo]
  switch (estado) {
    case 'HECHO':    return `${m.abrev.charAt(0).toUpperCase()}${m.abrev.slice(1)} hech${m.femenino ? 'a' : 'o'}`
    case 'VENCIDO':  return `Venció ${m.abrev}`
    case 'ABIERTO':  return `Cierra ${m.abrev}`
    case 'AGENDADO': return `Visita ${m.abrev}`
    case 'PROXIMO':  return `Abre ${m.abrev}`
  }
}

function eventosDe(aprendices: EstadoAprendiz[], pendientes: Pendiente[], foco: EstadoAprendiz | null, verHechos: boolean, hoy: string): Evento[] {
  const out: Evento[] = []
  for (const a of foco ? [foco] : aprendices) {
    for (const m of a.momentos) {
      if (!m.fecha || (m.estado === 'HECHO' && !verHechos)) continue
      const visita = m.visita && m.fecha === m.visita.fecha ? ` (${m.visita.modalidad === 'VIRTUAL' ? 'virtual' : 'presencial'})` : ''
      out.push({
        key: `${a.etapa_id}-${m.tipo}`, fecha: m.fecha, estado: m.estado,
        etapaId: a.etapa_id, fichaId: a.ficha_id, quien: a.aprendiz_nombre,
        corto: cortoMomento(m.tipo, m.estado),
        largo: `${MOMENTO[m.tipo].largo}: ${m.texto.charAt(0).toLowerCase()}${m.texto.slice(1)}${visita}.`,
        tab: m.estado === 'AGENDADO' || m.estado === 'PROXIMO' ? 'cronograma' : MOMENTO[m.tipo].tab,
      })
      // Momento vencido que ya tiene visita agendada para más adelante: la
      // visita también va en su día (es cuando el instructor lo va a resolver).
      if (m.estado === 'VENCIDO' && m.visita && m.visita.fecha !== m.fecha && m.visita.fecha >= hoy) {
        out.push({
          key: `${a.etapa_id}-${m.tipo}-v`, fecha: m.visita.fecha, estado: 'AGENDADO',
          etapaId: a.etapa_id, fichaId: a.ficha_id, quien: a.aprendiz_nombre,
          corto: cortoMomento(m.tipo, 'AGENDADO'),
          largo: `${MOMENTO[m.tipo].largo}: visita ${m.visita.modalidad === 'VIRTUAL' ? 'virtual' : 'presencial'} agendada (el momento ya está vencido).`,
          tab: MOMENTO[m.tipo].tab,
        })
      }
    }
    for (const x of a.visitas_extra) {
      const futura = x.fecha >= hoy
      out.push({
        key: `${a.etapa_id}-X-${x.fecha}`, fecha: x.fecha, estado: futura ? 'AGENDADO' : 'PASADA',
        etapaId: a.etapa_id, fichaId: a.ficha_id, quien: a.aprendiz_nombre,
        corto: 'Visita extra',
        largo: `Visita extra ${x.modalidad === 'VIRTUAL' ? 'virtual' : 'presencial'}${futura ? '' : ' (ya pasó)'}.`,
        tab: 'cronograma',
      })
    }
    if (foco) {
      if (a.inicio) out.push({ key: `${a.etapa_id}-ini`, fecha: a.inicio, estado: 'MARCA', etapaId: a.etapa_id, fichaId: a.ficha_id, quien: a.aprendiz_nombre, corto: 'Inicia etapa', largo: 'Inicio de la etapa productiva.', tab: null })
      if (a.fin) out.push({ key: `${a.etapa_id}-fin`, fecha: a.fin, estado: 'MARCA', etapaId: a.etapa_id, fichaId: a.ficha_id, quien: a.aprendiz_nombre, corto: 'Termina etapa', largo: 'Fin estimado de la etapa productiva.', tab: null })
    }
  }
  // Fichas que arrancan práctica: solo en la vista general.
  if (!foco) {
    for (const p of pendientes) {
      if (p.categoria !== 'FICHA' || !p.fecha || p.etapa_id) continue
      out.push({ key: p.id, fecha: p.fecha, estado: 'FICHA', etapaId: null, fichaId: p.ficha_id, quien: p.titulo, corto: 'Inicia práctica', largo: p.texto, tab: null })
    }
  }
  // Dentro de un día: lo más urgente arriba.
  const peso: Record<EstadoEvento, number> = { VENCIDO: 0, ABIERTO: 1, AGENDADO: 2, MARCA: 3, FICHA: 4, PROXIMO: 5, PASADA: 6, HECHO: 7 }
  return out.sort((a, b) => a.fecha.localeCompare(b.fecha) || peso[a.estado] - peso[b.estado])
}

// En la vista general, lo repetido en un día se junta en un solo chip
// ("Venció evaluación ×3"); el detalle con nombres sale al tocar el día.
// Con un aprendiz enfocado cada evento va solo.
interface GrupoDia { key: string; estado: EstadoEvento; corto: string; eventos: Evento[] }
function agruparDia(evs: Evento[], separados: boolean): GrupoDia[] {
  if (separados) return evs.map(e => ({ key: e.key, estado: e.estado, corto: e.corto, eventos: [e] }))
  const mapa = new Map<string, GrupoDia>()
  for (const e of evs) {
    const k = `${e.estado}|${e.corto}`
    const g = mapa.get(k)
    if (g) g.eventos.push(e)
    else mapa.set(k, { key: k, estado: e.estado, corto: e.corto, eventos: [e] })
  }
  return [...mapa.values()]
}

// ── Piezas ──────────────────────────────────────────────────────────────────
function Progreso({ a }: { a: EstadoAprendiz }) {
  return (
    <span className="cn-prog" aria-hidden>
      {a.momentos.map(m => <span key={m.tipo} style={{ background: TONO[m.estado].dot }}/>)}
    </span>
  )
}

function FilaEvento({ e, mostrarQuien, mostrarFecha, onAbrir }: {
  e: Evento; mostrarQuien: boolean; mostrarFecha?: boolean; onAbrir: () => void
}) {
  const t = TONO[e.estado]
  return (
    <button className="cn-ev" onClick={onAbrir}>
      <span className="cn-ev__dot" style={{ background: t.dot }}/>
      <span className="cn-ev__cuerpo">
        {mostrarQuien && <span className="cn-ev__quien">{e.quien}</span>}
        <span className="cn-ev__texto">{e.largo}</span>
      </span>
      {mostrarFecha && <span className="cn-ev__fecha">{corta(e.fecha)}</span>}
      <Ic n="chevronRight" s={13} style={{ color: 'var(--fx-linea-2)', flexShrink: 0 }}/>
    </button>
  )
}

export function AgendaCalendario({ data, onVerEtapa, onVerFicha, onIrPendientes }: {
  data: PendientesInstructor
  onVerEtapa: (etapaId: number, tab: TabEtapa | null) => void
  onVerFicha: (fichaId: number) => void
  onIrPendientes: () => void
}) {
  "use no memo"
  const hoy = data.hoy
  const aprendices = useMemo(
    () => (data.aprendices ?? []).map(a => ({ ...a, aprendiz_nombre: nombrePropio(a.aprendiz_nombre) })),
    [data])
  const [anio, setAnio] = useState(() => deISO(hoy).getFullYear())
  const [mes, setMes] = useState(() => deISO(hoy).getMonth())
  const [focoId, setFocoId] = useState<number | null>(null)
  const [dia, setDia] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [situacion, setSituacion] = useState<SituacionAprendiz | null>(null)
  const [verHechos, setVerHechos] = useState(true)

  // La vista ocupa justo lo que queda de pantalla desde donde empieza: cada
  // columna hace scroll por dentro y el mes reparte ese alto en 6 semanas.
  const raiz = useRef<HTMLDivElement>(null)
  const grilla = useRef<HTMLDivElement>(null)
  const [alto, setAlto] = useState<number | null>(null)
  const [altoCelda, setAltoCelda] = useState<number | null>(null)

  useEffect(() => {
    function medir() {
      const el = raiz.current
      if (!el || window.innerWidth < ANCHO_FIJO) { setAlto(null); return }
      const top = el.getBoundingClientRect().top + window.scrollY
      setAlto(Math.max(560, window.innerHeight - top - 20))
    }
    medir()
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [])

  useEffect(() => {
    const el = grilla.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setAltoCelda(el.clientHeight / 6))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // Chips que caben por día (al menos 1; el resto va en "+N más").
  const caben = alto && altoCelda ? Math.max(1, Math.floor((altoCelda - ALTO_CABECERA_DIA) / ALTO_CHIP)) : 3

  const foco = aprendices.find(a => a.etapa_id === focoId) ?? null
  const busca = sinTildes(q.trim())
  const visibles = aprendices.filter(a =>
    (!situacion || a.situacion === situacion) &&
    (!busca || sinTildes(`${a.aprendiz_nombre} ${a.numero_ficha} ${a.empresa_nombre ?? ''}`).includes(busca)))
  const filtrando = !!situacion || !!busca

  const eventos = eventosDe(visibles, filtrando ? [] : data.pendientes, foco, verHechos, hoy)
  const porDia: Record<string, Evento[]> = {}
  for (const e of eventos) (porDia[e.fecha] ??= []).push(e)

  // Aprendices agrupados por ficha para la columna izquierda.
  const porFicha = new Map<string, EstadoAprendiz[]>()
  for (const a of visibles) {
    const l = porFicha.get(a.numero_ficha) ?? []
    l.push(a)
    porFicha.set(a.numero_ficha, l)
  }

  const inicio = inicioGrilla(anio, mes)
  const celdas = Array.from({ length: 42 }, (_, i) => ymd(new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i)))
  const mesDe = (iso: string) => deISO(iso).getMonth()

  function irA(iso: string, seleccionar = true) {
    const d = deISO(iso)
    setAnio(d.getFullYear())
    setMes(d.getMonth())
    if (seleccionar) setDia(iso)
  }
  function mover(delta: number) {
    const d = new Date(anio, mes + delta, 1)
    setAnio(d.getFullYear())
    setMes(d.getMonth())
    setDia(null)
  }
  function abrir(e: Evento) {
    if (e.etapaId) onVerEtapa(e.etapaId, e.tab)
    else if (e.fichaId) onVerFicha(e.fichaId)
  }
  function enfocar(id: number | null) {
    setFocoId(id)
    setDia(null)
  }

  // Ventana del aprendiz enfocado que contiene un día (para sombrearlo).
  function ventanaEn(iso: string) {
    if (!foco) return null
    return foco.momentos.find(m => m.estado !== 'HECHO' && m.desde && m.hasta && iso >= m.desde && iso <= m.hasta) ?? null
  }
  const fueraDeEtapa = (iso: string) => !!foco && ((!!foco.inicio && iso < foco.inicio) || (!!foco.fin && iso > foco.fin))

  const eventosMes = eventos.filter(e => mesDe(e.fecha) === mes && deISO(e.fecha).getFullYear() === anio)
  const cuenta = (s: SituacionAprendiz) => aprendices.filter(a => a.situacion === s).length

  if (aprendices.length === 0 && data.pendientes.length === 0) {
    return (
      <div className="card" style={{ padding: 28 }}>
        <CenterState icon="calendar" title="Nada en el calendario" sub="Cuando tengas aprendices en etapa productiva, aquí verás su ciclo y sus fechas."/>
      </div>
    )
  }

  return (
    <div ref={raiz} className={`cn${alto ? ' cn--fijo' : ''}`} style={alto ? { height: alto } : undefined}>
      {/* ── Aprendices ─────────────────────────────────────────────────── */}
      <aside className="card cn-lado">
        <label className="cn-buscar">
          <Ic n="search" s={13} style={{ color: 'var(--fx-tinta-4)' }}/>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar aprendiz o ficha"/>
        </label>
        <div className="cn-sit">
          {SITUACIONES.filter(s => cuenta(s) > 0).map(s => (
            <button key={s} className={`cn-sit__b${situacion === s ? ' sel' : ''}`} onClick={() => setSituacion(x => (x === s ? null : s))}>
              <span className="cn-sit__dot" style={{ background: SITUACION[s].color }}/>
              {SITUACION[s].label} <span className="cn-sit__n">{cuenta(s)}</span>
            </button>
          ))}
        </div>

        <div className="cn-lista">
          <button className={`cn-apr cn-apr--todos${!foco ? ' sel' : ''}`} onClick={() => enfocar(null)}>
            <Ic n="users" s={14} style={{ color: 'var(--fx-tinta-3)' }}/>
            <span className="cn-apr__cuerpo">
              <span className="cn-apr__nombre">Todos los aprendices</span>
              <span className="cn-apr__res">{visibles.length} en seguimiento{filtrando ? ' (filtrados)' : ''}</span>
            </span>
          </button>
          {[...porFicha.entries()].map(([ficha, lista]) => (
            <div key={ficha}>
              <div className="cn-ficha">Ficha {ficha}</div>
              {lista.map(a => (
                <button key={a.etapa_id} className={`cn-apr${focoId === a.etapa_id ? ' sel' : ''}`} onClick={() => enfocar(focoId === a.etapa_id ? null : a.etapa_id)}>
                  <span className="cn-apr__sit" style={{ background: SITUACION[a.situacion].color }}/>
                  <span className="cn-apr__cuerpo">
                    <span className="cn-apr__nombre">{a.aprendiz_nombre}</span>
                    <span className="cn-apr__res">{a.resumen}</span>
                  </span>
                  <Progreso a={a}/>
                </button>
              ))}
            </div>
          ))}
          {visibles.length === 0 && <div className="cn-vacio">Nadie coincide con la búsqueda.</div>}
        </div>
      </aside>

      {/* ── Mes ────────────────────────────────────────────────────────── */}
      <section className="card cn-mes">
        <header className="cn-mes__head">
          <div className="cn-mes__titulo">
            {MES[mes]} <span>{anio}</span>
          </div>
          <div className="cn-mes__nav">
            <button className="cn-nav" onClick={() => mover(-1)} aria-label="Mes anterior"><Ic n="chevronLeft" s={15}/></button>
            <button className="cn-hoy" onClick={() => irA(hoy)}>Hoy</button>
            <button className="cn-nav" onClick={() => mover(1)} aria-label="Mes siguiente"><Ic n="chevronRight" s={15}/></button>
          </div>
          <label className="cn-check">
            <input type="checkbox" checked={verHechos} onChange={e => setVerHechos(e.target.checked)}/>
            Mostrar lo hecho
          </label>
        </header>

        {foco && (
          <div className="cn-foco">
            <span>Viendo el ciclo de <strong>{foco.aprendiz_nombre}</strong>. Lo sombreado son las ventanas de sus momentos pendientes.</span>
            <button onClick={() => enfocar(null)}><Ic n="x" s={12}/>Ver a todos</button>
          </div>
        )}

        <div className="cn-dow">{DOW.map(d => <span key={d}>{d}</span>)}</div>
        <div ref={grilla} className="cn-grid">
          {celdas.map((iso, i) => {
            const grupos = agruparDia(porDia[iso] ?? [], !!foco)
            const ventana = ventanaEn(iso)
            // Si no caben todos, el último espacio es para "+N más".
            const lugares = Math.max(1, caben - (ventana ? 1 : 0))
            const visibles = grupos.length > lugares ? grupos.slice(0, lugares - 1) : grupos
            const restantes = grupos.slice(visibles.length).reduce((n, g) => n + g.eventos.length, 0)
            // La etiqueta de la ventana va en su primer día y en cada lunes.
            const etiqueta = ventana && (iso === ventana.desde || i % 7 === 0 || i === 0)
            const clases = [
              'cn-dia',
              mesDe(iso) !== mes && 'cn-dia--fuera',
              iso === hoy && 'cn-dia--hoy',
              iso === dia && 'cn-dia--sel',
              ventana && 'cn-dia--ventana',
              fueraDeEtapa(iso) && 'cn-dia--apagado',
            ].filter(Boolean).join(' ')
            return (
              <button key={iso} className={clases} onClick={() => setDia(d => (d === iso ? null : iso))}>
                <span className="cn-dia__num">{deISO(iso).getDate()}</span>
                {ventana && (
                  <span className="cn-banda" title={`Ventana de ${MOMENTO[ventana.tipo].largo.toLowerCase()}: ${corta(ventana.desde!)} – ${corta(ventana.hasta!)}`}>
                    {etiqueta ? `Ventana ${MOMENTO[ventana.tipo].corto}` : ' '}
                  </span>
                )}
                {visibles.map(g => {
                  const solo = g.eventos.length === 1 ? g.eventos[0] : null
                  const quien = solo && !foco ? (solo.estado === 'FICHA' ? solo.quien : primerNombre(solo.quien)) : null
                  return (
                    <span key={g.key} className="cn-chip"
                      title={g.eventos.map(e => `${e.quien}: ${e.largo}`).join('\n')}
                      style={{ color: TONO[g.estado].fg, background: TONO[g.estado].bg, borderColor: g.estado === 'MARCA' ? 'var(--fx-linea-2)' : 'transparent' }}>
                      <span className="cn-chip__dot" style={{ background: TONO[g.estado].dot }}/>
                      <span className="cn-chip__txt">
                        {g.corto}{quien && <span className="cn-chip__quien"> · {quien}</span>}
                      </span>
                      {!solo && <span className="cn-chip__n">{g.eventos.length}</span>}
                    </span>
                  )
                })}
                {restantes > 0 && <span className="cn-mas">+{restantes} más</span>}
              </button>
            )
          })}
        </div>

        <footer className="cn-leyenda">
          {LEYENDA.map(k => (
            <span key={k}><span className="cn-chip__dot" style={{ background: TONO[k].dot }}/>{TONO[k].label}</span>
          ))}
          <span className="cn-leyenda__n">{eventosMes.length} en {MES[mes].toLowerCase()}</span>
        </footer>
      </section>

      {/* ── Panel de contexto ──────────────────────────────────────────── */}
      <aside className="card cn-panel">
        {dia ? (
          <PanelDia dia={dia} eventos={porDia[dia] ?? []} foco={!!foco} onAbrir={abrir} onCerrar={() => setDia(null)}/>
        ) : foco ? (
          <PanelCiclo a={foco} hoy={hoy} onIr={iso => irA(iso)} onVerEtapa={onVerEtapa}/>
        ) : (
          <PanelProximos eventos={eventos} hoy={hoy} sinFecha={data.pendientes.filter(p => !p.fecha).length} onAbrir={abrir} onIr={iso => irA(iso)} onIrPendientes={onIrPendientes}/>
        )}
      </aside>
    </div>
  )
}

function PanelDia({ dia, eventos, foco, onAbrir, onCerrar }: {
  dia: string; eventos: Evento[]; foco: boolean; onAbrir: (e: Evento) => void; onCerrar: () => void
}) {
  return (
    <>
      <div className="cn-panel__head">
        <div>
          <div className="cn-panel__kicker">Día seleccionado</div>
          <div className="cn-panel__titulo">{larga(dia)}</div>
        </div>
        <button className="cn-cerrar" onClick={onCerrar} aria-label="Cerrar"><Ic n="x" s={14}/></button>
      </div>
      {eventos.length === 0
        ? <div className="cn-vacio">Nada este día.</div>
        : <div className="cn-evs">{eventos.map(e => <FilaEvento key={e.key} e={e} mostrarQuien={!foco} onAbrir={() => onAbrir(e)}/>)}</div>}
    </>
  )
}

function PanelProximos({ eventos, hoy, sinFecha, onAbrir, onIr, onIrPendientes }: {
  eventos: Evento[]; hoy: string; sinFecha: number
  onAbrir: (e: Evento) => void; onIr: (iso: string) => void; onIrPendientes: () => void
}) {
  const limite = sumar(hoy, 14)
  const vencidos = eventos.filter(e => e.estado === 'VENCIDO')
  const proximos = eventos.filter(e => e.fecha >= hoy && e.fecha <= limite && e.estado !== 'HECHO' && e.estado !== 'VENCIDO' && e.estado !== 'PASADA')
  const porFecha = new Map<string, Evento[]>()
  for (const e of proximos) porFecha.set(e.fecha, [...(porFecha.get(e.fecha) ?? []), e])

  return (
    <>
      <div className="cn-panel__head">
        <div>
          <div className="cn-panel__kicker">Agenda</div>
          <div className="cn-panel__titulo">Próximos 14 días</div>
        </div>
      </div>

      {vencidos.length > 0 && (
        <div className="cn-bloque">
          <div className="cn-bloque__t" style={{ color: 'var(--fx-atraso)' }}>Atrasado · {vencidos.length}</div>
          <div className="cn-evs">{vencidos.map(e => <FilaEvento key={e.key} e={e} mostrarQuien mostrarFecha onAbrir={() => onAbrir(e)}/>)}</div>
        </div>
      )}

      {porFecha.size === 0 ? (
        <div className="cn-vacio">Nada con fecha en las próximas dos semanas.</div>
      ) : [...porFecha.entries()].map(([f, evs]) => {
        const n = entre(hoy, f)
        return (
          <div key={f} className="cn-bloque">
            <button className="cn-bloque__t cn-bloque__t--link" onClick={() => onIr(f)}>
              <span>{n === 0 ? 'Hoy' : n === 1 ? 'Mañana' : larga(f)}</span>
              {n > 1 && <span className="cn-bloque__en">en {n} días</span>}
            </button>
            <div className="cn-evs">{evs.map(e => <FilaEvento key={e.key} e={e} mostrarQuien onAbrir={() => onAbrir(e)}/>)}</div>
          </div>
        )
      })}

      {sinFecha > 0 && (
        <button className="cn-sinfecha" onClick={onIrPendientes}>
          <Ic n="bell" s={13}/>
          {sinFecha} pendiente{sinFecha === 1 ? '' : 's'} sin fecha (alertas, aprendices por registrar)
          <Ic n="arrowRight" s={12}/>
        </button>
      )}
    </>
  )
}

function PanelCiclo({ a, hoy, onIr, onVerEtapa }: {
  a: EstadoAprendiz; hoy: string; onIr: (iso: string) => void; onVerEtapa: (etapaId: number, tab: TabEtapa | null) => void
}) {
  const total = a.inicio && a.fin ? Math.max(entre(a.inicio, a.fin), 1) : null
  const transcurrido = a.inicio && total ? Math.min(Math.max(entre(a.inicio, hoy), 0), total) : null
  const pct = total && transcurrido != null ? Math.round((transcurrido / total) * 100) : null

  return (
    <>
      <div className="cn-panel__head">
        <div style={{ minWidth: 0 }}>
          <div className="cn-panel__kicker">Ciclo del aprendiz</div>
          <div className="cn-panel__titulo">{a.aprendiz_nombre}</div>
          <div className="cn-panel__sub"># {a.numero_ficha}{a.empresa_nombre ? ` · ${a.empresa_nombre}` : ''}</div>
        </div>
      </div>

      <div className="cn-sitline" style={{ color: SITUACION[a.situacion].color }}>
        <span className="cn-sit__dot" style={{ background: SITUACION[a.situacion].color }}/>
        {a.resumen}
      </div>

      {a.inicio && a.fin && pct != null && (
        <div className="cn-etapa">
          <div className="cn-etapa__fechas">
            <button onClick={() => onIr(a.inicio!)}>{corta(a.inicio)}</button>
            <span>{pct >= 100 ? 'Etapa cumplida' : `Día ${transcurrido} de ${total}`}</span>
            <button onClick={() => onIr(a.fin!)}>{corta(a.fin)}</button>
          </div>
          <div className="cn-etapa__barra"><span style={{ width: `${pct}%` }}/></div>
        </div>
      )}

      <ol className="cn-pasos">
        {a.momentos.map((m, i) => {
          const t = TONO[m.estado]
          return (
            <li key={m.tipo} className="cn-paso">
              <span className="cn-paso__marca" style={{ color: t.fg, background: t.bg, borderColor: t.dot }}>
                <Ic n={ICONO_ESTADO[m.estado]} s={12}/>
              </span>
              {i < a.momentos.length - 1 && <span className="cn-paso__linea"/>}
              <div className="cn-paso__cuerpo">
                <div className="cn-paso__titulo">{MOMENTO[m.tipo].largo}</div>
                <div className="cn-paso__estado" style={{ color: t.fg }}>{m.texto}</div>
                {m.desde && m.hasta && m.estado !== 'HECHO' && (
                  <button className="cn-paso__ventana" onClick={() => onIr(m.desde!)}>
                    Ventana: {corta(m.desde)} – {corta(m.hasta)}
                  </button>
                )}
                {m.visita && m.estado !== 'HECHO' && m.visita.fecha !== m.fecha && (
                  <button className="cn-paso__ventana" onClick={() => onIr(m.visita!.fecha)}>
                    Visita agendada: {corta(m.visita.fecha)}
                  </button>
                )}
                <button className="cn-paso__abrir" onClick={() => onVerEtapa(a.etapa_id, MOMENTO[m.tipo].tab)}>
                  {m.estado === 'HECHO' ? 'Ver registro' : 'Ir a registrarlo'} <Ic n="arrowRight" s={11}/>
                </button>
              </div>
            </li>
          )
        })}
      </ol>

      {a.visitas_extra.length > 0 && (
        <div className="cn-bloque">
          <div className="cn-bloque__t">Visitas extra</div>
          {a.visitas_extra.map(v => (
            <button key={v.fecha} className="cn-paso__ventana" onClick={() => onIr(v.fecha)}>
              {corta(v.fecha)} · {v.modalidad === 'VIRTUAL' ? 'virtual' : 'presencial'}{v.fecha < hoy ? ' (pasada)' : ''}
            </button>
          ))}
        </div>
      )}

      <button className="cn-abrir" onClick={() => onVerEtapa(a.etapa_id, a.tab ?? 'cronograma')}>
        Abrir etapa productiva <Ic n="arrowRight" s={13}/>
      </button>
    </>
  )
}
