import { useState, useEffect } from 'react'
import axios from 'axios'
import { Ic, Btn, Bdg, Card, Tag, DigBadge } from '../../components/ui'
import type { ProgramaDetalle, CompetenciaResumen } from '../../types'
import api from '../../lib/api'
import { useAuthStore } from '../../store/auth'
import { CurriculoEditor } from '../superadmin/CurriculoEditor'
import './ProgramasFormacion.css'

// Vista de detalle de un programa: la usan SuperAdmin (ProgramasFormacion) y
// el drill-down de coordinador (CoordinacionDetalle).

// Versión con el formato de FORMA (V102, V001, …)
function fmtVersion(v: string | number): string {
  return `V${String(v).replace(/^v/i, '').padStart(3, '0')}`
}

// Sigla derivada del nombre para el recuadro del programa (p. ej. "ADS")
const SHORT_STOPWORDS = new Set(['de', 'del', 'y', 'e', 'la', 'el', 'en', 'los', 'las', 'para', 'con', 'a'])
function programaShort(nombre: string): string {
  const sigla = nombre
    .split(/\s+/)
    .filter(w => w && !SHORT_STOPWORDS.has(w.toLowerCase()))
    .map(w => w[0])
    .join('')
    .toUpperCase()
  return sigla.slice(0, 4) || nombre.slice(0, 2).toUpperCase()
}

function nivelColor(nivel: string) {
  const n = nivel.toUpperCase()
  if (n.includes('TECNÓLOGO'))      return { bg: '#dbeafe', fg: '#1d4ed8' }
  if (n.includes('TÉCNICO'))        return { bg: '#dcfce7', fg: '#15803d' }
  if (n.includes('ESPECIALIZACIÓN'))return { bg: '#f3e8ff', fg: '#6b21a8' }
  return                                    { bg: '#f1f1f3', fg: '#52525b' }
}

function tipoComp(tipo: string) {
  const t = tipo.toUpperCase()
  if (t.includes('TÉCNICA'))      return { label: 'TÉC',   bg: '#dbeafe', fg: '#1d4ed8' }
  if (t.includes('TRANSVERSAL'))  return { label: 'TRANS', bg: '#f3e8ff', fg: '#6b21a8' }
  return                                  { label: tipo.slice(0, 4).toUpperCase(), bg: '#f1f1f3', fg: '#52525b' }
}

type DrawerState =
  | { status: 'loading' }
  | { status: 'ok';    data: ProgramaDetalle }
  | { status: 'error'; msg: string }

function StatBox({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="stat-box">
      <div className="stat-box__value">{value}</div>
      <div className="stat-box__label">{label}</div>
      {sub && <div className="stat-box__sub">{sub}</div>}
    </div>
  )
}

function CompRow({ comp, expanded, onToggle }: {
  comp: CompetenciaResumen; expanded: boolean; onToggle: () => void
}) {
  const tc = tipoComp(comp.tipo)
  return (
    <div className={`comp-row${expanded ? ' comp-row--expanded' : ''}`}>
      <button onClick={onToggle} className="comp-row__btn">
        <div className={`comp-row__num${expanded ? ' comp-row__num--expanded' : ' comp-row__num--collapsed'}`}>
          {String(comp.orden).padStart(2, '0')}
        </div>

        <div className="comp-row__meta">
          <div className="comp-row__code">{comp.codigo_norma}</div>
          <div className="comp-row__name">{comp.nombre}</div>
        </div>

        <div className="comp-row__badges">
          <span className="comp-row__tipo-badge" style={{ background: tc.bg, color: tc.fg }}>
            {tc.label}
          </span>
          <span className="comp-row__horas">{comp.horas_maximas}h</span>
        </div>

        <Ic
          n={expanded ? 'chevronDown' : 'chevronRight'}
          s={14}
          style={{ color: '#a1a1aa', flexShrink: 0 }}
        />
      </button>

      {expanded && (
        <div className="comp-row__detail">
          {[
            ['RA', comp.total_ra,            '#4f46e5', '#eef2ff'],
            ['CP+CS', comp.total_conocimientos, '#0891b2', '#e0f2fe'],
            ['CE', comp.total_criterios,     '#7c3aed', '#f3e8ff'],
          ].map(([lbl, val, fg, bg]) => (
            <div key={String(lbl)} className="comp-row__detail-item" style={{ background: bg as string, color: fg as string }}>
              <span className="comp-row__detail-value">{val}</span>
              <span className="comp-row__detail-label">{lbl}</span>
            </div>
          ))}
          <div className="comp-row__detail-horas">{comp.horas_maximas} horas máximas</div>
        </div>
      )}

      {expanded && <CompCurriculo comp={comp}/>}
    </div>
  )
}

