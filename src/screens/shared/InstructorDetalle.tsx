import { useState, useEffect } from 'react'
import { Routes, Route, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Ic, Card, Ava, Bdg } from '../../components/ui'
import type { IcName } from '../../components/ui'
import api from '../../lib/api'
import { fd, LoadingBlock, CenterState } from './parts'
import { MODALIDAD_LABEL } from '../productiva/types'
import type { ModalidadEtapaProductiva } from '../productiva/types'
import { Expediente } from '../expediente/Expediente'
import { useAuthStore } from '../../store/auth'
import { AgendaPendientes } from '../instructor/AgendaPendientes'
import { AgendaCalendario } from '../instructor/AgendaCalendario'
import { InstHistorial } from '../instructor/InstHistorial'
import type { FichaInstructor, PendientesInstructor, TabEtapa } from '../instructor/types'
import '../instructor/instructor.css'

// ─── Monitoreo de un instructor (rol admin / coordinación) ─────────────────────
// Consume GET /instructores/:id/detalle (forma_server, módulo instructores).
// Vista simplificada: cabecera (identidad + semáforo de adopción), un resumen
// de pocos KPIs, y el roster de aprendices a su cargo (con el estado de los 3
// momentos del GFPI-F-023). El endpoint devuelve más (carga completa,
// cumplimiento por momento, calidad, actividad, últimos seguimientos); acá solo
// se usa lo esencial.
//
// Lo montan SuperAdmin (Instructores, UsuariosAdmin, CoordinacionDetalle) y
// Coordinador (InstructoresPractica) bajo un splat, con el id en `:instructorId`
// o `:usuarioId`. Solo se llega aquí desde una fila cuyo rol es INSTRUCTOR.
//
// Además del resumen, muestra las mismas vistas que el instructor tiene de sí
// mismo -- Pendientes, Calendario e Historial -- vía /instructores/:id/*. Al
// abrir una etapa, el super admin puede registrar y editar; el coordinador la
// ve en solo lectura (el backend tampoco le deja escribir).

// Se mantiene exportado por compatibilidad con los consumidores que aún tipan
// su estado con esta forma.
export interface InstructorBasico {
  id: string
  nombre_completo: string
  email: string
  activo: boolean | number
  coordinacion_nombre?: string | null
}

interface Cumpl { hechas: number; esperadas: number }

interface DetalleAtrasado { etapa_id: number; aprendiz_nombre: string; numero_ficha: string; motivo: string }

interface DetalleAprendiz {
  etapa_id: number
  aprendiz_id: number
  aprendiz_nombre: string
  numero_documento: string
  numero_ficha: string
  empresa_nombre: string | null
  modalidad: ModalidadEtapaProductiva
  estado: string
  resultado_final: 'APROBADO' | 'NO_APROBADO' | null
  momentos: { planeacion: boolean; seguimiento: boolean; evaluacion: boolean }
  ultimo_seguimiento: string | null
}

interface DetalleReciente {
  id: number
  tipo_momento: string
  tipo_seguimiento: string
  concepto: string
  fecha: string | null
  aprendiz_nombre: string
  numero_ficha: string
  firmado: boolean
  ubicacion_ok: boolean
}

interface InstructorDetalleData {
  instructor: {
    id: string; nombre_completo: string; email: string
    tipo_documento: string; numero_documento: string
    activo: boolean; primer_login: boolean
    centro_nombre: string | null; coordinacion_nombre: string | null
    firma_registrada: boolean
  }
  adopcion: {
    semaforo: 'ACTIVO' | 'TIBIO' | 'INACTIVO' | 'NUNCA_ENTRO'
    ultimo_acceso: string | null; dias_desde_acceso: number | null
    ultimo_registro: string | null; dias_desde_ultimo_registro: number | null
    seguimientos_30d: number; seguimientos_total: number
    asignado_desde: string | null; firma_registrada: boolean
  }
  carga: {
    fichas_practica: number; aprendices_en_fichas: number
    etapas_registradas: number; etapas_en_curso: number
    aprobadas: number; no_aprobadas: number
  }
  cumplimiento: {
    etapas_abiertas: number
    planeacion: Cumpl; seguimiento: Cumpl; evaluacion: Cumpl
    atrasados: DetalleAtrasado[]
  }
  calidad: {
    favorables: number; no_favorables: number; pendientes: number
    no_favorables_sin_plan: number; alertas_ubicacion: number; sin_firmar: number
  }
  aprendices: DetalleAprendiz[]
  actividad: { fecha: string; count: number }[]
  recientes: DetalleReciente[]
}

