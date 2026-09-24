import { useState, useEffect } from 'react'
import { BrandMark, Btn, Card, Bdg } from '../../components/ui'
import { FirmaModal } from '../../components/FirmaModal'
import { useAuthStore } from '../../store/auth'
import api from '../../lib/api'
import { fd, LoadingBlock } from '../shared/parts'
import { tonoEtapa, MODALIDAD_LABEL } from '../productiva/types'
import type { EtapaProductiva, CasoTono } from '../productiva/types'
import './instructor.css'

function hoyISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function hace3MesesISO(): string {
  const d = new Date(); d.setMonth(d.getMonth() - 3)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Reporte del instructor centrado en etapa productiva: quiénes son sus
// aprendices en práctica y en qué estado está cada uno (sin nada de
// currículo/avance lectivo).
export function InstReportes() {
  "use no memo"
  const user = useAuthStore(s => s.user)
  const [etapas, setEtapas] = useState<EtapaProductiva[] | null>(null)
  const [desde, setDesde] = useState(hace3MesesISO())
  const [hasta, setHasta] = useState(hoyISO())
  const [firmaOpen, setFirmaOpen] = useState(false)

  useEffect(() => {
    if (!user) return
    api.get<EtapaProductiva[]>(`/etapas-productivas?instructor_id=${user.id}`)
      .then(r => setEtapas(r.data))
      .catch(() => setEtapas(null))
  }, [user])

  const enRango = (etapas ?? []).filter(e => {
    const f = e.fecha_inicio.slice(0, 10)
    return (!desde || f >= desde) && (!hasta || f <= hasta)
  })

  return (
    <div style={{ maxWidth: 1280 }}>
      <h2 style={{ fontSize: 22, fontWeight: 600, color: '#0a0a0b', marginBottom: 24 }}>Reportes</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24, alignItems: 'start' }}>
        {/* Parámetros */}
        <Card style={{ padding: 20, position: 'sticky', top: 80 }}>
          <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#71717a', fontWeight: 600, marginBottom: 14 }}>Parámetros</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Lbl text="Inicio desde"><input type="date" className="nx-input" value={desde} onChange={e => setDesde(e.target.value)}/></Lbl>
            <Lbl text="Inicio hasta"><input type="date" className="nx-input" value={hasta} onChange={e => setHasta(e.target.value)}/></Lbl>
          </div>

          <div style={{ borderTop: '1px solid #e4e4e7', marginTop: 18, paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Btn variant="primary" icon="download" style={{ width: '100%', justifyContent: 'center' }} onClick={() => window.print()}>Descargar PDF</Btn>
            <Btn variant="secondary" icon="download" style={{ width: '100%', justifyContent: 'center' }} onClick={() => window.print()}>Imprimir</Btn>
            <Btn variant="ghost" icon="fileText" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setFirmaOpen(true)}>Mi firma</Btn>
            <div style={{ fontSize: 11, color: '#71717a', textAlign: 'center' }}>Tu firma certifica los seguimientos de etapa productiva.</div>
          </div>
        </Card>
        {firmaOpen && <FirmaModal userId="me" onClose={() => setFirmaOpen(false)}/>}

        {/* Vista previa */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0a0a0b', marginBottom: 4 }}>Vista previa</div>
          <div style={{ fontSize: 11.5, color: '#52525b', marginBottom: 12 }}>aprendices en etapa productiva a tu cargo</div>

          {etapas === null ? <Card style={{ padding: 40 }}><LoadingBlock minHeight={320}/></Card>
            : <ReportePreview instructorNombre={user?.nombre_completo ?? '—'} centro={user?.centro_formacion ?? '—'} etapas={enRango} desde={desde} hasta={hasta}/>}
        </div>
      </div>
    </div>
  )
}

const CASO_LABEL: Record<CasoTono, string> = {
  EN_CURSO: 'En curso', SIN_JUICIO: 'Falta juicio Sofia', APROBADO: 'Aprobado',
  NO_APROBADO: 'No aprobado', CANCELADA: 'Cancelada', SUSPENDIDA: 'Suspendida', APLAZADA: 'Aplazada',
}

function ReportePreview({ instructorNombre, centro, etapas, desde, hasta }: {
  instructorNombre: string; centro: string; etapas: EtapaProductiva[]; desde: string; hasta: string
}) {
  const conTono = etapas.map(e => ({ e, tono: tonoEtapa(e) }))
  const stats: [string, string][] = [
    ['Aprendices', String(etapas.length)],
    ['En curso', String(conTono.filter(x => x.tono.caso === 'EN_CURSO').length)],
    ['Aprobados', String(conTono.filter(x => x.tono.caso === 'APROBADO').length)],
    ['No aprobados', String(conTono.filter(x => x.tono.caso === 'NO_APROBADO').length)],
  ]

  return (
    <Card style={{ padding: 40, display: 'flex', flexDirection: 'column', minHeight: 600 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e4e4e7', paddingBottom: 18, marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <BrandMark size={20}/>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600 }}>FORMA</div>
            <div style={{ fontSize: 9, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Reporte de etapa productiva</div>
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 10, color: '#71717a' }}>
          <div>Generado · {fd(new Date().toISOString())}</div>
          <div style={{ fontFamily: '"JetBrains Mono", monospace' }}>{centro}</div>
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#71717a' }}>Instructor de práctica</div>
        <div style={{ fontSize: 18, fontWeight: 600, color: '#0a0a0b', marginTop: 4 }}>{instructorNombre}</div>
        <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5, color: '#71717a', marginTop: 2 }}>
          Inicio de etapa entre {fd(desde)} — {fd(hasta)}
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
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#71717a', marginBottom: 8 }}>Aprendices</div>
        {conTono.length === 0 ? (
          <div style={{ fontSize: 12, color: '#71717a', padding: '20px 0' }}>No hay registros en el rango seleccionado.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e4e4e7', fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#71717a' }}>
                {['Aprendiz', 'Modalidad', 'Inicio', 'Estado'].map(h => (
                  <th key={h} style={{ padding: '6px 0', textAlign: h === 'Estado' ? 'right' : 'left', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {conTono.map(({ e, tono }) => (
                <tr key={e.id} style={{ borderBottom: '1px solid #f1f1f3' }}>
                  <td style={{ padding: '6px 0', fontWeight: 600, color: '#0a0a0b' }}>{e.aprendiz_nombre ?? `#${e.aprendiz_id}`}</td>
                  <td style={{ padding: '6px 0', color: '#3f3f46' }}>{MODALIDAD_LABEL[e.modalidad]}</td>
                  <td style={{ padding: '6px 0', fontFamily: '"JetBrains Mono", monospace', color: '#27272a' }}>{fd(e.fecha_inicio)}</td>
                  <td style={{ padding: '6px 0', textAlign: 'right' }}><Bdg tone={tono.tone}>{CASO_LABEL[tono.caso]}</Bdg></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ fontSize: 9.5, color: '#71717a', marginTop: 14, paddingTop: 10, borderTop: '1px solid #e4e4e7', display: 'flex', justifyContent: 'space-between' }}>
        <span>FORMA · Seguimiento de etapa productiva</span>
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