// Muestra cómo se relacionan conocimientos y criterios con cada RA de la competencia.
function CompCurriculo({ comp }: { comp: CompetenciaResumen }) {
  const ras = comp.resultados_aprendizaje ?? []
  const con = comp.conocimientos ?? []
  const crit = comp.criterios ?? []

  // Conocimientos/criterios sin RA asignado (ra_id null) van a un bloque aparte.
  const conSinRa = con.filter(k => k.ra_id == null)
  const critSinRa = crit.filter(c => c.ra_id == null)

  const Item = ({ tipo, text }: { tipo: 'CP' | 'CS' | 'CE'; text: string }) => {
    const palette = tipo === 'CE'
      ? { bg: '#f3e8ff', fg: '#7c3aed' }
      : { bg: '#e0f2fe', fg: '#0891b2' }
    return (
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '5px 0' }}>
        <span style={{ flexShrink: 0, fontSize: 9.5, fontWeight: 700, fontFamily: '"JetBrains Mono", monospace', background: palette.bg, color: palette.fg, padding: '1px 5px', borderRadius: 4, marginTop: 1 }}>{tipo}</span>
        <span style={{ fontSize: 12, color: '#3f3f46', lineHeight: 1.4 }}>{text}</span>
      </div>
    )
  }

  const Bucket = ({ kList, cList }: { kList: typeof con; cList: typeof crit }) => (
    <div style={{ marginTop: 8 }}>
      {kList.length > 0 && (
        <div>
          <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#0891b2', fontWeight: 700, marginBottom: 2 }}>Conocimientos · {kList.length}</div>
          {kList.map(k => <Item key={k.id} tipo={k.tipo === 'PROCESO' ? 'CP' : 'CS'} text={k.descripcion}/>)}
        </div>
      )}
      {cList.length > 0 && (
        <div style={{ marginTop: kList.length ? 8 : 0 }}>
          <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7c3aed', fontWeight: 700, marginBottom: 2 }}>Criterios de evaluación · {cList.length}</div>
          {cList.map(c => <Item key={c.id} tipo="CE" text={c.descripcion}/>)}
        </div>
      )}
      {kList.length === 0 && cList.length === 0 && (
        <div style={{ fontSize: 11.5, color: '#a1a1aa', padding: '4px 0' }}>Sin conocimientos ni criterios ligados.</div>
      )}
    </div>
  )

  if (ras.length === 0 && con.length === 0 && crit.length === 0) {
    return (
      <div style={{ padding: '0 16px 16px' }}>
        <div style={{ fontSize: 12, color: '#a1a1aa' }}>Esta competencia aún no tiene diseño curricular detallado.</div>
      </div>
    )
  }

  return (
    <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a1a1aa' }}>
        Relación por resultado de aprendizaje
      </div>
      {ras.map((ra, i) => (
        <div key={ra.id} style={{ border: '1px solid #ececef', borderRadius: 10, padding: 12, background: '#fff' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ flexShrink: 0, width: 30, height: 22, borderRadius: 6, background: '#eef2ff', color: '#4f46e5', display: 'grid', placeItems: 'center', fontSize: 10.5, fontWeight: 700, fontFamily: '"JetBrains Mono", monospace' }}>RA{i + 1}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10, color: '#a1a1aa', fontFamily: '"JetBrains Mono", monospace' }}>{ra.numero}</div>
              <div style={{ fontSize: 12.5, color: '#18181b', lineHeight: 1.4, marginTop: 1 }}>{ra.descripcion}</div>
            </div>
          </div>
          <div style={{ paddingLeft: 40 }}>
            <Bucket kList={con.filter(k => k.ra_id === ra.id)} cList={crit.filter(c => c.ra_id === ra.id)}/>
          </div>
        </div>
      ))}

      {(conSinRa.length > 0 || critSinRa.length > 0) && (
        <div style={{ border: '1px dashed #e4e4e7', borderRadius: 10, padding: 12, background: '#fafafa' }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#71717a', marginBottom: 2 }}>Sin RA asignado</div>
          <Bucket kList={conSinRa} cList={critSinRa}/>
        </div>
      )}
    </div>
  )
}