const SEMAFORO: Record<InstructorDetalleData['adopcion']['semaforo'], { label: string; fg: string; bg: string; dot: string }> = {
  ACTIVO:      { label: 'Activo',        fg: 'var(--fx-ok)', bg: 'var(--fx-ok-suave)', dot: 'var(--fx-ok)' },
  TIBIO:       { label: 'Poco activo',   fg: 'var(--fx-aviso)', bg: 'var(--fx-aviso-suave)', dot: 'var(--fx-aviso)' },
  INACTIVO:    { label: 'Inactivo',      fg: 'var(--fx-atraso)', bg: 'var(--fx-atraso-suave)', dot: 'var(--fx-atraso)' },
  NUNCA_ENTRO: { label: 'Nunca entró',   fg: 'var(--fx-tinta-2)', bg: 'var(--fx-superficie-2)', dot: 'var(--fx-tinta-4)' },
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: 'risk' | 'crit' }) {
  const color = tone === 'crit' ? 'var(--fx-atraso)' : tone === 'risk' ? 'var(--fx-aviso)' : 'var(--fx-tinta)'
  return (
    <div style={{ border: '1px solid var(--fx-linea)', borderRadius: 8, padding: '12px 14px' }}>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--fx-tinta-3)', fontWeight: 600 }}>{label}</div>
      <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 20, fontWeight: 700, color, marginTop: 5 }}>{value}</div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--fx-tinta-3)', fontWeight: 600, margin: '26px 0 12px' }}>{children}</div>
}

function momIcon(ok: boolean): { n: IcName; color: string } {
  return ok ? { n: 'checkCircle', color: 'var(--fx-ok)' } : { n: 'clock', color: 'var(--fx-linea-2)' }
}

type VistaId = 'resumen' | 'pendientes' | 'calendario' | 'historial'
const VISTAS: { id: VistaId; label: string; icon: IcName }[] = [
  { id: 'resumen',    label: 'Resumen',    icon: 'trend' },
  { id: 'pendientes', label: 'Pendientes', icon: 'bell' },
  { id: 'calendario', label: 'Calendario', icon: 'calendar' },
  { id: 'historial',  label: 'Historial',  icon: 'clock' },
]

// Pendientes y Calendario del instructor, vistos por super admin /
// coordinador. Mismos componentes que usa el instructor en su Agenda.
function VistaAgendaInstructor({ instructorId, vista, onVerEtapa, onIrPendientes }: {
  instructorId: string
  vista: 'pendientes' | 'calendario'
  onVerEtapa: (etapaId: number, tab?: TabEtapa | null) => void
  onIrPendientes: () => void
}) {
  "use no memo"
  const navigate = useNavigate()
  const rol = useAuthStore(s => s.user?.rol)
  const [pend, setPend] = useState<PendientesInstructor | null>(null)
  const [fichas, setFichas] = useState<FichaInstructor[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let live = true
    void Promise.allSettled([
      api.get<PendientesInstructor>(`/instructores/${instructorId}/pendientes`).then(r => { if (live) setPend(r.data) }),
      api.get<FichaInstructor[]>(`/instructores/${instructorId}/fichas`).then(r => { if (live) setFichas(r.data) }),
    ]).then(() => { if (live) setCargando(false) })
    return () => { live = false }
  }, [instructorId])

  // La ficha se abre en la sección Fichas del rol que está mirando.
  const verFicha = (id: number) =>
    navigate(`/dashboard/${rol === 'SUPER_ADMIN' || rol === 'SUBDIRECTOR' ? 'superadmin' : 'coordinador'}/fichas/${id}`)

  if (cargando) return <LoadingBlock/>
  if (!pend) return <Card style={{ padding: 24 }}><CenterState icon="alert" title="No se pudieron cargar los pendientes" sub="Verifica la conexión con el servidor."/></Card>
  return vista === 'calendario'
    ? <AgendaCalendario data={pend} onVerEtapa={onVerEtapa} onVerFicha={verFicha} onIrPendientes={onIrPendientes}/>
    : <AgendaPendientes data={pend} fichas={fichas} onVerEtapa={onVerEtapa} onVerFicha={verFicha}/>
}

