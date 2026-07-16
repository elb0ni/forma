import { useState, useEffect } from 'react'
import { BrandMark, Btn, Card, Ic } from '../../components/ui'
import api from '../../lib/api'
import { LoadingBlock, CenterState } from '../instructor/parts'
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

// Qué filtros aplica cada reporte (para mostrar solo los relevantes).
const USA_CENTRO = new Set(['avance-fichas', 'riesgo', 'instructores'])
const USA_ESTADO = new Set(['avance-fichas'])
const USA_FECHAS = new Set(['cumplimiento', 'evidencias'])

const ESTADOS = ['AL DÍA', 'REVISAR', 'EN RIESGO', 'CRÍTICO', 'SIN DIGITALIZAR']

// Estados que se pintan como "chip" de color en la tabla.
const ESTADO_COLOR: Record<string, { bg: string; fg: string }> = {
  'AL DÍA':          { bg: '#dcfce7', fg: '#15803d' },
  'REVISAR':         { bg: '#fef9c3', fg: '#a16207' },
  'EN RIESGO':       { bg: '#ffedd5', fg: '#c2410c' },
  'CRÍTICO':         { bg: '#fee2e2', fg: '#b91c1c' },
  'SIN DIGITALIZAR': { bg: '#f1f1f3', fg: '#52525b' },
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

export function ReportesAdmin({ base = '/dashboard/super-admin', allowCentro = true }: {
  base?: string; allowCentro?: boolean
} = {}) {
  "use no memo"
  const [metas, setMetas]     = useState<ReporteMeta[]>([])
  const [centros, setCentros] = useState<CentroOpt[]>([])
  const [tipo, setTipo]       = useState('')
  const [centroId, setCentroId] = useState('')
  const [estado, setEstado]   = useState('')
  const [desde, setDesde]     = useState(hace3MesesISO())
  const [hasta, setHasta]     = useState(hoyISO())
  const [data, setData]       = useState<ReporteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)

  useEffect(() => {
    api.get<ReporteMeta[]>(`${base}/reportes`)
      .then(r => { setMetas(r.data); setTipo(t => t || (r.data[0]?.tipo ?? '')) })
      .catch(() => {})
    if (allowCentro) api.get<CentroOpt[]>('/dashboard/super-admin/centros').then(r => setCentros(r.data)).catch(() => {})
  }, [base, allowCentro])

  useEffect(() => {
    if (!tipo) return
    setLoading(true); setError(false)
    const p = new URLSearchParams()
    if (allowCentro && USA_CENTRO.has(tipo) && centroId) p.set('centro_id', centroId)
    if (USA_ESTADO.has(tipo) && estado) p.set('estado', estado)
    if (USA_FECHAS.has(tipo)) { if (desde) p.set('desde', desde); if (hasta) p.set('hasta', hasta) }
    const qs = p.toString()
    api.get<ReporteData>(`${base}/reportes/${tipo}${qs ? '?' + qs : ''}`)
      .then(r => setData(r.data))
      .catch(() => { setData(null); setError(true) })
      .finally(() => setLoading(false))
  }, [base, allowCentro, tipo, centroId, estado, desde, hasta])

  // Reportes agrupados para el selector
  const grupos = metas.reduce<Record<string, ReporteMeta[]>>((acc, m) => {
    (acc[m.grupo] = acc[m.grupo] ?? []).push(m); return acc
  }, {})

  return (
    <div className="rep-wrap">
      <h2 style={{ fontSize: 22, fontWeight: 600, color: '#0a0a0b', marginBottom: 4 }}>Reportes ejecutivos</h2>
      <div style={{ fontSize: 13, color: '#52525b', marginBottom: 24 }}>
        Resultados, alertas y cumplimiento de la Regional Atlántico.
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

          {((allowCentro && USA_CENTRO.has(tipo)) || USA_ESTADO.has(tipo) || USA_FECHAS.has(tipo)) && (
            <div style={{ borderTop: '1px solid #e4e4e7', paddingTop: 14 }}>
              <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#71717a', fontWeight: 600, marginBottom: 12 }}>Filtros</div>
              {allowCentro && USA_CENTRO.has(tipo) && (
                <Lbl text="Centro">
                  <select className="nx-input" value={centroId} onChange={e => setCentroId(e.target.value)}>
                    <option value="">Todos los centros</option>
                    {centros.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </Lbl>
              )}
              {USA_ESTADO.has(tipo) && (
                <Lbl text="Estado" style={{ marginTop: 12 }}>
                  <select className="nx-input" value={estado} onChange={e => setEstado(e.target.value)}>
                    <option value="">Todos</option>
                    {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Lbl>
              )}
              {USA_FECHAS.has(tipo) && (
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
            : error || !data ? <Card style={{ padding: 40 }}><CenterState icon="alert" title="No se pudo generar el reporte"/></Card>
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
        {/* Cabecera */}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #4f46e5', paddingBottom: 16, marginBottom: 18 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <BrandMark size={22}/>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.5px', color: '#4f46e5' }}>FORMA</div>
              <div style={{ fontSize: 9, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Plataforma de seguimiento curricular</div>
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 10, color: '#71717a' }}>
            <div>SENA · Regional Atlántico</div>
            <div>Generado · {fd(data.generado)}</div>
          </div>
        </div>

        {/* Título */}
        <h1 style={{ fontSize: 19, fontWeight: 700, color: '#0a0a0b', margin: '0 0 2px' }}>{data.titulo}</h1>
        <div style={{ fontSize: 11.5, color: '#52525b', marginBottom: 18 }}>{data.subtitulo}</div>

        {/* KPIs resumen */}
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

        {/* Tabla */}
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
                    const isEstado = c.key === 'estado' && typeof v === 'string' && ESTADO_COLOR[v]
                    return (
                      <td key={c.key} style={{ textAlign: c.align ?? 'left', fontFamily: c.mono ? '"JetBrains Mono", monospace' : undefined }}>
                        {isEstado
                          ? <span className="rep-chip" style={{ background: ESTADO_COLOR[v as string].bg, color: ESTADO_COLOR[v as string].fg }}>{v}</span>
                          : (v ?? '—')}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pie */}
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