function DrawerSkeleton() {
  return (
    <div className="drawer-skeleton">
      <div className="drawer-skeleton__stats">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="drawer-skeleton__stat">
            <div className="skeleton" style={{ height: 26, width: 48, margin: '0 auto 8px', animationDelay: `${i * 60}ms` }}/>
            <div className="skeleton" style={{ height: 9, width: '65%', margin: '0 auto', animationDelay: `${i * 60 + 30}ms` }}/>
          </div>
        ))}
      </div>
      <div className="drawer-skeleton__comps">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="drawer-skeleton__comp-row" style={{ borderBottom: i < 3 ? '1px solid #f1f1f3' : 'none' }}>
            <div className="skeleton" style={{ width: 26, height: 26, borderRadius: 6, flexShrink: 0, animationDelay: `${i * 70}ms` }}/>
            <div className="drawer-skeleton__comp-info">
              <div className="skeleton" style={{ height: 9, width: '35%', marginBottom: 7, animationDelay: `${i * 70 + 20}ms` }}/>
              <div className="skeleton" style={{ height: 13, width: `${60 + (i % 3) * 12}%`, animationDelay: `${i * 70 + 35}ms` }}/>
            </div>
            <div className="skeleton" style={{ width: 50, height: 20, borderRadius: 4, flexShrink: 0, animationDelay: `${i * 70 + 50}ms` }}/>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ProgramaDetalleView({ id, onBack, onDigitalizar }: { id: number; onBack: () => void; onDigitalizar?: () => void }) {
  const [state,   setState]   = useState<DrawerState>({ status: 'loading' })
  const [search,  setSearch]  = useState('')
  const [expanded, setExpanded] = useState<number | null>(null)
  const [editing,  setEditing]  = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const canEdit = useAuthStore(s => s.user)?.rol === 'SUPER_ADMIN'

  useEffect(() => {
    setState({ status: 'loading' })
    api.get<ProgramaDetalle>(`/programas/${id}`)
      .then(({ data }) => setState({ status: 'ok', data }))
      .catch(err => {
        const msg = axios.isAxiosError(err)
          ? (err.response?.data?.message ?? err.message)
          : 'Error al cargar el programa'
        setState({ status: 'error', msg: String(msg) })
      })
  }, [id, reloadKey])

  // El editor de currículo reemplaza la vista de detalle mientras está abierto.
  if (editing) {
    return <CurriculoEditor programaId={id} onBack={() => { setEditing(false); setReloadKey(k => k + 1) }}/>
  }

  const data = state.status === 'ok' ? state.data : null

  // Un programa está habilitado solo cuando su diseño curricular fue digitalizado.
  // Usamos la bandera del backend y, por seguridad, caemos a "tiene competencias".
  const digitalizado = !!data && (Number(data.tiene_disenio_curricular ?? 0) === 1 || data.competencias.length > 0)

  const totalRAs   = data?.competencias.reduce((a, c) => a + c.total_ra, 0) ?? 0
  const totalKnow  = data?.competencias.reduce((a, c) => a + c.total_conocimientos, 0) ?? 0
  const totalCrit  = data?.competencias.reduce((a, c) => a + c.total_criterios, 0) ?? 0

  const filtered = (data?.competencias ?? []).filter(c =>
    search === '' ||
    c.nombre.toLowerCase().includes(search.toLowerCase()) ||
    c.codigo_norma.includes(search)
  )

  const nc = data ? nivelColor(data.nivel_formacion) : { bg: '#f1f1f3', fg: '#52525b' }

  return (
    <div>
      <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#52525b', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 16 }}>
        <Ic n="arrowLeft" s={14}/> Programas
      </button>

      {state.status === 'loading' && (
        <Card style={{ overflow: 'hidden', padding: 12 }}><DrawerSkeleton/></Card>
      )}

      {state.status === 'error' && (
        <Card style={{ padding: 24 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Ic n="alert" s={15} style={{ color: '#b91c1c' }}/>
            <span style={{ fontSize: 13.5, color: '#b91c1c' }}>{state.msg}</span>
          </div>
        </Card>
      )}

      {data && (
        <>
          {/* Encabezado */}
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 22, justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{ width: 52, height: 52, borderRadius: 10, background: '#0a0a0b', color: '#fff', display: 'grid', placeItems: 'center', fontFamily: '"JetBrains Mono", monospace', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                {programaShort(data.nombre)}
              </div>
              <div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: 22, fontWeight: 600, color: '#0a0a0b' }}>{data.nombre}</h2>
                  <Bdg tone={data.estado === 'VIGENTE' ? 'ok' : 'neutral'}>{data.estado}</Bdg>
                  <DigBadge dig={digitalizado}/>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
                  <Tag>{data.codigo}</Tag>
                  <span style={{ fontSize: 12.5, color: '#52525b', fontFamily: '"JetBrains Mono", monospace' }}>{fmtVersion(data.version)}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: nc.bg, color: nc.fg }}>{data.nivel_formacion}</span>
                </div>
              </div>
            </div>
            {canEdit && digitalizado && <Btn variant="accent" icon="edit" onClick={() => setEditing(true)}>Editar currículo</Btn>}
          </div>

          {/* Stats: horas y centros vienen del import (siempre válidas); las de currículo solo si está digitalizado */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${digitalizado ? 5 : 3},1fr)`, gap: 10, marginBottom: digitalizado ? 10 : 22 }}>
            <StatBox label="Horas lectivas"    value={data.horas_lectivas.toLocaleString('es-CO')}/>
            <StatBox label="Horas productivas" value={data.horas_productivas.toLocaleString('es-CO')}/>
            <StatBox label="Centros"           value={data.centros.length}/>
            {digitalizado && <StatBox label="Competencias" value={data.competencias.length}/>}
            {digitalizado && <StatBox label="RAs totales"  value={totalRAs}/>}
          </div>

          {/* Stats secundarias (solo con diseño curricular) */}
          {digitalizado && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, marginBottom: 22 }}>
            {[
              ['Conocimientos', totalKnow, '#0891b2', '#e0f2fe'],
              ['Criterios eval.', totalCrit, '#7c3aed', '#f3e8ff'],
            ].map(([lbl, val, fg, bg]) => (
              <div key={String(lbl)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 10, background: bg as string, border: `1px solid ${fg as string}22` }}>
                <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 20, fontWeight: 700, color: fg as string }}>{val}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: fg as string }}>{lbl}</span>
              </div>
            ))}
          </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24, alignItems: 'start' }}>
            {/* Izquierda: centros + título */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {data.centros.length > 0 && (
                <Card style={{ padding: 16 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a1a1aa', marginBottom: 10 }}>
                    Centros de formación ({data.centros.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {data.centros.map(c => (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, fontWeight: 700, background: '#f1f1f3', color: '#52525b', padding: '2px 6px', borderRadius: 4, flexShrink: 0 }}>{c.codigo}</span>
                        <span style={{ fontSize: 12.5, color: '#18181b' }}>{c.nombre}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
              {data.titulo_otorga && (
                <Card style={{ padding: 16 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a1a1aa', marginBottom: 6 }}>Título que otorga</div>
                  <div style={{ fontSize: 13, color: '#18181b', lineHeight: 1.4 }}>{data.titulo_otorga}</div>
                </Card>
              )}
              <div style={{ fontSize: 11, color: '#a1a1aa' }}>
                {`Importado el ${new Date(data.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}`}
              </div>
            </div>

            {/* Derecha: competencias (o aviso si el programa no está digitalizado) */}
            <div>
              {digitalizado ? (<>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0a0a0b' }}>
                  Competencias <span style={{ color: '#a1a1aa', fontFamily: '"JetBrains Mono", monospace', fontWeight: 400 }}>{filtered.length}/{data.competencias.length}</span>
                </div>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Ic n="search" s={14} style={{ position: 'absolute', left: 10, color: '#a1a1aa', pointerEvents: 'none' }}/>
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar por nombre o código…"
                    style={{ width: 240, maxWidth: '100%', height: 34, padding: '0 30px 0 32px', border: '1px solid #e4e4e7', borderRadius: 8, fontSize: 12.5, color: '#18181b', fontFamily: 'Inter, sans-serif', outline: 'none', background: '#fff' }}
                  />
                  {search && (
                    <button onClick={() => setSearch('')} aria-label="Limpiar" style={{ position: 'absolute', right: 8, display: 'grid', placeItems: 'center', width: 18, height: 18, border: 'none', borderRadius: '50%', background: '#f1f1f3', color: '#71717a', cursor: 'pointer' }}>
                      <Ic n="x" s={12}/>
                    </button>
                  )}
                </div>
              </div>
              <Card style={{ overflow: 'hidden' }}>
                {filtered.length === 0
                  ? <div style={{ padding: 32, textAlign: 'center', fontSize: 12.5, color: '#71717a' }}>Sin resultados para "{search}"</div>
                  : filtered.map(c => (
                    <CompRow key={c.id} comp={c} expanded={expanded === c.id} onToggle={() => setExpanded(prev => prev === c.id ? null : c.id)}/>
                  ))
                }
              </Card>
              </>) : (
                <Card style={{ padding: 32, background: '#fffbeb', border: '1px solid #fde68a', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#fef3c7', display: 'grid', placeItems: 'center' }}>
                    <Ic n="alert" s={22} style={{ color: '#d97706' }}/>
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#92400e' }}>Diseño curricular pendiente</div>
                    <div style={{ fontSize: 12.5, color: '#a16207', marginTop: 4, maxWidth: 440 }}>
                      Este programa fue importado pero aún no se digitaliza su diseño curricular,
                      por eso no se muestran competencias, resultados de aprendizaje, conocimientos ni criterios.
                      Las fichas de este programa permanecerán bloqueadas hasta digitalizarlo.
                    </div>
                  </div>
                  {onDigitalizar && (
                    <Btn variant="accent" icon="upload" onClick={onDigitalizar}>Digitalizar programa</Btn>
                  )}
                </Card>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
