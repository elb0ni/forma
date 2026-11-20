import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Ic, Pager, Btn } from '../../components/ui'
import { CenterState, LoadingBlock, Seg, centroLabel } from '../shared/parts'
import { ProgresoPracticaTarjeta } from '../shared/ProgresoPractica'
import { MODALIDAD_LABEL } from '../shared/AprendicesPractica'
import type { AprendizPractica } from '../shared/AprendicesPractica'
import type { EtapaProductiva, SeguimientoProductivo } from '../productiva/types'
import api from '../../lib/api'

// ─── Aprendices: seguimiento como si fueran usuarios ─────────────────────────
// No inician sesión en FORMA, pero se siguen igual: el último reporte de
// juicios de SofiaPlus cruzado con su etapa productiva, su instructor y sus
// seguimientos. Cada aprendiz queda en uno de 5 casos (el backend los calcula
// con el mismo criterio del detalle de ficha).

type Caso = 'EN_CURSO' | 'CONCLUIDA' | 'TERMINADA_SIN_JUICIO' | 'LISTO_PARA_INICIAR' | 'SIN_ALTERNATIVA'

interface Fila {
  numero_documento: string; nombre: string; sofia_estado: string
  total_ra: number | null; ra_aprobados: number | null; ra_sin_evaluar: number | null
  ficha_id: number; numero_ficha: string; programa: string; centro: string; coordinacion: string | null
  etapa_id: number | null; etapa_estado: string | null; empresa: string | null; fin_etapa: string | null
  instructor: string | null; seguimientos: number; ultimo_seguimiento: string | null
  caso: Caso; sin_seguimiento_reciente: boolean
  // Línea de progreso: la misma que ve el instructor.
  aprendiz_id: number | null; tipo_documento: string; ra_no_aprobados: number | null; fecha_reporte: string | null
  modalidad: string | null; resultado_final: 'APROBADO' | 'NO_APROBADO' | null
  instructor_id: string | null; inicio_etapa: string | null
  hitos: boolean[]; progreso: number; siguiente: string | null
}

const HITOS = ['Lectiva', 'Alternativa', 'Planeación', 'Seguimiento', 'Evaluación', 'Certificación']

interface Respuesta {
  total: number; casos: Record<Caso, number>; sin_seguimiento_reciente: number
  centros: { id: number; nombre: string }[]; filtrados: number; filas: Fila[]
  progreso_promedio: number; instructor: string | null
}

// Del más urgente al que ya cerró.
const CASOS: { id: Caso; label: string; sub: string; color: string; icon: 'alert' | 'clock' | 'briefcase' | 'fileText' | 'checkCircle' }[] = [
  { id: 'SIN_ALTERNATIVA',      label: 'Sin alternativa',     sub: 'Le falta más de un juicio y no tiene etapa productiva', color: 'var(--fx-atraso)', icon: 'alert' },
  { id: 'LISTO_PARA_INICIAR',   label: 'Listos para iniciar', sub: 'Solo le falta el juicio de etapa productiva',        color: 'var(--fx-aviso)', icon: 'clock' },
  { id: 'EN_CURSO',             label: 'En práctica',         sub: 'Con etapa productiva abierta',                         color: 'var(--fx-morado)', icon: 'briefcase' },
  { id: 'TERMINADA_SIN_JUICIO', label: 'Terminó, sin juicio', sub: 'Etapa cerrada; SofiaPlus aún no carga el juicio',      color: 'var(--fx-info)', icon: 'fileText' },
  { id: 'CONCLUIDA',            label: 'Por certificar',      sub: 'Etapa terminada y todos los juicios',                 color: 'var(--fx-ok)', icon: 'checkCircle' },
]
const CASO = Object.fromEntries(CASOS.map(c => [c.id, c])) as Record<Caso, (typeof CASOS)[number]>

const n = (x: number) => x.toLocaleString('es-CO')
// "2026-07-28" -> "28 jul" (fecha de calendario, sin corrimiento por zona horaria).
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic']
const corta = (iso: string) => { const [, m, d] = iso.split('-').map(Number); return `${d} ${MES[m - 1]}` }

