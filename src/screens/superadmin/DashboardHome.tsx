import { useState, useEffect } from 'react'
import { Ic, Card, Prog } from '../../components/ui'
import type { IcName } from '../../components/ui'
import api from '../../lib/api'
import { diasHasta } from '../shared/parts'
import type { FichaRow } from '../shared/FichasAdmin'
import './DashboardHome.css'

// Solo los campos estructurales de `/dashboard/super-admin/resumen` que
// siguen aplicando sin currículo -- el resto del payload (programas
// digitalizados, fichas en riesgo por avance lectivo, etc.) ya no se usa.
interface ResumenKPI {
  instructores_activos_semana:  number
  instructores_total_asignados: number
}

interface CentroMin { id: number; coordinaciones_academicas: number }

function Sk({ w, h, r = 5, delay = 0 }: { w: string | number; h: number; r?: number; delay?: number }) {
  return <div className="skeleton" style={{ width: w, height: h, borderRadius: r, animationDelay: `${delay}ms` }}/>
}

function EmptyState({ icon, title, sub }: { icon: IcName; title: string; sub: string }) {
  return (
    <Card style={{ padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
      <Ic n={icon} s={24} style={{ color: '#a1a1aa' }}/>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0a0a0b' }}>{title}</div>
      <div style={{ fontSize: 12.5, color: '#71717a' }}>{sub}</div>
    </Card>
  )
}

// ─── KPI cards ──────────────────────────────────────────────────────────────────

function KpiCards({ resumen, fichas, centros }: { resumen: ResumenKPI | null; fichas: FichaRow[]; centros: CentroMin[] }) {
  const enPractica = fichas.filter(f => f.estado === 'EN_EJECUCION' && f.etapa_actual_teorica === 'PRACTICA')
  const cierranPronto = enPractica.filter(f => {
    const d = diasHasta(f.fecha_fin_productiva)
    return d != null && d <= 30
  }).length

  const activePct = resumen && resumen.instructores_total_asignados > 0
    ? Math.round((resumen.instructores_activos_semana / resumen.instructores_total_asignados) * 100)
    : 0

  const coordinaciones = centros.reduce((a, c) => a + c.coordinaciones_academicas, 0)

  return (
    <>
      {/* Fichas en etapa productiva */}
      <Card style={{ padding: 20 }}>
        <div className="kpi2-head">
          <div className="kpi2-label">Fichas en etapa práctica</div>
          <Ic n="briefcase" s={16} style={{ color: '#4f46e5' }}/>
        </div>
        <div className="kpi2-value">
          {enPractica.length}
          <span className="kpi2-value-sub"> / {fichas.filter(f => f.estado === 'EN_EJECUCION').length} en ejecución</span>
        </div>
        <div className="kpi2-sub">
          {cierranPronto > 0 ? `${cierranPronto} cierran en ≤30 días` : 'Ninguna cierra en los próximos 30 días'}
        </div>
      </Card>

      {/* Instructores activos */}
      <Card style={{ padding: 20 }}>
        <div className="kpi2-head">
          <div className="kpi2-label">Instructores activos</div>
          <Ic n="users" s={16} style={{ color: '#4f46e5' }}/>
        </div>
        <div className="kpi2-value">
          {resumen?.instructores_activos_semana ?? '—'}
          <span className="kpi2-value-sub"> / {resumen?.instructores_total_asignados ?? '—'}</span>
        </div>
        <Prog value={activePct} style={{ marginTop: 10 }}/>
        <div className="kpi2-sub">{activePct}% activos esta semana</div>
      </Card>

      {/* Estructura regional */}
      <Card style={{ padding: 20 }}>
        <div className="kpi2-head">
          <div className="kpi2-label">Centros y coordinaciones</div>
          <Ic n="shield" s={16} style={{ color: '#4f46e5' }}/>
        </div>
        <div className="kpi2-value">
          {centros.length}
          <span className="kpi2-value-sub"> centros</span>
        </div>
        <div className="kpi2-sub">{coordinaciones} coordinaciones académicas</div>
      </Card>
    </>
  )
}

// ─── Fichas que cierran pronto ────────────────────────────────────────────────

function FichasCierranPronto({ fichas, onNav }: { fichas: FichaRow[]; onNav?: (id: string) => void }) {
  const cierran = fichas
    .filter(f => f.estado === 'EN_EJECUCION' && f.etapa_actual_teorica === 'PRACTICA')
    .map(f => ({ f, dias: diasHasta(f.fecha_fin_productiva) }))
    .filter((x): x is { f: FichaRow; dias: number } => x.dias != null && x.dias <= 30)
    .sort((a, b) => a.dias - b.dias)
    .slice(0, 8)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#0a0a0b' }}>Fichas que cierran pronto</div>
        <button onClick={() => onNav?.('admin-fichas')} style={{ fontSize: 12, color: '#4f46e5', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit' }}>
          Ver todas <Ic n="arrowRight" s={12}/>
        </button>
      </div>
      {cierran.length === 0 ? (
        <EmptyState icon="checkCircle" title="Sin cierres próximos" sub="Ninguna ficha en etapa práctica cierra en los próximos 30 días."/>
      ) : (
        <Card style={{ overflow: 'hidden' }}>
          {cierran.map(({ f, dias }, i) => (
            <div
              key={f.id}
              className={onNav ? 'nx-row' : undefined}
              onClick={() => onNav?.('admin-fichas')}
              style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
                borderBottom: i < cierran.length - 1 ? '1px solid #f1f1f3' : 'none',
                cursor: onNav ? 'pointer' : 'default',
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, fontWeight: 700, background: '#f1f1f3', color: '#52525b', padding: '2px 6px', borderRadius: 4 }}>{f.programa_codigo}</span>
                  <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12, fontWeight: 600, color: '#0a0a0b' }}># {f.numero_ficha}</span>
                </div>
                <div style={{ fontSize: 12, color: '#52525b', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.programa_nombre}</div>
              </div>
              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12, fontWeight: 600, color: '#dc2626', width: 44, textAlign: 'right' }}>{dias}d</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}

// ─── Acciones rápidas ───────────────────────────────────────────────────────────

const QUICK_ACTIONS: [IcName, string, string, string][] = [
  ['layers',    'Ver programas',      'Catálogo regional de formación', 'admin-programas'],
  ['users',     'Gestionar usuarios', 'Instructores y coordinadores',   'admin-usuarios'],
  ['briefcase', 'Gestionar fichas',   'Fichas en etapa práctica',       'admin-fichas'],
  ['shield',    'Centros y coordinaciones', 'Estructura regional',      'admin-centros'],
]

function QuickActions({ onNav }: { onNav?: (id: string) => void }) {
  return (
    <Card style={{ overflow: 'hidden' }}>
      <div className="qa-card-header">Acciones rápidas</div>
      {QUICK_ACTIONS.map(([ic, label, hint, dest], i) => (
        <button
          key={dest}
          onClick={() => onNav?.(dest)}
          className="qa-row"
          style={{ borderBottom: i < QUICK_ACTIONS.length - 1 ? '1px solid #f1f1f3' : 'none' }}
        >
          <div className="qa-icon"><Ic n={ic} s={16}/></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="qa-label">{label}</div>
            <div className="qa-hint">{hint}</div>
          </div>
          <Ic n="chevronRight" s={14} style={{ color: '#a1a1aa', flexShrink: 0 }}/>
        </button>
      ))}
    </Card>
  )
}

// ─── DashboardHome ─────────────────────────────────────────────────────────────
// Home ejecutivo del Super Admin, centrado en etapa productiva: KPIs
// regionales (fichas en práctica, instructores activos, estructura) +
// fichas que cierran pronto + accesos rápidos. Reemplaza el home anterior
// (tabs Digitalización/Operativo/Analítica, todos sobre currículo lectivo).
export function DashboardHome({ onNav }: { onNav?: (id: string) => void }) {
  "use no memo"
  const [resumen, setResumen] = useState<ResumenKPI | null>(null)
  const [fichas,  setFichas]  = useState<FichaRow[] | null>(null)
  const [centros, setCentros] = useState<CentroMin[] | null>(null)

  useEffect(() => {
    api.get<ResumenKPI>('/dashboard/super-admin/resumen').then(r => setResumen(r.data)).catch(() => {})
    api.get<FichaRow[]>('/fichas').then(r => setFichas(r.data)).catch(() => setFichas([]))
    api.get<CentroMin[]>('/dashboard/super-admin/centros').then(r => setCentros(r.data)).catch(() => setCentros([]))
  }, [])

  const loading = fichas === null || centros === null

  return (
    <div>
      <div className="dash-header">
        <div>
          <div className="dash-header__eyebrow">Dirección General</div>
          <h2 className="dash-header__title">Operación de la plataforma</h2>
        </div>
      </div>

      <div className="kpi-grid">
        {loading
          ? [0, 1, 2].map(i => (
              <Card key={i} style={{ padding: 20 }}>
                <Sk w="55%" h={9} delay={i * 40}/>
                <div style={{ marginTop: 14 }}><Sk w="42%" h={26} delay={i * 40 + 20}/></div>
                <div style={{ marginTop: 8 }}><Sk w="60%" h={10} delay={i * 40 + 35}/></div>
              </Card>
            ))
          : <KpiCards resumen={resumen} fichas={fichas} centros={centros}/>}
      </div>

      <div className="dash-lower">
        <div className="dash-lower__main">
          {loading ? <Card style={{ padding: 40 }}><Sk w="40%" h={16}/></Card> : <FichasCierranPronto fichas={fichas} onNav={onNav}/>}
        </div>
        <aside className="dash-lower__side">
          <QuickActions onNav={onNav}/>
        </aside>
      </div>
    </div>
  )
}
