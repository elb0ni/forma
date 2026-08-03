import { useEffect, useState } from 'react'
import { Ic, Card, Btn, Tag, Bdg } from '../../components/ui'
import { fd, CenterState, LoadingBlock, Spinner } from '../shared/parts'
import { useAuthStore } from '../../store/auth'
import api from '../../lib/api'
import { tonoEtapa, MODALIDAD_LABEL, MODALIDAD_TIENE_EMPRESA } from './types'
import type { EtapaProductiva, Aprendiz, ModalidadEtapaProductiva } from './types'
import { Field, SectionIntro } from './parts'

type Filtro = 'TODAS' | 'EN_CURSO' | 'SIN_JUICIO' | 'APROBADO' | 'NO_APROBADO'

const CHIPS: { key: Filtro; label: string }[] = [
  { key: 'TODAS', label: 'Todas' },
  { key: 'EN_CURSO', label: 'En curso' },
  { key: 'SIN_JUICIO', label: 'Falta juicio Sofia' },
  { key: 'APROBADO', label: 'Aprobadas' },
  { key: 'NO_APROBADO', label: 'No aprobadas' },
]

export function EtapaProductivaList({ onOpen, onNuevo }: { onOpen: (etapaId: number) => void; onNuevo: () => void }) {
  "use no memo"
  const user = useAuthStore(s => s.user)!
  const [etapas, setEtapas] = useState<EtapaProductiva[] | null>(null)
  const [error, setError] = useState(false)
  const [filt, setFilt] = useState<Filtro>('TODAS')
  const [q, setQ] = useState('')

  function load() {
    api.get<EtapaProductiva[]>(`/etapas-productivas?instructor_id=${user.id}`)
      .then(r => setEtapas(r.data))
      .catch(() => setError(true))
  }
  useEffect(load, [user.id])

  if (error) return <Card style={{ padding: 24 }}><CenterState icon="alert" title="No se pudieron cargar los registros" sub="Verifica la conexión con el servidor."/></Card>
  if (!etapas) return <LoadingBlock/>

  const withTono = etapas.map(e => ({ e, tono: tonoEtapa(e) }))
  const counts: Record<Filtro, number> = {
    TODAS: etapas.length,
    EN_CURSO: withTono.filter(x => x.tono.caso === 'EN_CURSO').length,
    SIN_JUICIO: withTono.filter(x => x.tono.caso === 'SIN_JUICIO').length,
    APROBADO: withTono.filter(x => x.tono.caso === 'APROBADO').length,
    NO_APROBADO: withTono.filter(x => x.tono.caso === 'NO_APROBADO').length,
  }

  const ql = q.trim().toLowerCase()
  const view = withTono.filter(({ e, tono }) => {
    if (filt !== 'TODAS' && tono.caso !== filt) return false
    if (ql && !(e.aprendiz_nombre ?? '').toLowerCase().includes(ql) && !(e.aprendiz_documento ?? '').includes(ql)) return false
    return true
  })

  return (
    <div style={{ maxWidth: 1200 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 4, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13.5, color: '#52525b' }}>
          {view.length} aprendiz{view.length === 1 ? '' : 'es'} en etapa productiva
        </div>
        <Btn variant="accent" icon="plus" onClick={onNuevo}>Nuevo registro</Btn>
      </div>

      <div className="inst-toolbar" style={{ marginTop: 14 }}>
        <div className="inst-chips">
          {CHIPS.map(c => (
            <button key={c.key} onClick={() => setFilt(c.key)} className={`inst-chip${filt === c.key ? ' inst-chip--active' : ''}`}>
              {c.label}<span className="inst-chip__count">{counts[c.key]}</span>
            </button>
          ))}
        </div>
        <div className="inst-search">
          <Ic n="search" s={14} className="inst-search__icon" style={{ color: '#a1a1aa' }}/>
          <input className="inst-search__input" placeholder="Buscar aprendiz por nombre o documento…" value={q} onChange={e => setQ(e.target.value)}/>
        </div>
      </div>

      {view.length === 0 ? (
        <Card><CenterState icon="briefcase" title="Sin registros" sub="No hay aprendices en etapa productiva que coincidan con el filtro."/></Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {view.map(({ e, tono }) => (
            <Card key={e.id} onClick={() => onOpen(e.id)} style={{ padding: 16, display: 'flex', gap: 16, alignItems: 'center' }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, flexShrink: 0, display: 'grid', placeItems: 'center',
                background: '#f1f1f3', fontSize: 13, fontWeight: 600, color: '#3f3f46',
              }}>
                {(e.aprendiz_nombre ?? '?').split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: '#18181b' }}>{e.aprendiz_nombre}</span>
                  <Bdg tone={tono.tone}>{tono.label}</Bdg>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11.5, color: '#71717a', flexWrap: 'wrap' }}>
                  <Tag>{MODALIDAD_LABEL[e.modalidad]}</Tag>
                  {e.empresa_nombre && <span>{e.empresa_nombre}</span>}
                  <span style={{ fontFamily: '"JetBrains Mono", monospace' }}>{e.aprendiz_documento}</span>
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: 11.5, color: '#52525b', flexShrink: 0 }}>
                <div style={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10, color: '#a1a1aa' }}>Inicio</div>
                <div style={{ fontFamily: '"JetBrains Mono", monospace', color: '#3f3f46', marginTop: 2 }}>{fd(e.fecha_inicio)}</div>
              </div>
              <Ic n="chevronRight" s={16} style={{ color: '#d4d4d8', flexShrink: 0 }}/>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Nuevo registro: ficha → (instructor de práctica, si falta) → aprendiz → datos ─