export function AprendicesSeguimiento() {
  "use no memo"
  const [params, setParams] = useSearchParams()
  const instructorId = params.get('instructor')
  const [abierto, setAbierto] = useState<Fila | null>(null)
  const [alcance, setAlcance] = useState<'practica' | 'todos'>(instructorId ? 'todos' : 'practica')
  const [caso, setCaso] = useState<Caso | ''>('')
  const [alerta, setAlerta] = useState(false)
  const [centro, setCentro] = useState<number | ''>('')
  const [q, setQ] = useState('')
  const [qDebounced, setQDebounced] = useState('')
  const [pagina, setPagina] = useState(0)
  const [data, setData] = useState<Respuesta | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => { const t = setTimeout(() => setQDebounced(q), 300); return () => clearTimeout(t) }, [q])

  useEffect(() => {
    let vivo = true
    api.get<Respuesta>('/aprendices/seguimiento', {
      params: { alcance, caso: caso || undefined, alerta: alerta || undefined, centro_id: centro || undefined, q: qDebounced || undefined, pagina, instructor_id: instructorId || undefined },
    })
      .then(r => { if (vivo) { setData(r.data); setError(false) } })
      .catch(() => { if (vivo) setError(true) })
      .finally(() => { if (vivo) setCargando(false) })
    return () => { vivo = false }
  }, [alcance, caso, alerta, centro, qDebounced, pagina, instructorId])

  function filtrar(cambio: () => void) { cambio(); setPagina(0); setCargando(true) }
  function verInstructor(id: string | null) {
    filtrar(() => {
      setParams(id ? { vista: 'aprendices', instructor: id } : { vista: 'aprendices' })
      setAlcance(id ? 'todos' : 'practica')
    })
    setAbierto(null)
  }

  if (error && !data) return <CenterState icon="alert" title="No se pudo cargar el seguimiento de aprendices"/>
  if (!data) return <LoadingBlock/>

  const total = Object.values(data.casos).reduce((a, b) => a + b, 0)

  return (
    <div className="us-apr">
      {abierto && <PanelAprendiz a={abierto} onCerrar={() => setAbierto(null)} onVerInstructor={verInstructor}/>}
      {instructorId && (
        <div className="us-instr-filtro">
          <Ic n="user" s={15}/>
          <span>Aprendices de <b>{data.instructor ?? 'este instructor'}</b> · {n(data.total)} a cargo · avance promedio <b>{data.progreso_promedio}%</b></span>
          <button type="button" onClick={() => verInstructor(null)}><Ic n="x" s={12}/> Quitar</button>
        </div>
      )}
      <div className="us-apr__cab">
        <p>
          <b>{n(data.total)}</b> aprendices {alcance === 'practica' ? 'de fichas en práctica o que entran en los próximos 3 meses' : 'en el reporte de juicios'}.
          Su estado sale del reporte de juicios de SofiaPlus cruzado con su etapa productiva y sus seguimientos.
        </p>
        <Seg name="us-apr-alcance" value={alcance} onChange={v => filtrar(() => setAlcance(v as 'practica' | 'todos'))} options={[
          { value: 'practica', label: 'En práctica' },
          { value: 'todos', label: 'Todos' },
        ]}/>
      </div>

      <div className="us-casos">
        {CASOS.map((c, i) => {
          const v = data.casos[c.id]
          const activo = caso === c.id
          return (
            <button
              key={c.id} type="button" aria-pressed={activo}
              className={`us-caso${activo ? ' us-caso--activo' : ''}`}
              style={{ '--c': c.color, animationDelay: `${i * 60}ms` } as CSSProperties}
              onClick={() => filtrar(() => setCaso(activo ? '' : c.id))}
            >
              <span className="us-caso__icono"><Ic n={c.icon} s={15}/></span>
              <b>{n(v)}</b>
              <span className="us-caso__label">{c.label}</span>
              <span className="us-caso__barra"><span style={{ width: total ? `${(v / total) * 100}%` : '0%' }}/></span>
              <span className="us-caso__sub">{c.sub}</span>
            </button>
          )
        })}
      </div>

      {data.sin_seguimiento_reciente > 0 && (
        <button type="button" className={`us-alerta${alerta ? ' us-alerta--on' : ''}`} onClick={() => filtrar(() => setAlerta(!alerta))}>
          <Ic n="bell" s={14}/>
          <span><b>{n(data.sin_seguimiento_reciente)}</b> aprendices en práctica sin un seguimiento en el último mes</span>
          <span className="us-alerta__ir">{alerta ? 'Quitar filtro' : 'Ver cuáles'}</span>
        </button>
      )}

      <div className="us-barra">
        <label className="us-buscar">
          <Ic n="search" s={14}/>
          <input value={q} onChange={e => { setQ(e.target.value); setPagina(0) }} placeholder="Nombre, documento, ficha, programa o instructor"/>
        </label>
        <select className="us-select" value={centro} onChange={e => filtrar(() => setCentro(e.target.value ? Number(e.target.value) : ''))}>
          <option value="">Todos los centros</option>
          {data.centros.map(c => <option key={c.id} value={c.id}>{centroLabel(c.nombre)}</option>)}
        </select>
        {(caso || alerta) && (
          <button type="button" className="us-limpiar" onClick={() => filtrar(() => { setCaso(''); setAlerta(false) })}>
            <Ic n="x" s={12}/> {caso ? CASO[caso].label : 'Sin seguimiento'}
          </button>
        )}
      </div>

      <div className={`us-lista${cargando ? ' us-lista--cargando' : ''}`}>
        {data.filas.length === 0 && <div className="us-vacio">Ningún aprendiz en este filtro.</div>}
        {data.filas.map(a => {
          const c = CASO[a.caso]
          return (
            <div key={`${a.numero_documento}-${a.ficha_id}`} className="us-apr-fila" style={{ '--c': c.color } as CSSProperties}
              role="button" tabIndex={0} onClick={() => setAbierto(a)}
              onKeyDown={e => { if (e.key === 'Enter') setAbierto(a) }}>
              <div className="us-apr-fila__quien">
                <span className="us-apr-fila__nombre">{a.nombre}</span>
                <span className="us-apr-fila__meta">
                  <span className="us-mono">{a.numero_documento}</span>
                  {a.sofia_estado && a.sofia_estado !== 'EN FORMACION' && <span className="us-etiqueta">{a.sofia_estado.toLowerCase()}</span>}
                </span>
              </div>
              <div className="us-apr-fila__ficha">
                <span className="us-apr-fila__prog">{a.programa}</span>
                <span className="us-apr-fila__meta"><span className="us-mono">{a.numero_ficha}</span> · {centroLabel(a.centro)}</span>
              </div>
              <div className="us-apr-fila__juicios" title={HITOS.map((h, i) => `${a.hitos[i] ? '✓' : '·'} ${h}`).join('\n')}>
                <span className="us-hitos">
                  {a.hitos.map((h, i) => <span key={i} className={h ? 'us-hito--ok' : i === a.hitos.indexOf(false) ? 'us-hito--actual' : ''}/>)}
                </span>
                <span className="us-apr-fila__meta"><b>{a.progreso}%</b>{a.siguiente ? ` · sigue ${a.siguiente.toLowerCase()}` : ' · completo'}</span>
              </div>
              <div className="us-apr-fila__etapa">
                {a.etapa_id ? (
                  <>
                    <span>{a.instructor ?? 'Sin instructor'}</span>
                    <span className="us-apr-fila__meta">
                      {a.seguimientos > 0
                        ? <>{a.seguimientos} seguimiento{a.seguimientos === 1 ? '' : 's'}{a.ultimo_seguimiento ? ` · último ${corta(a.ultimo_seguimiento)}` : ''}</>
                        : 'sin seguimientos'}
                      {a.sin_seguimiento_reciente && <Ic n="bell" s={11} style={{ color: 'var(--fx-atraso)', marginLeft: 4, verticalAlign: -1 }}/>}
                    </span>
                  </>
                ) : (
                  <span className="us-apr-fila__meta">Sin etapa productiva</span>
                )}
              </div>
              <span className="us-caso-chip"><i/>{c.label}</span>
            </div>
          )
        })}
      </div>
      <Pager page={pagina} pageCount={Math.ceil(data.filtrados / 30)} total={data.filtrados} pageSize={30} onPage={p => { setPagina(p); setCargando(true) }} noun="aprendices"/>
    </div>
  )
}