function InstructorDetalleMain({ instructorId, onBack }: { instructorId: string; onBack: () => void }) {
  "use no memo"
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const vista = (VISTAS.find(v => v.id === params.get('vista'))?.id ?? 'resumen') as VistaId
  const cambiarVista = (v: VistaId) => setParams(v === 'resumen' ? {} : { vista: v }, { replace: true })
  const [data, setData] = useState<InstructorDetalleData | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let live = true
    api.get<InstructorDetalleData>(`/instructores/${instructorId}/detalle`)
      .then(r => { if (live) { setData(r.data); setError(false) } })
      .catch(() => { if (live) setError(true) })
    return () => { live = false }
  }, [instructorId])

  const back = (
    <button onClick={onBack} className="back-btn" style={{
      fontSize: 12.5, color: 'var(--fx-tinta-2)', display: 'flex', gap: 6, background: 'none', border: 'none',
      cursor: 'pointer', marginBottom: 16, alignItems: 'center', fontFamily: 'Inter, sans-serif',
    }}>
      <Ic n="arrowLeft" s={14}/>Volver
    </button>
  )

  if (error) return <div>{back}<Card style={{ padding: 24 }}><CenterState icon="alert" title="No se pudo cargar el instructor" sub="Verifica la conexión con el servidor."/></Card></div>
  if (!data) return <div>{back}<LoadingBlock/></div>

  const { instructor: ins, adopcion: ad, carga, cumplimiento: cu, aprendices } = data
  const verEtapa = (etapaId: number, tab?: TabEtapa | null) =>
    navigate(`etapa/${etapaId}${tab ? `?tab=${tab}` : ''}`, { relative: 'path' })
  const sem = SEMAFORO[ad.semaforo] ?? SEMAFORO.NUNCA_ENTRO

  const ultReg = ad.dias_desde_ultimo_registro
  const kpis: { label: string; value: number | string; tone?: 'risk' | 'crit' }[] = [
    { label: 'Fichas de práctica', value: carga.fichas_practica },
    { label: 'Aprendices a cargo', value: aprendices.length },
    { label: 'Etapas en curso', value: carga.etapas_en_curso },
    { label: 'Seguimientos', value: ad.seguimientos_total },
    { label: 'Último registro', value: ultReg == null ? 'Nunca' : ultReg === 0 ? 'Hoy' : `hace ${ultReg}d`, tone: (ultReg ?? 99) > 14 ? 'risk' : undefined },
    { label: 'Momentos atrasados', value: cu.atrasados.length, tone: cu.atrasados.length > 0 ? 'crit' : undefined },
  ]

  return (
    <div>
      {back}

      {/* Cabecera */}
      <Card style={{ padding: 18, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
          <Ava name={ins.nombre_completo} size={44}/>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--fx-tinta)' }}>{ins.nombre_completo}</span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 9px', borderRadius: 20,
                fontSize: 11, fontWeight: 700, background: sem.bg, color: sem.fg,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: sem.dot }}/>{sem.label}
              </span>
              {!ins.activo && <Bdg tone="neutral">Inactivo</Bdg>}
              {ins.primer_login && <Bdg tone="warn">No ha entrado</Bdg>}
              {!ins.firma_registrada && <Bdg tone="warn">Sin firma</Bdg>}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--fx-tinta-2)', marginTop: 3 }}>{ins.email}</div>
            <div style={{ fontSize: 11.5, color: 'var(--fx-tinta-3)', marginTop: 4, fontFamily: '"JetBrains Mono", monospace' }}>
              {ins.tipo_documento} {ins.numero_documento}
              {ins.centro_nombre ? ` · ${ins.centro_nombre}` : ''}
              {ins.coordinacion_nombre ? ` · ${ins.coordinacion_nombre}` : ''}
            </div>
          </div>
        </div>
      </Card>

      <div className="agenda-vistas" role="tablist" style={{ marginBottom: 18 }}>
        {VISTAS.map(v => (
          <button key={v.id} role="tab" aria-selected={vista === v.id} className={vista === v.id ? 'sel' : ''} onClick={() => cambiarVista(v.id)}>
            <Ic n={v.icon} s={13}/>{v.label}
          </button>
        ))}
      </div>

      {vista === 'pendientes' || vista === 'calendario' ? (
        <VistaAgendaInstructor instructorId={instructorId} vista={vista} onVerEtapa={verEtapa} onIrPendientes={() => cambiarVista('pendientes')}/>
      ) : vista === 'historial' ? (
        <InstHistorial url={`/instructores/${instructorId}/historial`} onOpenEtapa={id => verEtapa(id)}/>
      ) : (<>
      {/* Resumen */}
      <SectionTitle>Resumen</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
        {kpis.map(k => <Stat key={k.label} label={k.label} value={k.value} tone={k.tone}/>)}
      </div>

      {/* Aprendices */}
      <SectionTitle>Aprendices a su cargo · {aprendices.length}</SectionTitle>
      {aprendices.length === 0 ? (
        <Card style={{ padding: 20 }}><div style={{ fontSize: 12.5, color: 'var(--fx-tinta-4)', textAlign: 'center' }}>Sin etapas productivas registradas.</div></Card>
      ) : (
        <Card style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 720 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--fx-linea)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fx-tinta-3)' }}>
                  <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600 }}>Aprendiz</th>
                  <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600 }}>Ficha</th>
                  <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600 }}>Modalidad</th>
                  <th style={{ textAlign: 'center', padding: '10px 14px', fontWeight: 600 }}>P · S · E</th>
                  <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600 }}>Últ. seguimiento</th>
                </tr>
              </thead>
              <tbody>
                {aprendices.map(a => (
                  <tr key={a.etapa_id}
                    onClick={() => verEtapa(a.etapa_id)}
                    className="nx-row"
                    style={{ borderBottom: '1px solid var(--fx-superficie-2)', cursor: 'pointer' }}>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--fx-tinta)' }}>{a.aprendiz_nombre}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--fx-tinta-4)', fontFamily: '"JetBrains Mono", monospace' }}>{a.numero_documento}</div>
                    </td>
                    <td style={{ padding: '10px 14px', fontFamily: '"JetBrains Mono", monospace', color: 'var(--fx-tinta-2)' }}># {a.numero_ficha}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--fx-tinta-2)' }}>{MODALIDAD_LABEL[a.modalidad] ?? a.modalidad}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                        {([a.momentos.planeacion, a.momentos.seguimiento, a.momentos.evaluacion]).map((ok, i) => {
                          const m = momIcon(ok)
                          return <Ic key={i} n={m.n} s={14} style={{ color: m.color }}/>
                        })}
                      </div>
                    </td>
                    <td style={{ padding: '10px 14px', fontFamily: '"JetBrains Mono", monospace', color: 'var(--fx-tinta-2)' }}>{fd(a.ultimo_seguimiento)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      </>)}
    </div>
  )
}

