import { useState, useEffect } from 'react'
import { Ic, Card, Ava, Bdg, Prog } from '../../components/ui'
import api from '../../lib/api'
import { Pill, Donut, SM, fd } from './parts'
import type { StatusTone } from './parts'
import { descargarGuiaSesion } from './guia'

function Sk({ w, h, r = 5 }: { w: string | number; h: number; r?: number }) {
  return <div className="skeleton" style={{ width: w, height: h, borderRadius: r }}/>
}

function fmtDoc(d: string): string {
  return /^\d+$/.test(d) ? Number(d).toLocaleString('es-CO') : d
}

// ─── Monitoreo completo de un instructor (read-only) ────────────────────────────
// Lo usan SuperAdmin (UsuariosAdmin) y Coordinador (CoordInstructores, CoordinacionDetalle).

interface MonRA { id: number; numero: string; descripcion: string; avance: number; status: StatusTone; completado: boolean }
interface MonComp {
  asignacion_id: number; ficha_id: number; numero_ficha: string; programa_codigo: string
  competencia_id: number; codigo_norma: string; nombre: string; tipo: string
  horas_maximas: number; horas_asignadas: number; horas_ejecutadas: number
  avance: number; status: StatusTone; ra_completados: number; ra_total: number
  resultados_aprendizaje: MonRA[]
}
interface MonFicha {
  id: number; numero_ficha: string; estado: string; programa_nombre: string; programa_codigo: string
  jornada: string | null; avance: number; status: StatusTone; dias_restantes: number
  competencias_asignadas: number; competencias_completas: number
}
interface MonSesion {
  id: number; fecha: string; horas_ejecutadas: number; tipo_sesion: string; estado_sesion: string
  numero_ficha: string; competencia_nombre: string; codigo_norma: string
  ras: number; conocimientos: number; criterios: number
}
interface MonitorData {
  instructor: {
    id: string; nombre_completo: string; email: string; numero_documento: string
    activo: boolean; ultimo_acceso: string | null; centro_nombre: string | null; coordinacion_nombre: string | null
  }
  resumen: {
    sesiones_semana: number; horas_semana: number; avance_promedio: number
    ras_cerrados: number; ras_total: number; por_validar: number; competencias_asignadas: number
  }
  fichas: MonFicha[]
  competencias: MonComp[]
  sesiones: MonSesion[]
}

type ProgState =
  | { status: 'loading' }
  | { status: 'ok'; data: MonitorData }
  | { status: 'error' }

function KpiBox({ label, value, sub, icon }: { label: string; value: string; sub: string; icon: any }) {
  return (
    <Card style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#52525b', fontWeight: 600 }}>{label}</div>
        <Ic n={icon} s={14} style={{ color: '#a1a1aa' }}/>
      </div>
      <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 24, fontWeight: 600, color: '#0a0a0b', marginTop: 10 }}>{value}</div>
      <div style={{ fontSize: 11.5, color: '#52525b', marginTop: 4 }}>{sub}</div>
    </Card>
  )
}