// ─── Panel del aprendiz ──────────────────────────────────────────────────────
// La misma tarjeta de progreso que ve el instructor (ProgresoPracticaTarjeta),
// con los momentos de su etapa, más sus datos. Sirve también para ver cómo va
// el trabajo del instructor con cada aprendiz.

type EtapaConSeguimientos = EtapaProductiva & { seguimientos: SeguimientoProductivo[] }

function PanelAprendiz({ a, onCerrar, onVerInstructor }: {
  a: Fila; onCerrar: () => void; onVerInstructor: (id: string) => void
}) {
  const navigate = useNavigate()
  const [etapa, setEtapa] = useState<EtapaConSeguimientos | null>(null)
  const [cargando, setCargando] = useState(a.etapa_id != null)
  useEffect(() => {
    if (a.etapa_id == null) return
    let vivo = true
    api.get<EtapaConSeguimientos>(`/etapas-productivas/${a.etapa_id}`)
      .then(r => { if (vivo) setEtapa(r.data) })
      .catch(() => {})
      .finally(() => { if (vivo) setCargando(false) })
    return () => { vivo = false }
  }, [a.etapa_id])
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onCerrar])

  const c = CASO[a.caso]
  const aprendiz: AprendizPractica = {
    aprendiz_id: a.aprendiz_id, etapa_id: a.etapa_id,
    numero_documento: a.numero_documento, tipo_documento: a.tipo_documento, nombre_completo: a.nombre,
    modalidad: a.modalidad, etapa_estado: a.etapa_estado, resultado_final: a.resultado_final,
    etapa_instructor_nombre: a.instructor,
    total_ra: a.total_ra, ra_aprobados: a.ra_aprobados, ra_no_aprobados: a.ra_no_aprobados, ra_sin_evaluar: a.ra_sin_evaluar,
    fecha_reporte: a.fecha_reporte, caso: a.caso,
  }
  const TONO: Record<Caso, 'ok' | 'err' | 'warn' | 'accent' | 'neutral' | 'blue'> = {
    SIN_ALTERNATIVA: 'err', LISTO_PARA_INICIAR: 'warn', EN_CURSO: 'accent', TERMINADA_SIN_JUICIO: 'blue', CONCLUIDA: 'ok',
  }
  const dato = (label: string, valor: React.ReactNode) => (
    <div className="us-pa__dato"><span>{label}</span><b>{valor}</b></div>
  )

  return createPortal(
    <div className="us-pa-fondo" onClick={onCerrar}>
      <aside className="us-pa" onClick={e => e.stopPropagation()} aria-label={`Progreso de ${a.nombre}`}>
        <div className="us-pa__cab">
          <div>
            <h3>{a.nombre}</h3>
            <p><span className="us-mono">{a.tipo_documento} {a.numero_documento}</span> · {a.sofia_estado.toLowerCase()}</p>
          </div>
          <button type="button" className="us-pa__cerrar" onClick={onCerrar} aria-label="Cerrar"><Ic n="x" s={16}/></button>
        </div>

        <div className="us-pa__cuerpo">
          {cargando
            ? <LoadingBlock minHeight={180}/>
            : <ProgresoPracticaTarjeta a={aprendiz} etapa={etapa} badge={{ label: c.label, tone: TONO[a.caso] }}
                modalidad={a.modalidad ? (MODALIDAD_LABEL[a.modalidad] ?? a.modalidad) : null}/>}

          <div className="us-pa__grid">
            {dato('Programa', a.programa)}
            {dato('Ficha', <><span className="us-mono">{a.numero_ficha}</span> · {centroLabel(a.centro)}</>)}
            {dato('Coordinación', a.coordinacion ? a.coordinacion.replace(/^Coordinaci[oó]n Acad[eé]mica de /i, '') : 'Sin coordinación')}
            {dato('Juicios', a.total_ra ? `${a.ra_aprobados} de ${a.total_ra} aprobados${a.ra_sin_evaluar ? ` · ${a.ra_sin_evaluar} sin evaluar` : ''}` : 'Sin reporte')}
            {dato('Instructor', a.instructor ?? 'Sin instructor')}
            {dato('Empresa', a.empresa ?? '—')}
            {dato('Seguimientos', a.seguimientos ? `${a.seguimientos}${a.ultimo_seguimiento ? ` · último ${corta(a.ultimo_seguimiento)}` : ''}` : 'Ninguno')}
            {dato('Fin de la etapa', a.fin_etapa ? corta(a.fin_etapa) : '—')}
          </div>

          <div className="us-pa__acciones">
            <Btn size="sm" variant="secondary" icon="folder" onClick={() => navigate(`/dashboard/superadmin/fichas/${a.ficha_id}`)}>Ver la ficha</Btn>
            {a.instructor_id && (
              <Btn size="sm" variant="ghost" icon="users" onClick={() => onVerInstructor(a.instructor_id!)}>Aprendices de este instructor</Btn>
            )}
          </div>
        </div>
      </aside>
    </div>,
    document.body,
  )
}
