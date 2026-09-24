import { useEffect, useMemo, useState } from 'react'
import { Ic, Card } from '../../components/ui'
import { useAuthStore } from '../../store/auth'
import api from '../../lib/api'
import { LoadingBlock, CenterState } from '../shared/parts'
import type { MomentoProyectado, ProyeccionInstructor, TipoMomentoProyectado } from './types'
import './instructor.css'

// ─── Calendario del instructor ───────────────────────────────────────────────
// Lo que `agenda` responde en el Home es el corto plazo: lo vencido y lo de
// esta semana. Acá se ve el semestre completo, incluyendo los momentos que
// todavía no existen pero que van a caer -- proyectados por el backend sobre
// las fechas de cada etapa (ver instructores.service.ts::proyeccion).
//
// La distinción importa y por eso es visible: una fecha PROGRAMADA es un
// compromiso; una PROYECTADA es una estimación para planear la carga. Se
// dibujan distinto (borde punteado) y nunca se presentan como lo mismo.

const MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const DOW = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']

const MOMENTO: Record<TipoMomentoProyectado, { label: string; corto: string; color: string }> = {
  PLANEACION:  { label: 'Planeación',  corto: 'M1', color: '#4f46e5' },
  SEGUIMIENTO: { label: 'Seguimiento', corto: 'M2', color: '#0891b2' },
  EVALUACION:  { label: 'Evaluación',  corto: 'M3', color: '#7c3aed' },
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Lunes de la semana en que cae el día 1, para que la grilla arranque en lunes.
function inicioGrilla(anio: number, mes: number): Date {
  const primero = new Date(anio, mes, 1)
  const dow = (primero.getDay() + 6) % 7   // 0 = lunes
  return new Date(anio, mes, 1 - dow)
}

function DiaCelda({ fecha, mesActual, hoy, momentos, seleccionado, onSelect }: {
  fecha: Date
  mesActual: number
  hoy: string
  momentos: MomentoProyectado[]
  seleccionado: boolean
  onSelect: () => void
}) {
  const iso = ymd(fecha)
  const fuera = fecha.getMonth() !== mesActual
  const esHoy = iso === hoy
  const vencidos = momentos.filter(m => m.estado === 'VENCIDO').length

  return (
    <button
      onClick={onSelect}
      className={`cal-dia${fuera ? ' cal-dia--fuera' : ''}${esHoy ? ' cal-dia--hoy' : ''}${seleccionado ? ' cal-dia--sel' : ''}`}
    >
      <span className="cal-dia__num">{fecha.getDate()}</span>
      {momentos.length > 0 && (
        <span className="cal-dia__puntos">
          {momentos.slice(0, 4).map((m, i) => (
            <span
              key={i}
              className={`cal-punto${m.origen === 'PROYECTADO' ? ' cal-punto--proy' : ''}${m.estado === 'HECHO' ? ' cal-punto--hecho' : ''}`}
              style={{
                background: m.origen === 'PROYECTADO' ? 'transparent' : MOMENTO[m.tipo].color,
                borderColor: MOMENTO[m.tipo].color,
              }}
            />
          ))}
          {momentos.length > 4 && <span className="cal-dia__mas">+{momentos.length - 4}</span>}
        </span>
      )}
      {vencidos > 0 && <span className="cal-dia__alerta"/>}
    </button>
  )
}

function MomentoFila({ m, onAbrir }: { m: MomentoProyectado; onAbrir: () => void }) {
  const meta = MOMENTO[m.tipo]
  const proyectado = m.origen === 'PROYECTADO'
  return (
    <button onClick={onAbrir} className="nx-row cal-item">
      <span className="cal-item__tag" style={{
        color: meta.color,
        borderColor: proyectado ? meta.color : 'transparent',
        background: proyectado ? 'transparent' : `${meta.color}14`,
        borderStyle: proyectado ? 'dashed' : 'solid',
      }}>
        {meta.corto}
      </span>
      <span className="cal-item__body">
        <span className="cal-item__nombre">{m.aprendiz_nombre}</span>
        <span className="cal-item__meta">
          {meta.label}
          {m.numero_seguimiento ? ` ${m.numero_seguimiento}` : ''}
          {' · '}
          <span style={{ fontFamily: '"JetBrains Mono", monospace' }}># {m.numero_ficha}</span>
          {m.empresa_nombre ? ` · ${m.empresa_nombre}` : ''}
        </span>
      </span>
      <span className={`cal-item__estado cal-item__estado--${m.estado.toLowerCase()}`}>
        {m.estado === 'HECHO' ? 'Realizado' : m.estado === 'VENCIDO' ? 'Vencido' : proyectado ? 'Proyectado' : 'Programado'}
      </span>
      <Ic n="chevronRight" s={14} style={{ color: '#d4d4d8', flexShrink: 0 }}/>
    </button>
  )
}

export function InstAgenda({ onVerEtapaProductiva }: { onVerEtapaProductiva: (etapaId: number) => void }) {
  "use no memo"
  const user = useAuthStore(s => s.user)
  const [data, setData] = useState<ProyeccionInstructor | null>(null)
  const [loading, setLoading] = useState(true)
  const hoyDate = new Date()
  const [anio, setAnio] = useState(hoyDate.getFullYear())
  const [mes, setMes] = useState(hoyDate.getMonth())
  const [sel, setSel] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let live = true
    api.get<ProyeccionInstructor>('/instructores/mi/proyeccion')
      .then(r => { if (live) { setData(r.data); setLoading(false) } })
      .catch(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [user])

  const porDia = useMemo(() => {
    const mapa: Record<string, MomentoProyectado[]> = {}
    for (const m of data?.momentos ?? []) {
      (mapa[m.fecha] ??= []).push(m)
    }
    return mapa
  }, [data])

  if (loading) return <LoadingBlock minHeight={400}/>
  if (!data) {
    return <Card style={{ padding: 24 }}><CenterState icon="calendar" title="No se pudo cargar el calendario" sub="Verifica la conexión con el servidor."/></Card>
  }

  const hoy = data.hoy
  const inicio = inicioGrilla(anio, mes)
  const celdas = Array.from({ length: 42 }, (_, i) => new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i))

  const delMes = (data.momentos ?? []).filter(m => {
    const [a, b] = m.fecha.split('-')
    return Number(a) === anio && Number(b) === mes + 1
  })
  const vencidosMes = delMes.filter(m => m.estado === 'VENCIDO').length
  const proyectadosMes = delMes.filter(m => m.origen === 'PROYECTADO').length

  const lista = sel ? (porDia[sel] ?? []) : delMes

  function mover(delta: number) {
    const d = new Date(anio, mes + delta, 1)
    setAnio(d.getFullYear())
    setMes(d.getMonth())
    setSel(null)
  }

  function irHoy() {
    const d = new Date()
    setAnio(d.getFullYear())
    setMes(d.getMonth())
    setSel(hoy)
  }

  return (
    <div style={{ maxWidth: 1180 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13.5, color: '#52525b', maxWidth: 680 }}>
          Tus tres momentos del GFPI-F-023 repartidos en el tiempo. Lo que ya tiene fecha aparece en firme;
          lo que todavía no existe se <strong style={{ color: '#18181b' }}>proyecta</strong> sobre las fechas de cada etapa para que puedas planear la carga.
        </div>
      </div>

      <div className="cal-wrap">
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div className="cal-head">
            <div className="cal-head__titulo">
              {MES[mes]} <span className="cal-head__anio">{anio}</span>
            </div>
            <div className="cal-head__nav">
              <button className="cal-nav" onClick={() => mover(-1)} aria-label="Mes anterior"><Ic n="chevronLeft" s={15}/></button>
              <button className="cal-hoy" onClick={irHoy}>Hoy</button>
              <button className="cal-nav" onClick={() => mover(1)} aria-label="Mes siguiente"><Ic n="chevronRight" s={15}/></button>
            </div>
          </div>

          <div className="cal-dow">
            {DOW.map(d => <span key={d}>{d}</span>)}
          </div>

          <div className="cal-grid">
            {celdas.map(f => {
              const iso = ymd(f)
              return (
                <DiaCelda
                  key={iso}
                  fecha={f}
                  mesActual={mes}
                  hoy={hoy}
                  momentos={porDia[iso] ?? []}
                  seleccionado={sel === iso}
                  onSelect={() => setSel(s => (s === iso ? null : iso))}
                />
              )
            })}
          </div>

          <div className="cal-leyenda">
            {(Object.keys(MOMENTO) as TipoMomentoProyectado[]).map(t => (
              <span key={t} className="cal-leyenda__item">
                <span className="cal-punto" style={{ background: MOMENTO[t].color, borderColor: MOMENTO[t].color }}/>
                {MOMENTO[t].label}
              </span>
            ))}
            <span className="cal-leyenda__item">
              <span className="cal-punto cal-punto--proy" style={{ borderColor: '#a1a1aa' }}/>
              Proyectado
            </span>
          </div>
        </Card>

        <div>
          <div className="cal-kpis">
            <div className="cal-kpi">
              <span className="cal-kpi__valor">{delMes.length}</span>
              <span className="cal-kpi__label">momentos este mes</span>
            </div>
            <div className={`cal-kpi${vencidosMes > 0 ? ' cal-kpi--alerta' : ''}`}>
              <span className="cal-kpi__valor">{vencidosMes}</span>
              <span className="cal-kpi__label">vencidos</span>
            </div>
            <div className="cal-kpi">
              <span className="cal-kpi__valor">{proyectadosMes}</span>
              <span className="cal-kpi__label">proyectados</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '18px 0 10px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#0a0a0b' }}>
              {sel ? `Momentos del ${sel.slice(8)} de ${MES[mes].toLowerCase()}` : `Todo ${MES[mes].toLowerCase()}`}
            </div>
            {sel && (
              <button
                onClick={() => setSel(null)}
                style={{ fontSize: 12, color: '#4f46e5', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Ver el mes
              </button>
            )}
          </div>

          {lista.length === 0 ? (
            <Card style={{ padding: 28 }}>
              <CenterState icon="checkCircle" title="Nada agendado" sub={sel ? 'No hay momentos ese día.' : 'No hay momentos este mes.'}/>
            </Card>
          ) : (
            <Card style={{ overflow: 'hidden' }}>
              {lista.map((m, i) => (
                <div key={`${m.etapa_id}-${m.tipo}-${m.fecha}-${i}`} style={{ borderBottom: i < lista.length - 1 ? '1px solid #f1f1f3' : 'none' }}>
                  <MomentoFila m={m} onAbrir={() => onVerEtapaProductiva(m.etapa_id)}/>
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