const TABS_ETAPA: TabEtapa[] = ['cronograma', 'planeacion', 'seguimientos', 'evaluacion', 'bitacoras']

function InstructorEtapaRoute() {
  "use no memo"
  const { etapaId } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const rol = useAuthStore(s => s.user?.rol)
  const tab = TABS_ETAPA.find(t => t === params.get('tab'))
  return (
    <Expediente
      key={`${etapaId}-${tab ?? ''}`}
      etapaId={Number(etapaId)}
      abrir={tab}
      soloLectura={rol !== 'SUPER_ADMIN' && rol !== 'SUBDIRECTOR'}
      backLabel="Volver"
      onBack={() => navigate(-1)}
    />
  )
}

export function InstructorDetalle({ instructorId, onBack }: { instructorId: string; onBack: () => void }) {
  "use no memo"
  return (
    <Routes>
      <Route index element={<InstructorDetalleMain instructorId={instructorId} onBack={onBack}/>}/>
      <Route path="etapa/:etapaId" element={<InstructorEtapaRoute/>}/>
    </Routes>
  )
}

// Wrapper de ruta: toma el id del splat (`:instructorId` en InstructoresPractica /
// CoordinacionDetalle, `:usuarioId` en UsuariosAdmin) y le da su `onBack`
// relativo. El fetch del detalle vive en InstructorDetalleMain.
export function InstructorDetalleRoute() {
  "use no memo"
  const params = useParams()
  const id = params.instructorId ?? params.usuarioId ?? ''
  const navigate = useNavigate()
  return <InstructorDetalle instructorId={id} onBack={() => navigate('..', { relative: 'path' })}/>
}