type Paso =
  | { kind: 'ficha' }
  | { kind: 'instructor'; fichaId: number; numeroFicha: string; coordinacionId: number | null }
  | { kind: 'aprendiz'; fichaId: number; numeroFicha: string }
  | { kind: 'datos'; aprendiz: Aprendiz }

export function NuevoRegistro({ onCancel, onCreated }: { onCancel: () => void; onCreated: (etapaId: number) => void }) {
  "use no memo"
  const [paso, setPaso] = useState<Paso>({ kind: 'ficha' })

  return (
    <div style={{ maxWidth: 720 }}>
      <button onClick={onCancel} style={{ fontSize: 12.5, color: '#52525b', display: 'flex', gap: 6, background: 'none', border: 'none', cursor: 'pointer', marginBottom: 16, alignItems: 'center', fontFamily: 'inherit' }}>
        <Ic n="arrowLeft" s={14}/>Cancelar
      </button>
      {paso.kind === 'ficha' && (
        <PasoFicha onSeleccion={(fichaId, numeroFicha, coordinacionId, tieneInstructor) =>
          setPaso(tieneInstructor ? { kind: 'aprendiz', fichaId, numeroFicha } : { kind: 'instructor', fichaId, numeroFicha, coordinacionId })
        }/>
      )}
      {paso.kind === 'instructor' && (
        <PasoInstructorPractica fichaId={paso.fichaId} numeroFicha={paso.numeroFicha} coordinacionId={paso.coordinacionId}
          onBack={() => setPaso({ kind: 'ficha' })}
          onAsignado={() => setPaso({ kind: 'aprendiz', fichaId: paso.fichaId, numeroFicha: paso.numeroFicha })}/>
      )}
      {paso.kind === 'aprendiz' && (
        <PasoAprendiz fichaId={paso.fichaId} numeroFicha={paso.numeroFicha}
          onBack={() => setPaso({ kind: 'ficha' })}
          onSeleccion={aprendiz => setPaso({ kind: 'datos', aprendiz })}/>
      )}
      {paso.kind === 'datos' && (
        <CrearEtapaProductivaForm aprendiz={paso.aprendiz} onBack={() => setPaso({ kind: 'aprendiz', fichaId: paso.aprendiz.ficha_id, numeroFicha: '' })} onCreated={onCreated}/>
      )}
    </div>
  )
}

