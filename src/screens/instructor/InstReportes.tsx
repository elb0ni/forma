import { useState, useEffect } from 'react'
import { BrandMark, Btn, Card } from '../../components/ui'
import { FirmaModal } from '../../components/FirmaModal'
import api from '../../lib/api'
import { SM, fd, jornadaLabel, LoadingBlock, CenterState } from './parts'
import type { ReporteInstructor, FichaInstructor } from './types'
import './instructor.css'

function hoyISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function hace3MesesISO(): string {
  const d = new Date(); d.setMonth(d.getMonth() - 3)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function InstReportes({ initialFichaId }: { initialFichaId?: number }) {
  "use no memo"
  const [fichas, setFichas] = useState<FichaInstructor[]>([])
  const [fichaId, setFichaId] = useState<string>(initialFichaId ? String(initialFichaId) : '')
  const [desde, setDesde] = useState(hace3MesesISO())
  const [hasta, setHasta] = useState(hoyISO())
  const [data, setData] = useState<ReporteInstructor | null>(null)
  const [loading, setLoading] = useState(true)
  const [firmaOpen, setFirmaOpen] = useState(false)

  useEffect(() => {
    api.get<FichaInstructor[]>('/dashboard/instructor/fichas').then(r => setFichas(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    const p = new URLSearchParams()
    if (fichaId) p.set('ficha_id', fichaId)
    if (desde) p.set('desde', desde)
    if (hasta) p.set('hasta', hasta)
    const qs = p.toString()
    api.get<ReporteInstructor>(`/dashboard/instructor/reporte${qs ? '?' + qs : ''}`)
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [fichaId, desde, hasta])

  return (
    <div style={{ maxWidth: 1280 }}>
      <h2 style={{ fontSize: 22, fontWeight: 600, color: '#0a0a0b', marginBottom: 24 }}>Reportes ejecutivos</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24, alignItems: 'start' }}>
        {/* Parámetros */}
        <Card style={{ padding: 20, position: 'sticky', top: 80 }}>
          <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#71717a', fontWeight: 600, marginBottom: 14 }}>Parámetros</div>

          <Lbl text="Ficha">
            <select className="nx-input" value={fichaId} onChange={e => setFichaId(e.target.value)}>
              <option value="">Todas mis fichas</option>
              {fichas.map(f => <option key={f.id} value={f.id}>{f.programa_codigo} · {f.numero_ficha}</option>)}
            </select>
          </Lbl>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
            <Lbl text="Desde"><input type="date" className="nx-input" value={desde} onChange={e => setDesde(e.target.value)}/></Lbl>
            <Lbl text="Hasta"><input type="date" className="nx-input" value={hasta} onChange={e => setHasta(e.target.value)}/></Lbl>
          </div>

          <div style={{ borderTop: '1px solid #e4e4e7', marginTop: 18, paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Btn variant="primary" icon="download" style={{ width: '100%', justifyContent: 'center' }} onClick={() => window.print()}>Descargar PDF</Btn>
            <Btn variant="secondary" icon="download" style={{ width: '100%', justifyContent: 'center' }} onClick={() => window.print()}>Imprimir</Btn>
            <Btn variant="ghost" icon="fileText" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setFirmaOpen(true)}>Mi firma</Btn>
            <div style={{ fontSize: 11, color: '#71717a', textAlign: 'center' }}>Tu firma certifica las guías de aprendizaje que descargas.</div>
          </div>
        </Card>
        {firmaOpen && <FirmaModal userId="me" onClose={() => setFirmaOpen(false)}/>}

        {/* Vista previa */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0a0a0b', marginBottom: 4 }}>Vista previa</div>
          <div style={{ fontSize: 11.5, color: '#52525b', marginBottom: 12 }}>primera página del reporte</div>

          {loading ? <Card style={{ padding: 40 }}><LoadingBlock minHeight={320}/></Card>
            : !data ? <Card style={{ padding: 40 }}><CenterState icon="alert" title="No se pudo generar el reporte"/></Card>
            : <ReportePreview data={data} desde={desde} hasta={hasta}/>}
        </div>
      </div>
    </div>
  )
}

function ReportePreview({ data, desde, hasta }: { data: ReporteInstructor; desde: string; hasta: string }) {
  const stats: [string, string][] = [
    ['Fichas', String(data.resumen.fichas)],
    ['Avance prom.', `${data.resumen.avance_promedio}%`],
    ['Comp. cerradas', String(data.resumen.competencias_cerradas)],
    ['Sesiones', String(data.resumen.sesiones)],
  ]

  return (
    <Card style={{ padding: 40, display: 'flex', flexDirection: 'column', minHeight: 600 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e4e4e7', paddingBottom: 18, marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <BrandMark size={20}/>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600 }}>FORMA</div>
            <div style={{ fontSize: 9, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Reporte del instructor</div>
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 10, color: '#71717a' }}>
          <div>Generado · {fd(data.generado)}</div>
          <div style={{ fontFamily: '"JetBrains Mono", monospace' }}>{data.centro_nombre}</div>
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#71717a' }}>Instructor</div>
        <div style={{ fontSize: 18, fontWeight: 600, color: '#0a0a0b', marginTop: 4 }}>{data.instructor_nombre}</div>
        <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5, color: '#71717a', marginTop: 2 }}>
          {fd(desde)} — {fd(hasta)}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 18 }}>
        {stats.map(([l, v]) => (
          <div key={l} style={{ border: '1px solid #e4e4e7', borderRadius: 6, padding: 10 }}>
            <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#71717a' }}>{l}</div>
            <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 18, fontWeight: 600, color: '#0a0a0b', marginTop: 4 }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#71717a', marginBottom: 8 }}>Avance por ficha</div>
        {data.fichas.length === 0 ? (
          <div style={{ fontSize: 12, color: '#71717a', padding: '20px 0' }}>No hay fichas en el alcance seleccionado.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e4e4e7', fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#71717a' }}>
                {['Ficha', 'Jornada', 'Avance', 'Cierre', 'Estado'].map(h => (
                  <th key={h} style={{ padding: '6px 0', textAlign: h === 'Estado' ? 'right' : 'left', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.fichas.map(f => (
                <tr key={f.id} style={{ borderBottom: '1px solid #f1f1f3' }}>
                  <td style={{ padding: '6px 0', fontFamily: '"JetBrains Mono", monospace', fontWeight: 600, color: '#0a0a0b' }}>{f.numero_ficha}</td>
                  <td style={{ padding: '6px 0', color: '#3f3f46' }}>{jornadaLabel(f.jornada)}</td>
                  <td style={{ padding: '6px 0' }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <div style={{ width: 50, height: 3, background: '#f1f1f3', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${f.avance}%`, background: SM[f.status].dot }}/>
                      </div>
                      <span style={{ fontFamily: '"JetBrains Mono", monospace' }}>{f.avance}%</span>
                    </div>
                  </td>
                  <td style={{ padding: '6px 0', fontFamily: '"JetBrains Mono", monospace', color: '#27272a' }}>{fd(f.fecha_fin_lectiva)}</td>
                  <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600, color: SM[f.status].fg, fontSize: 9.5, textTransform: 'uppercase' }}>{SM[f.status].label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ fontSize: 9.5, color: '#71717a', marginTop: 14, paddingTop: 10, borderTop: '1px solid #e4e4e7', display: 'flex', justifyContent: 'space-between' }}>
        <span>FORMA · Plataforma de seguimiento curricular</span>
        <span style={{ fontFamily: '"JetBrains Mono", monospace' }}>página 1 / 1</span>
      </div>
    </Card>
  )
}

function Lbl({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 500, color: '#27272a', marginBottom: 6 }}>{text}</div>
      {children}
    </div>
  )
}
