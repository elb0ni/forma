import { useState, useEffect, useMemo } from 'react'
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

interface CentroMin { id: number; nombre: string; codigo: string; coordinaciones_academicas: number }
interface CoordMin  { id: number; nombre: string; centro_formacion_id: number | null }

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

// ─── Estado/etapa: mismos colores que ya usan EstadoPill/EtapaPill en
// FichasAdmin.tsx, para que el lenguaje visual sea el mismo en toda la app ──

type EstadoFilt = '' | 'EN_EJECUCION' | 'FINALIZADA' | 'SUSPENDIDA'

const ESTADO_CHIPS: { key: EstadoFilt; label: string }[] = [
  { key: '',             label: 'Todas'        },
  { key: 'EN_EJECUCION', label: 'En ejecución' },
  { key: 'FINALIZADA',   label: 'Finalizadas'  },
  { key: 'SUSPENDIDA',   label: 'Suspendidas'  },
]

// Paleta validada con scripts/validate_palette.js (skill dataviz): el verde
// oscuro que se usaba antes para "Finalizada" fallaba separación CVD contra
// el rojo de "Suspendida" (protanopia) y se leía gris (chroma floor) --
// #2563eb pasa las 5 verificaciones. El gris de "Lectiva" es intencional
// (categoría recesiva frente a "Práctica"), pero se sube a #71717a para
// cruzar el piso de contraste 3:1; su chroma floor sigue en FAIL a
// propósito (mitigado con el label directo en la leyenda).
const ESTADO_COLOR: Record<string, string> = { EN_EJECUCION: '#16a34a', FINALIZADA: '#2563eb', SUSPENDIDA: '#dc2626' }
const ESTADO_LABEL: Record<string, string> = { EN_EJECUCION: 'En ejecución', FINALIZADA: 'Finalizada', SUSPENDIDA: 'Suspendida' }
const PRACTICA_COLOR = '#4f46e5'
const LECTIVA_COLOR  = '#71717a'

// ─── Barra apilada genérica (un total, N segmentos con color fijo por categoría) ─

interface Segmento { key: string; label: string; value: number; color: string }