interface FichaOpt { id: number; numero_ficha: string; programa_nombre?: string; coordinacion_academica_id: number | null }

function PasoFicha({ onSeleccion }: {
  onSeleccion: (fichaId: number, numeroFicha: string, coordinacionId: number | null, tieneInstructor: boolean) => void
}) {
  "use no memo"
  const [q, setQ] = useState('')
  const [fichas, setFichas] = useState<FichaOpt[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [verificando, setVerificando] = useState<number | null>(null)

  useEffect(() => {
    api.get<FichaOpt[]>('/fichas?estado=EN_EJECUCION').then(r => setFichas(r.data)).catch(() => setError('No se pudieron cargar las fichas.'))
  }, [])

  async function seleccionar(f: FichaOpt) {
    setVerificando(f.id); setError(null)
    try {
      const r = await api.get(`/asignaciones-practica/activa?ficha_id=${f.id}`)
      onSeleccion(f.id, f.numero_ficha, f.coordinacion_academica_id, !!r.data)
    } catch {
      setError('No se pudo verificar el instructor de práctica de esta ficha. Intenta de nuevo.')
    } finally {
      setVerificando(null)
    }
  }

  const ql = q.trim().toLowerCase()
  const view = (fichas ?? []).filter(f => !ql || f.numero_ficha.toLowerCase().includes(ql)).slice(0, 30)

  return (
    <div>
      <SectionIntro title="Selecciona la ficha" sub="Busca por número de ficha del aprendiz que va a iniciar o ya está en etapa productiva."/>
      <input className="nx-input" placeholder="Número de ficha…" value={q} onChange={e => setQ(e.target.value)} autoFocus/>
      {error && <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 10 }}>{error}</div>}
      {!fichas && !error && <div style={{ fontSize: 12.5, color: '#71717a', marginTop: 12 }}>Cargando fichas…</div>}
      {fichas && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 360, overflowY: 'auto' }}>
          {view.length === 0 && q && <div style={{ fontSize: 12.5, color: '#71717a' }}>Sin resultados para "{q}".</div>}
          {view.map(f => (
            <button key={f.id} onClick={() => seleccionar(f)} disabled={verificando != null} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left',
              padding: '10px 14px', border: '1px solid #e4e4e7', borderRadius: 8, background: '#fff',
              cursor: verificando != null ? 'default' : 'pointer', fontFamily: 'inherit', opacity: verificando != null && verificando !== f.id ? 0.5 : 1,
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, fontFamily: '"JetBrains Mono", monospace', color: '#18181b' }}>{f.numero_ficha}</span>
              {verificando === f.id ? <Spinner/> : f.programa_nombre && <span style={{ fontSize: 12, color: '#71717a' }}>{f.programa_nombre}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function PasoInstructorPractica({ fichaId, numeroFicha, coordinacionId, onBack, onAsignado }: {
  fichaId: number; numeroFicha: string; coordinacionId: number | null; onBack: () => void; onAsignado: () => void
}) {
  "use no memo"
  const [instructores, setInstructores] = useState<{ id: string; nombre_completo: string }[] | null>(null)
  const [instructorId, setInstructorId] = useState('')
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (coordinacionId == null) { setInstructores([]); return }
    api.get(`/usuarios?rol=INSTRUCTOR&coordinacion_id=${coordinacionId}`).then(r => setInstructores(r.data)).catch(() => setInstructores([]))
  }, [coordinacionId])

  async function guardar() {
    if (!instructorId) return
    setBusy(true); setErr(null)
    try {
      await api.post('/asignaciones-practica', { ficha_id: fichaId, instructor_id: instructorId, fecha_inicio: fecha })
      onAsignado()
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? 'No se pudo asignar el instructor.')
    } finally { setBusy(false) }
  }

  return (
    <div>
      <SectionIntro title="Asigna el instructor de práctica"
        sub={`La ficha ${numeroFicha} todavía no tiene un instructor de seguimiento a etapa productiva — se asigna una sola vez para todos sus aprendices, no por cada uno.`}/>
      <Card style={{ padding: 20 }}>
        {coordinacionId == null ? (
          <div style={{ fontSize: 12.5, color: '#b91c1c' }}>Esta ficha no tiene coordinación académica asignada; no se puede asignar instructor de práctica.</div>
        ) : (
          <>
            <Field label="Instructor" required>
              <select className="nx-input" value={instructorId} onChange={e => setInstructorId(e.target.value)} disabled={!instructores}>
                <option value="">{instructores ? 'Selecciona un instructor…' : 'Cargando…'}</option>
                {instructores?.map(i => <option key={i.id} value={i.id}>{i.nombre_completo}</option>)}
              </select>
            </Field>
            {instructores && instructores.length === 0 && (
              <div style={{ fontSize: 11.5, color: '#71717a', marginTop: 8 }}>No hay instructores en la coordinación académica de esta ficha.</div>
            )}
            <Field label="Desde" style={{ marginTop: 14, maxWidth: 220 }}>
              <input type="date" className="nx-input" value={fecha} onChange={e => setFecha(e.target.value)}/>
            </Field>
          </>
        )}
      </Card>
      {err && <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 10 }}>{err}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
        <Btn variant="secondary" onClick={onBack} disabled={busy}>Cambiar ficha</Btn>
        <Btn variant="accent" icon="check" disabled={!instructorId || busy} onClick={guardar}>{busy ? 'Asignando…' : 'Asignar y continuar'}</Btn>
      </div>
    </div>
  )
}