// Acordeón de competencia: avance + RAs (read-only).
function CompCard({ comp }: { comp: MonComp }) {
  "use no memo"
  const [open, setOpen] = useState(false)
  return (
    <Card style={{ overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
        background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
      }}>
        <Donut value={comp.avance} size={38} stroke={5} color={SM[comp.status].dot}>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, fontWeight: 600 }}>{comp.avance}</span>
        </Donut>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2 }}>
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5, color: '#71717a' }}>{comp.codigo_norma}</span>
            <Pill status={comp.status} size="sm"/>
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: '#18181b', lineHeight: 1.35 }}>{comp.nombre}</div>
          <div style={{ fontSize: 11, color: '#71717a', marginTop: 4, fontFamily: '"JetBrains Mono", monospace' }}>
            {comp.ra_completados}/{comp.ra_total} RA · {comp.horas_ejecutadas.toFixed(0)}/{comp.horas_maximas} h
          </div>
        </div>
        <Ic n={open ? 'chevronDown' : 'chevronRight'} s={15} style={{ color: '#a1a1aa', flexShrink: 0 }}/>
      </button>
      {open && (
        <div style={{ borderTop: '1px solid #f1f1f3' }}>
          {comp.resultados_aprendizaje.length === 0 ? (
            <div style={{ padding: '12px 14px', fontSize: 12, color: '#71717a' }}>Sin resultados de aprendizaje cargados.</div>
          ) : comp.resultados_aprendizaje.map((ra, i) => (
            <div key={ra.id} style={{ padding: '11px 14px', display: 'flex', gap: 12, borderBottom: i < comp.resultados_aprendizaje.length - 1 ? '1px solid #f7f7f8' : 'none' }}>
              <div style={{ width: 26, height: 26, borderRadius: 6, background: '#f7f7f8', border: '1px solid #e4e4e7', display: 'grid', placeItems: 'center', fontSize: 10.5, flexShrink: 0, fontFamily: '"JetBrains Mono", monospace' }}>RA{i + 1}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 10, marginBottom: 6 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: '#71717a', fontFamily: '"JetBrains Mono", monospace' }}>{ra.numero}</div>
                    <div style={{ fontSize: 12, color: '#18181b', lineHeight: 1.4, marginTop: 2 }}>{ra.descripcion}</div>
                  </div>
                  <Pill status={ra.status} size="sm"/>
                </div>
                <Prog value={ra.avance} status={ra.status} showLabel/>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

export function InstructorDetalle({ id, nombre, email, documento, activo, onBack }: {
  id: string; nombre: string; email: string; documento: string; activo: boolean; onBack: () => void
}) {
  "use no memo"
  const [state, setState] = useState<ProgState>({ status: 'loading' })

  useEffect(() => {
    setState({ status: 'loading' })
    api.get<MonitorData>(`/dashboard/instructor/monitor/${id}`)
      .then(r => setState({ status: 'ok', data: r.data }))
      .catch(() => setState({ status: 'error' }))
  }, [id])

  const back = (
    <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#52525b', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 16 }}>
      <Ic n="arrowLeft" s={14}/> Usuarios
    </button>
  )

  const header = (extra?: React.ReactNode) => (
    <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 22, flexWrap: 'wrap' }}>
      <Ava name={nombre} size={52}/>
      <div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <h2 style={{ fontSize: 22, fontWeight: 600, color: '#0a0a0b' }}>{nombre}</h2>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, height: 20, padding: '0 7px',
            fontSize: 10.5, fontWeight: 600, borderRadius: 4, textTransform: 'uppercase',
            background: activo ? '#dcfce7' : '#f1f1f3', color: activo ? '#15803d' : '#52525b',
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: activo ? '#16a34a' : '#a1a1aa' }}/>
            {activo ? 'Activo' : 'Inactivo'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, fontSize: 12.5, color: '#52525b', marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <Bdg tone="neutral">Instructor</Bdg>
          <span style={{ fontFamily: '"JetBrains Mono", monospace' }}>{fmtDoc(documento)}</span>
          <span style={{ color: '#a1a1aa' }}>·</span>
          <span>{email}</span>
          {extra}
        </div>
      </div>
    </div>
  )

  if (state.status === 'loading') return <div>{back}{header()}<Card style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><Sk w={220} h={16}/></Card></div>
  if (state.status === 'error') return (
    <div>{back}{header()}
      <Card style={{ padding: 24 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Ic n="alert" s={15} style={{ color: '#b91c1c' }}/>
          <span style={{ fontSize: 13.5, color: '#b91c1c' }}>No se pudo cargar el monitoreo del instructor.</span>
        </div>
      </Card>
    </div>
  )

  const { instructor, resumen, fichas, competencias, sesiones } = state.data
  const ubic = [instructor.centro_nombre, instructor.coordinacion_nombre].filter(Boolean).join(' · ')

  return (
    <div style={{ maxWidth: 1200 }}>
      {back}
      {header(ubic ? <><span style={{ color: '#a1a1aa' }}>·</span><span>{ubic}</span></> : undefined)}

      {/* KPIs de monitoreo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        <Card style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Donut value={resumen.avance_promedio} size={48} stroke={5} color="#4f46e5">
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, fontWeight: 600 }}>{resumen.avance_promedio}%</span>
          </Donut>
          <div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#52525b' }}>Avance promedio</div>
            <div style={{ fontSize: 11.5, color: '#3f3f46', marginTop: 2, fontFamily: '"JetBrains Mono", monospace' }}>
              {fichas.length} ficha{fichas.length === 1 ? '' : 's'} · {resumen.competencias_asignadas} comp.
            </div>
          </div>
        </Card>
        <KpiBox label="Sesiones (semana)" value={String(resumen.sesiones_semana)} sub={`${resumen.horas_semana.toFixed(0)} h registradas`} icon="calendar"/>
        <KpiBox label="RAs cerrados" value={String(resumen.ras_cerrados)} sub={`de ${resumen.ras_total}`} icon="target"/>
        <KpiBox label="Por validar" value={String(resumen.por_validar)} sub="sesiones registradas" icon="clock"/>
      </div>

      {/* Contenido: fichas+competencias | sesiones */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, alignItems: 'start' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0a0a0b', marginBottom: 14 }}>
            Fichas y competencias asignadas
          </div>
          {competencias.length === 0 ? (
            <Card>
              <div style={{ padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <Ic n="briefcase" s={26} style={{ color: '#a1a1aa' }}/>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0a0a0b' }}>Sin asignaciones</div>
                <div style={{ fontSize: 12.5, color: '#71717a' }}>Este instructor aún no tiene competencias asignadas en ninguna ficha.</div>
              </div>
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {fichas.map(f => {
                const comps = competencias.filter(c => c.ficha_id === f.id)
                if (comps.length === 0) return null
                return (
                  <div key={f.id}>
                    {/* Banner de ficha */}
                    <Card style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, background: '#fafafa' }}>
                      <Donut value={f.avance} size={42} stroke={5} color={SM[f.status].dot}>
                        <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, fontWeight: 600 }}>{f.avance}%</span>
                      </Donut>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5, color: '#71717a' }}>{f.programa_codigo}</span>
                          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 13, fontWeight: 600, color: '#0a0a0b' }}># {f.numero_ficha}</span>
                          <Pill status={f.status} size="sm"/>
                        </div>
                        <div style={{ fontSize: 12, color: '#3f3f46', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.programa_nombre}</div>
                      </div>
                      <div style={{ textAlign: 'right', fontSize: 11, color: '#71717a', fontFamily: '"JetBrains Mono", monospace' }}>
                        <div>{f.competencias_completas}/{f.competencias_asignadas} comp.</div>
                        {f.estado === 'EN_EJECUCION' && <div style={{ color: f.dias_restantes < 60 ? '#dc2626' : '#71717a' }}>{f.dias_restantes}d</div>}
                      </div>
                    </Card>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingLeft: 8 }}>
                      {comps.map(c => <CompCard key={c.asignacion_id} comp={c}/>)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Sesiones recientes */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0a0a0b', marginBottom: 14 }}>Sesiones recientes</div>
          {sesiones.length === 0 ? (
            <Card style={{ padding: 16 }}><div style={{ fontSize: 12, color: '#71717a' }}>Este instructor no ha registrado sesiones.</div></Card>
          ) : (
            <Card>
              {sesiones.map((s, i) => (
                <div key={s.id} style={{ padding: '10px 14px', borderBottom: i < sesiones.length - 1 ? '1px solid #f1f1f3' : 'none' }}>
                  <div style={{ display: 'flex', gap: 8, fontSize: 11, color: '#52525b', alignItems: 'center' }}>
                    <span style={{ fontFamily: '"JetBrains Mono", monospace' }}>{fd(s.fecha)}</span>
                    <span>·</span>
                    <span style={{ fontFamily: '"JetBrains Mono", monospace' }}>{s.horas_ejecutadas.toFixed(1)} h</span>
                    <span style={{ marginLeft: 'auto' }}>
                      <Bdg tone={s.estado_sesion === 'VALIDADA' ? 'accent' : 'neutral'}>{s.estado_sesion}</Bdg>
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#18181b', marginTop: 4, lineHeight: 1.3 }}>
                    <span style={{ fontFamily: '"JetBrains Mono", monospace', color: '#71717a', fontSize: 10.5 }}># {s.numero_ficha}</span> · {s.competencia_nombre}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#52525b', marginTop: 3, fontFamily: '"JetBrains Mono", monospace' }}>
                    {s.ras} RA · {s.conocimientos} con · {s.criterios} crit.
                  </div>
                  <button onClick={() => descargarGuiaSesion(s.id)}
                    style={{ marginTop: 6, fontSize: 11, color: '#4f46e5', background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit' }}>
                    <Ic n="download" s={11}/> Guía de aprendizaje
                  </button>
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
