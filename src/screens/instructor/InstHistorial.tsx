import { useState, useEffect, Fragment } from 'react'
import { Ic, Card, Bdg, Pager } from '../../components/ui'
import api from '../../lib/api'
import { fd, LoadingBlock, CenterState } from '../shared/parts'
import { CONCEPTO_META, momentoLabel } from './types'
import type { InstructorHistorial, HistorialEvento } from './types'
import './instructor.css'

// ─── Historial / trazabilidad del instructor ─────────────────────────────────
// Todo lo que el instructor ha registrado (planeaciones, seguimientos y
// evaluaciones), en orden cronológico -- lo más reciente primero -- agrupado
// por mes, con a quién, en qué ficha, su concepto y si quedó firmado/ubicado.
// Fuente: GET /instructores/mi/historial.

const PAGE_SIZE = 20

type TipoFilt = 'TODOS' | 'PLANEACION' | 'SEGUIMIENTO' | 'EVALUACION'

const TIPO_CHIPS: { key: TipoFilt; label: string }[] = [
  { key: 'TODOS',       label: 'Todo' },
  { key: 'PLANEACION',  label: 'Planeación' },
  { key: 'SEGUIMIENTO', label: 'Seguimientos' },
  { key: 'EVALUACION',  label: 'Evaluación' },
]

const TIPO_SEG_LABEL: Record<string, string> = {
  PRESENCIAL: 'Presencial', VIRTUAL: 'Virtual', TELEFONICA: 'Telefónica',
}

// "09 sep 2026 · 2:30 p. m." — fecha (de shared/parts) + hora local.
function fdHora(s: string | null): string {
  if (!s) return '—'
  const iso = s.includes('T') ? s : s.replace(' ', 'T')
  const d = new Date(iso)
  if (isNaN(d.getTime())) return fd(s)
  const hora = d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })
  return `${fd(s)} · ${hora}`
}

function mesLargo(s: string): string {
  const d = new Date(s.includes('T') ? s : s.replace(' ', 'T'))
  if (isNaN(d.getTime())) return s
  const t = d.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}
function mesKey(s: string): string {
  return (s.includes('T') ? s : s.replace(' ', 'T')).slice(0, 7)
}

// ─── Heatmap de actividad (estilo GitHub, ~26 semanas) ───────────────────────

const HEAT_TONES = ['#f1f1f3', '#c7d2fe', '#818cf8', '#4f46e5', '#3730a3']
function heatTone(count: number): string {
  if (count <= 0) return HEAT_TONES[0]
  if (count === 1) return HEAT_TONES[1]
  if (count <= 3) return HEAT_TONES[2]
  if (count <= 6) return HEAT_TONES[3]
  return HEAT_TONES[4]
}

const DOW = ['', 'Lun', '', 'Mié', '', 'Vie', '']