function SingleStackedBar({ segments, height = 26 }: { segments: Segmento[]; height?: number }) {
  const total = segments.reduce((a, s) => a + s.value, 0)
  const visibles = segments.filter(s => s.value > 0)
  return (
    <div>
      <div className="stacked-track" style={{ height }}>
        {total === 0
          ? <div style={{ flex: 1, background: '#f1f1f3' }}/>
          : visibles.map((s, i) => (
            <div
              key={s.key}
              title={`${s.label}: ${s.value} (${Math.round((s.value / total) * 100)}%)`}
              style={{
                flex: s.value, background: s.color,
                borderRight: i < visibles.length - 1 ? '2px solid #fff' : 'none',
              }}
            />
          ))}
      </div>
      <div className="legend">
        {segments.map(s => (
          <div key={s.key} className="legend-item">
            <span className="legend-dot" style={{ background: s.color }}/>
            {s.label} <strong style={{ color: '#27272a', fontFamily: '"JetBrains Mono", monospace' }}>{s.value}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── KPI cards ──────────────────────────────────────────────────────────────────

function KpiCards({ resumen, fichasFiltradas, centros }: {
  resumen: ResumenKPI | null; fichasFiltradas: FichaRow[]; centros: CentroMin[]
}) {
  const enPractica = fichasFiltradas.filter(f => f.estado === 'EN_EJECUCION' && f.etapa_actual_teorica === 'PRACTICA')
  const cierranPronto = enPractica.filter(f => {
    const d = diasHasta(f.fecha_fin_productiva)
    return d != null && d <= 30
  }).length
  const activasCount = fichasFiltradas.filter(f => f.estado === 'EN_EJECUCION').length

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
          <span className="kpi2-value-sub"> / {activasCount} en ejecución</span>
        </div>
        <div className="kpi2-sub" style={{ color: cierranPronto > 0 ? '#c2410c' : undefined }}>
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

function FichasCierranPronto({ fichas, onOpenFicha }: { fichas: FichaRow[]; onOpenFicha?: (id: number) => void }) {
  const cierran = fichas
    .filter(f => f.estado === 'EN_EJECUCION' && f.etapa_actual_teorica === 'PRACTICA')
    .map(f => ({ f, dias: diasHasta(f.fecha_fin_productiva) }))
    .filter((x): x is { f: FichaRow; dias: number } => x.dias != null && x.dias <= 30)
    .sort((a, b) => a.dias - b.dias)
    .slice(0, 8)

  return (
    <div>
      <div className="section-title">Fichas que cierran pronto</div>
      {cierran.length === 0 ? (
        <EmptyState icon="checkCircle" title="Sin cierres próximos" sub="Ninguna ficha en etapa práctica del filtro actual cierra en los próximos 30 días."/>
      ) : (
        <Card style={{ overflow: 'hidden' }}>
          {cierran.map(({ f, dias }, i) => (
            <div
              key={f.id}
              className={onOpenFicha ? 'nx-row' : undefined}
              onClick={() => onOpenFicha?.(f.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
                borderBottom: i < cierran.length - 1 ? '1px solid #f1f1f3' : 'none',
                cursor: onOpenFicha ? 'pointer' : 'default',
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

// ─── Tab: Resumen ─────────────────────────────────────────────────────────────

function ResumenTab({ todas, filtradas, onOpenFicha }: {
  todas: FichaRow[]; filtradas: FichaRow[]; onOpenFicha?: (id: number) => void
}) {
  // El desglose por estado usa SIEMPRE el universo completo (no el filtrado
  // por el chip) -- es lo que le da contexto visual a los chips de arriba.
  const porEstado: Segmento[] = (['EN_EJECUCION', 'FINALIZADA', 'SUSPENDIDA'] as const).map(k => ({
    key: k, label: ESTADO_LABEL[k], value: todas.filter(f => f.estado === k).length, color: ESTADO_COLOR[k],
  }))

  // La etapa (práctica/lectiva) solo tiene sentido sobre fichas activas, y sí
  // respeta el filtro -- responde "de lo que estoy viendo, cuánto ya pasó a práctica".
  const activasFiltradas = filtradas.filter(f => f.estado === 'EN_EJECUCION')
  const porEtapa: Segmento[] = [
    { key: 'PRACTICA', label: 'Práctica', value: activasFiltradas.filter(f => f.etapa_actual_teorica === 'PRACTICA').length, color: PRACTICA_COLOR },
    { key: 'LECTIVA',  label: 'Lectiva',  value: activasFiltradas.filter(f => f.etapa_actual_teorica !== 'PRACTICA').length, color: LECTIVA_COLOR },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Card style={{ padding: 20 }}>
        <div className="section-title">Fichas por estado · toda la regional</div>
        <SingleStackedBar segments={porEstado}/>

        <div style={{ height: 1, background: '#f1f1f3', margin: '22px 0' }}/>

        <div className="section-title">Etapa de las fichas en ejecución{filtradas.length !== todas.length ? ' · filtro actual' : ''}</div>
        {activasFiltradas.length === 0
          ? <div style={{ fontSize: 12.5, color: '#a1a1aa' }}>Sin fichas en ejecución en el filtro actual.</div>
          : <SingleStackedBar segments={porEtapa}/>}
      </Card>

      <FichasCierranPronto fichas={filtradas} onOpenFicha={onOpenFicha}/>
    </div>
  )
}

// ─── Tabs: ranking por coordinación / por centro ───────────────────────────────
// Lo más accionable del panel: quién necesita atención primero. Se ordena por
// "cierran pronto" desc -- ninguna llamada nueva, todo agregado client-side
// sobre /fichas (ya cargado) + /coordinaciones o /dashboard/super-admin/centros.

interface FilaRanking { id: number | string; nombre: string; total: number; practica: number; cierranPronto: number; finalizadas: number }

function agrupar(fichas: FichaRow[], keyFn: (f: FichaRow) => number | string | null, nombres: Map<number | string, string>, fallback: string): FilaRanking[] {
  const map = new Map<number | string, FilaRanking>()
  for (const f of fichas) {
    const key = keyFn(f) ?? '__sin_asignar__'
    if (!map.has(key)) {
      map.set(key, { id: key, nombre: key === '__sin_asignar__' ? fallback : (nombres.get(key) ?? `#${key}`), total: 0, practica: 0, cierranPronto: 0, finalizadas: 0 })
    }
    const row = map.get(key)!
    row.total++
    if (f.estado === 'FINALIZADA') row.finalizadas++
    if (f.estado === 'EN_EJECUCION' && f.etapa_actual_teorica === 'PRACTICA') {
      row.practica++
      const d = diasHasta(f.fecha_fin_productiva)
      if (d != null && d <= 30) row.cierranPronto++
    }
  }
  return [...map.values()].sort((a, b) => b.cierranPronto - a.cierranPronto || b.practica - a.practica)
}

function RankingTable({ filas, columnaNombre }: { filas: FilaRanking[]; columnaNombre: string }) {
  if (filas.length === 0) return <EmptyState icon="folder" title="Sin datos" sub="No hay fichas en el filtro actual."/>
  return (
    <Card style={{ overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
      <table className="data-table">
        <thead>
          <tr className="data-table__head-row">
            <th className="data-table__th">{columnaNombre}</th>
            <th className="data-table__th" style={{ textAlign: 'right' }}>Total</th>
            <th className="data-table__th" style={{ textAlign: 'right' }}>En práctica</th>
            <th className="data-table__th" style={{ textAlign: 'right' }}>Cierran ≤30d</th>
            <th className="data-table__th" style={{ textAlign: 'right' }}>Finalizadas</th>
            <th className="data-table__th" style={{ minWidth: 140 }}>Práctica / activas</th>
          </tr>
        </thead>
        <tbody>
          {filas.map(r => (
            <tr key={r.id} style={{ borderBottom: '1px solid #f1f1f3' }}>
              <td className="data-table__td--name">{r.nombre}</td>
              <td className="data-table__td--fichas" style={{ textAlign: 'right' }}>{r.total}</td>
              <td className="data-table__td--fichas" style={{ textAlign: 'right', color: PRACTICA_COLOR }}>{r.practica}</td>
              <td className="data-table__td--fichas" style={{ textAlign: 'right', color: r.cierranPronto > 0 ? '#dc2626' : '#a1a1aa' }}>{r.cierranPronto}</td>
              <td className="data-table__td--fichas" style={{ textAlign: 'right', color: ESTADO_COLOR.FINALIZADA }}>{r.finalizadas}</td>
              <td className="data-table__td" style={{ minWidth: 140 }}>
                <Prog value={r.total > 0 ? Math.round((r.practica / r.total) * 100) : 0} showLabel/>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </Card>
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
// Home ejecutivo del Super Admin, centrado en etapa productiva: chips de
// estado (filtran todo el panel), KPIs regionales, y 3 vistas (Resumen / Por
// coordinación / Por centro) para decidir dónde hace falta intervenir.
// Todo agregado client-side sobre /fichas -- ninguna llamada nueva al backend.
type TabId = 'resumen' | 'coordinacion' | 'centro'
const TABS: { id: TabId; label: string; icon: IcName }[] = [
  { id: 'resumen',      label: 'Resumen',            icon: 'trend'  },
  { id: 'coordinacion', label: 'Por coordinación',   icon: 'users'  },
  { id: 'centro',       label: 'Por centro',         icon: 'shield' },
]

export function DashboardHome({ onNav, onOpenFicha }: { onNav?: (id: string) => void; onOpenFicha?: (id: number) => void }) {
  "use no memo"
  const [resumen, setResumen] = useState<ResumenKPI | null>(null)
  const [fichas,  setFichas]  = useState<FichaRow[] | null>(null)
  const [centros, setCentros] = useState<CentroMin[] | null>(null)
  const [coords,  setCoords]  = useState<CoordMin[] | null>(null)
  const [estadoFilt, setEstadoFilt] = useState<EstadoFilt>('')
  const [tab, setTab] = useState<TabId>('resumen')

  useEffect(() => {
    api.get<ResumenKPI>('/dashboard/super-admin/resumen').then(r => setResumen(r.data)).catch(() => {})
    api.get<FichaRow[]>('/fichas').then(r => setFichas(r.data)).catch(() => setFichas([]))
    api.get<CentroMin[]>('/dashboard/super-admin/centros').then(r => setCentros(r.data)).catch(() => setCentros([]))
    api.get<CoordMin[]>('/coordinaciones').then(r => setCoords(r.data)).catch(() => setCoords([]))
  }, [])

  const loading = fichas === null || centros === null || coords === null

  const fichasFiltradas = useMemo(
    () => (fichas ?? []).filter(f => !estadoFilt || f.estado === estadoFilt),
    [fichas, estadoFilt],
  )

  const coordNombres = useMemo(() => new Map((coords ?? []).map(c => [c.id, c.nombre])), [coords])
  const centroNombres = useMemo(() => new Map((centros ?? []).map(c => [c.id, `${c.codigo} · ${c.nombre}`])), [centros])

  const porCoordinacion = useMemo(
    () => agrupar(fichasFiltradas, f => f.coordinacion_academica_id, coordNombres, 'Sin coordinación'),
    [fichasFiltradas, coordNombres],
  )
  const porCentro = useMemo(
    () => agrupar(fichasFiltradas, f => f.centro_formacion_id, centroNombres, 'Sin centro'),
    [fichasFiltradas, centroNombres],
  )

  const counts: Record<EstadoFilt, number> = {
    '':            fichas?.length ?? 0,
    EN_EJECUCION:  fichas?.filter(f => f.estado === 'EN_EJECUCION').length ?? 0,
    FINALIZADA:    fichas?.filter(f => f.estado === 'FINALIZADA').length ?? 0,
    SUSPENDIDA:    fichas?.filter(f => f.estado === 'SUSPENDIDA').length ?? 0,
  }

  return (
    <div>
      <div className="dash-header">
        <div>
          <div className="dash-header__eyebrow">Dirección General</div>
          <h2 className="dash-header__title">Operación de la plataforma</h2>
        </div>
      </div>

      {/* Chips de estado -- filtran KPIs, gráficos y rankings de todo el panel */}
      {!loading && (
        <div className="prog-chips" style={{ marginBottom: 20 }}>
          {ESTADO_CHIPS.map(c => (
            <button
              key={c.key || 'todas'}
              onClick={() => setEstadoFilt(c.key)}
              className={`prog-chip${estadoFilt === c.key ? ' prog-chip--active' : ''}`}
            >
              {c.label}
              <span className="prog-chip__count">{counts[c.key]}</span>
            </button>
          ))}
        </div>
      )}

      <div className="kpi-grid">
        {loading
          ? [0, 1, 2].map(i => (
              <Card key={i} style={{ padding: 20 }}>
                <Sk w="55%" h={9} delay={i * 40}/>
                <div style={{ marginTop: 14 }}><Sk w="42%" h={26} delay={i * 40 + 20}/></div>
                <div style={{ marginTop: 8 }}><Sk w="60%" h={10} delay={i * 40 + 35}/></div>
              </Card>
            ))
          : <KpiCards resumen={resumen} fichasFiltradas={fichasFiltradas} centros={centros}/>}
      </div>

      <div className="dash-lower">
        <div className="dash-lower__main">
          <div className="tab-bar">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} className={`tab-btn${tab === t.id ? ' tab-btn--active' : ' tab-btn--inactive'}`}>
                <Ic n={t.icon} s={14} style={{ color: tab === t.id ? '#0a0a0b' : '#a1a1aa' }}/>
                {t.label}
              </button>
            ))}
          </div>

          {loading ? (
            <Card style={{ padding: 40 }}><Sk w="40%" h={16}/></Card>
          ) : tab === 'resumen' ? (
            <ResumenTab todas={fichas} filtradas={fichasFiltradas} onOpenFicha={onOpenFicha}/>
          ) : tab === 'coordinacion' ? (
            <RankingTable filas={porCoordinacion} columnaNombre="Coordinación"/>
          ) : (
            <RankingTable filas={porCentro} columnaNombre="Centro"/>
          )}
        </div>
        <aside className="dash-lower__side">
          <QuickActions onNav={onNav}/>
        </aside>
      </div>
    </div>
  )
}