function PasoAprendiz({ fichaId, numeroFicha, onBack, onSeleccion }: {
  fichaId: number; numeroFicha: string; onBack: () => void; onSeleccion: (a: Aprendiz) => void
}) {
  "use no memo"
  const [aprendices, setAprendices] = useState<Aprendiz[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.get<Aprendiz[]>(`/aprendices?ficha_id=${fichaId}`).then(r => setAprendices(r.data)).catch(() => setError('No se pudieron cargar los aprendices de esta ficha.'))
  }, [fichaId])

  return (
    <div>
      <SectionIntro title="Selecciona el aprendiz" sub={`Aprendices registrados en la ficha ${numeroFicha || fichaId}.`}/>
      {error && <div style={{ fontSize: 12, color: '#b91c1c' }}>{error}</div>}
      {!aprendices && !error && <div style={{ fontSize: 12.5, color: '#71717a' }}>Cargando…</div>}
      {aprendices && aprendices.length === 0 && (
        <div style={{ fontSize: 12.5, color: '#71717a' }}>Esta ficha no tiene aprendices cargados todavía.</div>
      )}
      {aprendices && aprendices.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 360, overflowY: 'auto' }}>
          {aprendices.map(a => (
            <button key={a.id} onClick={() => onSeleccion(a)} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left',
              padding: '10px 14px', border: '1px solid #e4e4e7', borderRadius: 8, background: '#fff', cursor: 'pointer', fontFamily: 'inherit',
            }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: '#18181b' }}>{a.nombre_completo}</span>
              <span style={{ fontSize: 12, fontFamily: '"JetBrains Mono", monospace', color: '#71717a' }}>{a.numero_documento}</span>
            </button>
          ))}
        </div>
      )}
      <div style={{ marginTop: 14 }}><Btn variant="secondary" onClick={onBack}>Cambiar ficha</Btn></div>
    </div>
  )
}

const MODALIDADES: ModalidadEtapaProductiva[] = ['CONTRATO_APRENDIZAJE', 'VINCULO_LABORAL', 'MONITORIA', 'UNIDAD_PRODUCTIVA']

