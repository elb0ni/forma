import { useState, useEffect } from 'react'
import { BrandMark, Btn, Card, Ic } from '../../components/ui'
import api from '../../lib/api'
import { LoadingBlock, CenterState, centroLabel } from './parts'
import './ReportesAdmin.css'

// ─── Tipos ───────────────────────────────────────────────────────────────────────

interface ReporteMeta { tipo: string; titulo: string; grupo: string }

interface Columna { key: string; label: string; align?: 'left' | 'right'; mono?: boolean }
interface ReporteData {
  tipo: string
  titulo: string
  subtitulo: string
  generado: string
  resumen: { label: string; value: string }[]
  columnas: Columna[]
  filas: Record<string, string | number>[]
}

interface CentroOpt { id: number; nombre: string }
interface CoordOpt  { id: number; nombre: string; centro_formacion_id: number | null }

// Solo estos reportes aceptan rango de fechas (seguimientos / etapas por fecha).
const USA_FECHAS = new Set(['etapas-por-cerrar', 'conceptos-por-resolver'])

// Color de la celda "Plan"/"Estado" de la tabla del documento.
function chipTone(v: string): { bg: string; fg: string } {
  const s = v.toLowerCase()
  if (s.includes('vencida') || s.includes('sin plan') || s.includes('no aprob')) return { bg: '#fee2e2', fg: '#b91c1c' }
  if (s.includes('hoy') || s.includes('con plan')) return { bg: '#fef9c3', fg: '#a16207' }
  if (s.includes('faltan') || s.includes('aprob')) return { bg: '#dcfce7', fg: '#15803d' }
  return { bg: '#f1f1f3', fg: '#52525b' }
}

function hoyISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function hace3MesesISO() {
  const d = new Date(); d.setMonth(d.getMonth() - 3)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function fd(s: string) {
  if (!s) return '—'
  const d = new Date(s)
  return isNaN(d.getTime()) ? s : d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ─── Pantalla ──────────────────────────────────────────────────────────────────
// `coordinacionId`: cuando lo usa un coordinador, todos los reportes van acotados
// a su coordinación (y no puede cambiar el filtro). Super admin: sin scope fijo.

export function ReportesAdmin({ coordinacionId, allowCentro = true }: {
  coordinacionId?: number
  allowCentro?: boolean
} = {}) {
  "use no memo"
  const [metas, setMetas]     = useState<ReporteMeta[]>([])
  const [centros, setCentros] = useState<CentroOpt[]>([])
  const [coords, setCoords]   = useState<CoordOpt[]>([])
  const [tipo, setTipo]       = useState('')
  const [centroId, setCentroId] = useState('')
  const [coordId, setCoordId]   = useState('')
  const [desde, setDesde]     = useState(hace3MesesISO())
  const [hasta, setHasta]     = useState(hoyISO())
  const [data, setData]       = useState<ReporteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    api.get<ReporteMeta[]>('/reportes')
      .then(r => { setMetas(r.data); setTipo(t => t || (r.data[0]?.tipo ?? '')) })
      .catch(() => {})
    if (allowCentro) {
      api.get<CentroOpt[]>('/centros').then(r => setCentros(r.data)).catch(() => {})
      api.get<CoordOpt[]>('/coordinaciones').then(r => setCoords(r.data)).catch(() => {})
    }
  }, [allowCentro])

  useEffect(() => {
    if (!tipo) return
    setLoading(true); setError(null)
    const p = new URLSearchParams()
    if (coordinacionId != null) p.set('coordinacion_id', String(coordinacionId))
    else if (allowCentro) {
      if (centroId) p.set('centro_id', centroId)
      if (coordId) p.set('coordinacion_id', coordId)
    }
    if (USA_FECHAS.has(tipo)) { if (desde) p.set('desde', desde); if (hasta) p.set('hasta', hasta) }
    const qs = p.toString()
    api.get<ReporteData>(`/reportes/${tipo}${qs ? '?' + qs : ''}`)
      .then(r => setData(r.data))
      .catch((e: unknown) => {
        setData(null)
        const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
        setError(typeof msg === 'string' ? msg : 'No se pudo generar el reporte.')
      })
      .finally(() => setLoading(false))
  }, [allowCentro, coordinacionId, tipo, centroId, coordId, desde, hasta])

  const grupos = metas.reduce<Record<string, ReporteMeta[]>>((acc, m) => {
    (acc[m.grupo] = acc[m.grupo] ?? []).push(m); return acc
  }, {})

  const coordsVisibles = centroId
    ? coords.filter(c => String(c.centro_formacion_id) === centroId)
    : coords
  const usaFechas = USA_FECHAS.has(tipo)
  const hayFiltros = allowCentro && coordinacionId == null

  return (
    <div className="rep-wrap">
      <h2 style={{ fontSize: 22, fontWeight: 600, color: '#0a0a0b', marginBottom: 4 }}>Reportes de práctica</h2>
      <div style={{ fontSize: 13, color: '#52525b', marginBottom: 24 }}>
        Cobertura de instructor, estado de los aprendices y seguimiento — {coordinacionId != null ? 'tu coordinación' : 'Regional Atlántico'}.
      </div>

      <div className="rep-grid">
        {/* Parámetros */}
        <Card style={{ padding: 20, position: 'sticky', top: 80, alignSelf: 'start' }}>
          <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#71717a', fontWeight: 600, marginBottom: 14 }}>Reporte</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
            {Object.entries(grupos).map(([grupo, items]) => (
              <div key={grupo}>
                <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a1a1aa', fontWeight: 600, margin: '8px 0 4px' }}>{grupo}</div>
                {items.map(m => {
                  const active = tipo === m.tipo
                  return (
                    <button key={m.tipo} onClick={() => setTipo(m.tipo)} className={`rep-pick${active ? ' rep-pick--active' : ''}`}>
                      {m.titulo}
                      {active && <Ic n="check" s={14}/>}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>

          {(hayFiltros || usaFechas) && (
            <div style={{ borderTop: '1px solid #e4e4e7', paddingTop: 14 }}>
              <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#71717a', fontWeight: 600, marginBottom: 12 }}>Filtros</div>
              {hayFiltros && (
                <>
                  <Lbl text="Centro">
                    <select className="nx-input" value={centroId} onChange={e => { setCentroId(e.target.value); setCoordId('') }}>
                      <option value="">Todos los centros</option>
                      {centros.map(c => <option key={c.id} value={c.id}>{centroLabel(c.nombre)}</option>)}
                    </select>
                  </Lbl>
                  <Lbl text="Coordinación" style={{ marginTop: 12 }}>
                    <select className="nx-input" value={coordId} onChange={e => setCoordId(e.target.value)}>
                      <option value="">Todas las coordinaciones</option>
                      {coordsVisibles.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </Lbl>
                </>
              )}
              {usaFechas && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                  <Lbl text="Desde"><input type="date" className="nx-input" value={desde} onChange={e => setDesde(e.target.value)}/></Lbl>
                  <Lbl text="Hasta"><input type="date" className="nx-input" value={hasta} onChange={e => setHasta(e.target.value)}/></Lbl>
                </div>
              )}
            </div>
          )}

          <div style={{ borderTop: '1px solid #e4e4e7', marginTop: 18, paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Btn variant="primary" icon="download" style={{ width: '100%', justifyContent: 'center' }} onClick={() => window.print()}>Descargar PDF</Btn>
            <Btn variant="secondary" icon="download" style={{ width: '100%', justifyContent: 'center' }} onClick={() => window.print()}>Imprimir</Btn>
          </div>
        </Card>

        {/* Vista previa */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0a0a0b', marginBottom: 4 }}>Vista previa</div>
          <div style={{ fontSize: 11.5, color: '#52525b', marginBottom: 12 }}>El reporte se imprime tal cual lo ves.</div>
          {loading ? <Card style={{ padding: 40 }}><LoadingBlock minHeight={320}/></Card>
            : error || !data ? <Card style={{ padding: 40 }}><CenterState icon="alert" title="No se pudo generar el reporte" sub={error ?? undefined}/></Card>
            : <ReportePreview data={data}/>}
        </div>
      </div>
    </div>
  )
}

// ─── Documento imprimible (genérico para cualquier reporte) ──────────────────────

function ReportePreview({ data }: { data: ReporteData }) {
  return (
    <Card style={{ padding: 40 }} >
      <div className="rep-doc">
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #4f46e5', paddingBottom: 16, marginBottom: 18 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <BrandMark size={22}/>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.5px', color: '#4f46e5' }}>FORMA</div>
              <div style={{ fontSize: 9, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Plataforma de seguimiento de etapa productiva</div>
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 10, color: '#71717a' }}>
            <div>SENA · Regional Atlántico</div>
            <div>Generado · {fd(data.generado)}</div>
          </div>
        </div>

        <h1 style={{ fontSize: 19, fontWeight: 700, color: '#0a0a0b', margin: '0 0 2px' }}>{data.titulo}</h1>
        <div style={{ fontSize: 11.5, color: '#52525b', marginBottom: 18 }}>{data.subtitulo}</div>

        {data.resumen.length > 0 && (
          <div className="rep-kpis">
            {data.resumen.map(k => (
              <div key={k.label} className="rep-kpi">
                <div className="rep-kpi__label">{k.label}</div>
                <div className="rep-kpi__value">{k.value}</div>
              </div>
            ))}
          </div>
        )}

        {data.filas.length === 0 ? (
          <div style={{ fontSize: 12.5, color: '#71717a', padding: '24px 0', textAlign: 'center', border: '1px dashed #e4e4e7', borderRadius: 8 }}>
            Sin datos para los parámetros seleccionados.
          </div>
        ) : (
          <table className="rep-table">
            <thead>
              <tr>
                {data.columnas.map(c => (
                  <th key={c.key} style={{ textAlign: c.align ?? 'left' }}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.filas.map((row, i) => (
                <tr key={i}>
                  {data.columnas.map(c => {
                    const v = row[c.key]
                    const isChip = c.key === 'estado' && typeof v === 'string'
                    const tone = isChip ? chipTone(v) : null
                    return (
                      <td key={c.key} style={{ textAlign: c.align ?? 'left', fontFamily: c.mono ? '"JetBrains Mono", monospace' : undefined }}>
                        {tone
                          ? <span className="rep-chip" style={{ background: tone.bg, color: tone.fg }}>{v}</span>
                          : (v ?? '—')}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div style={{ marginTop: 22, paddingTop: 10, borderTop: '1px solid #e4e4e7', display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: '#a1a1aa' }}>
          <span>FORMA · {data.titulo}</span>
          <span style={{ fontFamily: '"JetBrains Mono", monospace' }}>{data.filas.length} registros</span>
        </div>
      </div>
    </Card>
  )
}

function Lbl({ text, children, style }: { text: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={style}>
      <div style={{ fontSize: 12, fontWeight: 500, color: '#27272a', marginBottom: 6 }}>{text}</div>
      {children}
    </div>
  )
}