export function Heatmap({ actividad }: { actividad: { fecha: string; count: number }[] }) {
  const porDia = new Map(actividad.map(a => [a.fecha, a.count]))

  // Arranca en el lunes de hace ~26 semanas y termina hoy.
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const inicio = new Date(hoy)
  inicio.setDate(inicio.getDate() - 25 * 7 - ((inicio.getDay() + 6) % 7))

  const semanas: { fecha: string; count: number }[][] = []
  const cur = new Date(inicio)
  while (cur <= hoy) {
    const col: { fecha: string; count: number }[] = []
    for (let d = 0; d < 7; d++) {
      const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`
      col.push({ fecha: key, count: cur <= hoy ? (porDia.get(key) ?? 0) : -1 })
      cur.setDate(cur.getDate() + 1)
    }
    semanas.push(col)
  }

  const total = actividad.reduce((s, a) => s + a.count, 0)
  const meses: (string | null)[] = semanas.map((col, i) => {
    const m = new Date(col[0].fecha.replace(/-/g, '/')).getMonth()
    const prev = i > 0 ? new Date(semanas[i - 1][0].fecha.replace(/-/g, '/')).getMonth() : -1
    return m !== prev ? new Date(col[0].fecha.replace(/-/g, '/')).toLocaleDateString('es-CO', { month: 'short' }) : null
  })

  return (
    <div className="heat-scroll">
      <div className="heat-months">
        {meses.map((m, i) => <span key={i} className="heat-month">{m}</span>)}
      </div>
      <div className="heat-body">
        <div className="heat-dow">
          {DOW.map((d, i) => <span key={i} className="heat-dow-cell">{d}</span>)}
        </div>
        <div className="heat-cols">
          {semanas.map((col, i) => (
            <div key={i} className="heat-col">
              {col.map((c, j) => (
                <span
                  key={j}
                  className="heat-cell"
                  title={c.count >= 0 ? `${c.fecha} · ${c.count} registro${c.count === 1 ? '' : 's'}` : undefined}
                  style={{ background: c.count < 0 ? 'transparent' : heatTone(c.count) }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="heat-footer">
        <span className="heat-total"><strong>{total}</strong> registro{total === 1 ? '' : 's'} en los últimos 6 meses</span>
        <span className="heat-legend">
          menos
          {HEAT_TONES.map(t => <span key={t} className="heat-cell" style={{ width: 11, height: 11, background: t }}/>)}
          más
        </span>
      </div>
    </div>
  )
}

// ─── Tabla del historial ─────────────────────────────────────────────────────

const TH_S = { padding: '10px 14px', textAlign: 'left' as const, fontWeight: 600 }
const TD_S = { padding: '12px 14px', verticalAlign: 'top' as const }

function EventoRow({ e, onOpen }: { e: HistorialEvento; onOpen: () => void }) {
  const con = CONCEPTO_META[e.concepto] ?? CONCEPTO_META.PENDIENTE
  const mostrarConcepto = e.tipo_momento !== 'PLANEACION'
  return (
    <tr className="nx-row" onClick={onOpen} style={{ borderBottom: '1px solid #f1f1f3', cursor: 'pointer' }}>
      <td style={{ ...TD_S, whiteSpace: 'nowrap' }}>
        <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12, color: '#27272a' }}>{fdHora(e.registrado_at)}</div>
        <div style={{ fontSize: 10.5, color: '#a1a1aa', marginTop: 3 }}>{TIPO_SEG_LABEL[e.tipo_seguimiento] ?? e.tipo_seguimiento}</div>
      </td>
      <td style={TD_S}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#18181b' }}>{momentoLabel(e)}</span>
          {e.motivo_extraordinario && <Bdg tone="warn">Extraordinario</Bdg>}
          {e.tipo_momento === 'EVALUACION' && e.resultado_final && (
            <Bdg tone={e.resultado_final === 'APROBADO' ? 'ok' : 'err'}>
              {e.resultado_final === 'APROBADO' ? 'Aprobado' : 'No aprobado'}
            </Bdg>
          )}
        </div>
        {e.motivo_extraordinario && (
          <div style={{ fontSize: 10.5, color: '#71717a', marginTop: 3, maxWidth: 260 }}>{e.motivo_extraordinario}</div>
        )}
      </td>
      <td style={TD_S}>
        <div style={{ fontSize: 12.5, color: '#18181b', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {e.aprendiz_nombre}
        </div>
        <div style={{ fontSize: 10.5, color: '#a1a1aa', fontFamily: '"JetBrains Mono", monospace', marginTop: 2 }}>
          {e.aprendiz_documento} · # {e.numero_ficha}
        </div>
      </td>
      <td style={{ ...TD_S }}>
        <span style={{ fontSize: 12, color: e.empresa_nombre ? '#3f3f46' : '#c4c4c8', display: 'inline-block', maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom' }}>
          {e.empresa_nombre || '—'}
        </span>
      </td>
      <td style={TD_S}>
        {mostrarConcepto ? <Bdg tone={con.tone}>{con.label}</Bdg> : <span style={{ fontSize: 11, color: '#c4c4c8' }}>—</span>}
      </td>
      <td style={{ ...TD_S, whiteSpace: 'nowrap' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span title={e.firmado ? `Firmado ${e.firmado_at ? fd(e.firmado_at) : ''}` : 'Sin firmas completas'} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: e.firmado ? '#15803d' : '#c2410c' }}>
            <Ic n={e.firmado ? 'checkCircle' : 'clock'} s={12}/>Firma
          </span>
          {e.tiene_ubicacion && (
            <span title={e.ubicacion_ok ? 'Ubicación dentro de rango' : 'Ubicación fuera de rango'} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: e.ubicacion_ok ? '#15803d' : '#b91c1c' }}>
              <Ic n="pin" s={12}/>{e.ubicacion_ok ? 'GPS' : 'GPS!'}
            </span>
          )}
        </div>
      </td>
      <td style={{ ...TD_S, textAlign: 'right' }}>
        <Ic n="chevronRight" s={16} style={{ color: '#d4d4d8' }}/>
      </td>
    </tr>
  )
}

export function InstHistorial({ onOpenEtapa }: { onOpenEtapa: (etapaId: number) => void }) {
  "use no memo"
  const [data, setData] = useState<InstructorHistorial | null>(null)
  const [error, setError] = useState(false)
  const [filt, setFilt] = useState<TipoFilt>('TODOS')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)

  useEffect(() => {
    api.get<InstructorHistorial>('/instructores/mi/historial')
      .then(r => setData(r.data))
      .catch(() => setError(true))
  }, [])

  if (error) return <Card style={{ padding: 24 }}><CenterState icon="alert" title="No se pudo cargar tu historial" sub="Verifica la conexión con el servidor."/></Card>
  if (!data) return <LoadingBlock/>

  const counts: Record<TipoFilt, number> = {
    TODOS: data.eventos.length,
    PLANEACION: data.eventos.filter(e => e.tipo_momento === 'PLANEACION').length,
    SEGUIMIENTO: data.eventos.filter(e => e.tipo_momento === 'SEGUIMIENTO').length,
    EVALUACION: data.eventos.filter(e => e.tipo_momento === 'EVALUACION').length,
  }

  const ql = q.trim().toLowerCase()
  const view = data.eventos.filter(e => {
    if (filt !== 'TODOS' && e.tipo_momento !== filt) return false
    if (ql && ![e.aprendiz_nombre, e.aprendiz_documento, e.numero_ficha, e.empresa_nombre]
      .some(s => (s ?? '').toLowerCase().includes(ql))) return false
    return true
  })

  const pageCount = Math.ceil(view.length / PAGE_SIZE)
  const curPage = Math.min(page, Math.max(0, pageCount - 1))
  const pageItems = view.slice(curPage * PAGE_SIZE, (curPage + 1) * PAGE_SIZE)

  const ultimo = data.eventos[0]?.registrado_at ?? null

  return (
    <div style={{ maxWidth: 1200 }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 24, fontWeight: 700, color: '#4f46e5', lineHeight: 1 }}>
            {data.total.toLocaleString('es-CO')}
          </span>
          <span style={{ fontSize: 13, color: '#52525b' }}>
            registros en total
            {' · '}<span>{counts.SEGUIMIENTO} seguimientos</span>
            {' · '}<span>{counts.PLANEACION} planeaciones</span>
            {' · '}<span>{counts.EVALUACION} evaluaciones</span>
            {ultimo && <> · último {fd(ultimo)}</>}
          </span>
        </div>
      </div>

      {data.total > 0 && (
        <Card style={{ padding: '16px 18px', marginBottom: 20 }}>
          <Heatmap actividad={data.actividad}/>
        </Card>
      )}

      <div className="inst-toolbar">
        <div className="inst-chips">
          {TIPO_CHIPS.map(c => (
            <button key={c.key} onClick={() => { setFilt(c.key); setPage(0) }}
              className={`inst-chip${filt === c.key ? ' inst-chip--active' : ''}`}>
              {c.label}<span className="inst-chip__count">{counts[c.key]}</span>
            </button>
          ))}
        </div>
        <div className="inst-search">
          <Ic n="search" s={14} className="inst-search__icon" style={{ color: '#a1a1aa' }}/>
          <input className="inst-search__input" placeholder="Buscar aprendiz, ficha o empresa…" value={q} onChange={e => { setQ(e.target.value); setPage(0) }}/>
        </div>
      </div>

      {view.length === 0 ? (
        <Card><CenterState icon="clock" title={data.total === 0 ? 'Todavía no has registrado nada' : 'Sin registros'}
          sub={data.total === 0 ? 'Cuando diligencies una planeación, seguimiento o evaluación, quedará acá con su fecha, aprendiz y ficha.' : 'Ningún registro coincide con el filtro.'}/></Card>
      ) : (
        <>
          <Card style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead>
                  <tr style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#52525b', borderBottom: '1px solid #e4e4e7' }}>
                    <th style={TH_S}>Cuándo</th>
                    <th style={TH_S}>Momento</th>
                    <th style={TH_S}>Aprendiz · ficha</th>
                    <th style={TH_S}>Empresa</th>
                    <th style={TH_S}>Concepto</th>
                    <th style={TH_S}>Firma · GPS</th>
                    <th style={TH_S}/>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((e, i) => {
                    const mk = mesKey(e.registrado_at)
                    const nuevoMes = i === 0 || mesKey(pageItems[i - 1].registrado_at) !== mk
                    return (
                      <Fragment key={e.id}>
                        {nuevoMes && (
                          <tr>
                            <td colSpan={7} style={{ padding: '11px 14px 7px', background: '#fbfbfc', borderTop: i === 0 ? 'none' : '2px solid #ececef' }}>
                              <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#52525b' }}>
                                {mesLargo(e.registrado_at)}
                              </span>
                              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, fontWeight: 600, color: '#a1a1aa', marginLeft: 8 }}>
                                {view.filter(x => mesKey(x.registrado_at) === mk).length}
                              </span>
                            </td>
                          </tr>
                        )}
                        <EventoRow e={e} onOpen={() => onOpenEtapa(e.etapa_id)}/>
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
          <Pager page={curPage} pageCount={pageCount} total={view.length} pageSize={PAGE_SIZE} onPage={setPage} noun="registros"/>
        </>
      )}
    </div>
  )
}