// Exportado para reutilizarse fuera del wizard (ej. InstFichaPractica.tsx),
// cuando ya se conoce el aprendiz y no hace falta el paso de buscar ficha/aprendiz.
export function CrearEtapaProductivaForm({ aprendiz, onBack, onCreated }: { aprendiz: Aprendiz; onBack: () => void; onCreated: (id: number) => void }) {
  "use no memo"
  const [modalidad, setModalidad] = useState<ModalidadEtapaProductiva>('CONTRATO_APRENDIZAJE')
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [empresaNombre, setEmpresaNombre] = useState('')
  const [empresaNit, setEmpresaNit] = useState('')
  const [empresaDireccion, setEmpresaDireccion] = useState('')
  const [jefeNombre, setJefeNombre] = useState('')
  const [jefeCargo, setJefeCargo] = useState('')
  const [jefeTelefono, setJefeTelefono] = useState('')
  const [jefeEmail, setJefeEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const tieneEmpresa = MODALIDAD_TIENE_EMPRESA[modalidad]
  const puedeGuardar = !!fechaInicio && !!fechaFin

  async function guardar() {
    setBusy(true); setErr(null)
    try {
      const r = await api.post('/etapas-productivas', {
        aprendiz_id: aprendiz.id,
        modalidad,
        fecha_inicio: fechaInicio,
        fecha_fin_estimada: fechaFin,
        empresa_nombre: tieneEmpresa ? empresaNombre || undefined : undefined,
        empresa_nit: tieneEmpresa ? empresaNit || undefined : undefined,
        empresa_direccion: tieneEmpresa ? empresaDireccion || undefined : undefined,
        jefe_inmediato_nombre: tieneEmpresa ? jefeNombre || undefined : undefined,
        jefe_inmediato_cargo: tieneEmpresa ? jefeCargo || undefined : undefined,
        jefe_inmediato_telefono: tieneEmpresa ? jefeTelefono || undefined : undefined,
        jefe_inmediato_email: tieneEmpresa ? jefeEmail || undefined : undefined,
      })
      onCreated(r.data.id)
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? 'No se pudo crear la etapa productiva.')
    } finally { setBusy(false) }
  }

  return (
    <div>
      <SectionIntro title="Datos de la etapa productiva" sub={`Aprendiz: ${aprendiz.nombre_completo} · ${aprendiz.numero_documento}`}/>
      <Card style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Alternativa / modalidad" required>
          <select className="nx-input" value={modalidad} onChange={e => setModalidad(e.target.value as ModalidadEtapaProductiva)}>
            {MODALIDADES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Fecha inicio etapa productiva" required><input type="date" className="nx-input" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)}/></Field>
          <Field label="Fecha fin estimada" required><input type="date" className="nx-input" value={fechaFin} onChange={e => setFechaFin(e.target.value)}/></Field>
        </div>
        {tieneEmpresa && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Field label="Nombre empresa o entidad co-formadora"><input className="nx-input" value={empresaNombre} onChange={e => setEmpresaNombre(e.target.value)}/></Field>
              <Field label="NIT"><input className="nx-input" value={empresaNit} onChange={e => setEmpresaNit(e.target.value)}/></Field>
            </div>
            <Field label="Dirección"><input className="nx-input" value={empresaDireccion} onChange={e => setEmpresaDireccion(e.target.value)}/></Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Field label="Nombre del jefe inmediato"><input className="nx-input" value={jefeNombre} onChange={e => setJefeNombre(e.target.value)}/></Field>
              <Field label="Cargo"><input className="nx-input" value={jefeCargo} onChange={e => setJefeCargo(e.target.value)}/></Field>
              <Field label="Contacto telefónico"><input className="nx-input" value={jefeTelefono} onChange={e => setJefeTelefono(e.target.value)}/></Field>
              <Field label="Correo electrónico"><input className="nx-input" value={jefeEmail} onChange={e => setJefeEmail(e.target.value)}/></Field>
            </div>
          </>
        )}
      </Card>
      {err && <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 10 }}>{err}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
        <Btn variant="secondary" onClick={onBack} disabled={busy}>Volver</Btn>
        <Btn variant="accent" icon="check" disabled={!puedeGuardar || busy} onClick={guardar}>{busy ? 'Creando…' : 'Crear registro'}</Btn>
      </div>
    </div>
  )
}
