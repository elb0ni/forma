import { useState, useEffect, Fragment } from 'react'
import type { ReactNode } from 'react'
import axios from 'axios'
import { Ic, Bdg, Card, Btn } from '../../components/ui'
import type { ProgramaListItem } from '../../types'
import api from '../../lib/api'

type Jornada = 'MAÑANA' | 'TARDE' | 'NOCHE' | 'MIXTA'
type EstadoFicha = 'EN_EJECUCION' | 'FINALIZADA' | 'SUSPENDIDA'

// Datos de la ficha que se está editando (los pasa la lista).
export interface FichaEdit {
  id:                        number
  numero_ficha:              string
  programa_id:               number
  programa_nombre:           string
  centro_formacion_id:       number
  coordinacion_academica_id: number | null
  estado:                    EstadoFicha
  fecha_inicio:              string
  fecha_fin_lectiva:         string
  fecha_fin_productiva:      string | null
  sede:                      string | null
  jornada:                   string | null
}

interface CompetenciaResumen {
  id:            number
  codigo_norma:  string
  nombre:        string
  horas_maximas: number
}

interface InstructorOpt { id: string; nombre_completo: string }
interface CentroOpt     { id: number; nombre: string; codigo: string }
interface CoordOpt      { id: number; nombre: string; centro_formacion_id: number | null }

interface AsignExistente { id: number; instructorId: string; horas: number }
interface AsignRow       { instructorId: string; horas: string }

const JORNADAS: { value: Jornada; label: string }[] = [
  { value: 'MAÑANA', label: 'Mañana' },
  { value: 'TARDE',  label: 'Tarde'  },
  { value: 'NOCHE',  label: 'Noche'  },
  { value: 'MIXTA',  label: 'Mixta'  },
]

const ESTADOS: { value: EstadoFicha; label: string }[] = [
  { value: 'EN_EJECUCION', label: 'En ejecución' },
  { value: 'FINALIZADA',   label: 'Finalizada'   },
  { value: 'SUSPENDIDA',   label: 'Suspendida'   },
]

// ─── Primitivos de formulario (estilo forma.html) ──────────────────────────────

function Field({ label, hint, required, children }: {
  label: string; hint?: string; required?: boolean; children: ReactNode
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: '#27272a' }}>
          {label}{required && <span style={{ color: '#b91c1c' }}> *</span>}
        </span>
        {hint && <span style={{ fontSize: 11, color: '#71717a' }}>{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function Seg({ name, value, onChange, options, disabled }: {
  name: string; value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]; disabled?: boolean
}) {
  return (
    <div className="seg" style={{ display: 'inline-flex', padding: 2, background: '#f1f1f3', borderRadius: 8, border: '1px solid #e4e4e7', opacity: disabled ? 0.6 : 1 }}>
      {options.map(o => (
        <Fragment key={o.value}>
          <input type="radio" name={name} id={`${name}-${o.value}`} checked={value === o.value} onChange={() => onChange(o.value)} disabled={disabled}/>
          <label htmlFor={`${name}-${o.value}`}>{o.label}</label>
        </Fragment>
      ))}
    </div>
  )
}

function toInputDate(s: string | null): string {
  return s ? s.slice(0, 10) : ''
}

// El backend a veces devuelve la jornada en minúsculas o sin tilde normalizada;
// comparamos sin distinguir mayúsculas/acentos para que el toggle siempre marque una opción.
function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

function normalizeJornada(j: string | null | undefined): Jornada {
  const clean = stripAccents((j ?? '').toUpperCase())
  const found = JORNADAS.find(o => stripAccents(o.value) === clean)
  return found?.value ?? 'MAÑANA'
}

function fmtVersion(v: string | number): string {
  return `V${String(v).replace(/^v/i, '').padStart(3, '0')}`
}

// ─── Pantalla ───────────────────────────────────────────────────────────────────

export function FichaForm({ ficha, onCancel, onSaved, lockScope }: {
  ficha: FichaEdit | null; onCancel: () => void; onSaved: () => void
  lockScope?: { centroId: number; coordinacionId: number }
}) {
  "use no memo"
  const editando = ficha !== null

  // Catálogos
  const [programs,     setPrograms]     = useState<ProgramaListItem[]>([])
  const [centros,      setCentros]      = useState<CentroOpt[]>([])
  const [coords,       setCoords]       = useState<CoordOpt[]>([])
  const [comps,        setComps]        = useState<CompetenciaResumen[]>([])
  const [instructores, setInstructores] = useState<InstructorOpt[]>([])

  // Campos del formulario
  const [numero,      setNumero]      = useState(ficha?.numero_ficha ?? '')
  const [progId,      setProgId]      = useState<number | null>(ficha?.programa_id ?? null)
  const [centroId,    setCentroId]    = useState<number | null>(ficha?.centro_formacion_id ?? lockScope?.centroId ?? null)
  const [coordId,     setCoordId]     = useState<number | null>(ficha?.coordinacion_academica_id ?? lockScope?.coordinacionId ?? null)
  const [fechaInicio, setFechaInicio] = useState(toInputDate(ficha?.fecha_inicio ?? null))
  const [fechaFin,    setFechaFin]    = useState(toInputDate(ficha?.fecha_fin_lectiva ?? null))
  const [sede,        setSede]        = useState(ficha?.sede ?? '')
  const [jornada,     setJornada]     = useState<Jornada>(normalizeJornada(ficha?.jornada))
  const [estado,      setEstado]      = useState<EstadoFicha>(ficha?.estado ?? 'EN_EJECUCION')

  // Asignaciones (controladas + reconciliación)
  const [existing, setExisting] = useState<Record<number, AsignExistente>>({})
  const [asign,    setAsign]    = useState<Record<number, AsignRow>>({})
  const [savedId,  setSavedId]  = useState<number | null>(ficha?.id ?? null)

  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  // Una vez creada la ficha (o si ya editamos), bloqueamos lo que el backend no deja cambiar.
  const locked = editando || savedId != null

  useEffect(() => {
    api.get<ProgramaListItem[]>('/programas')
      .then(r => { setPrograms(r.data); setProgId(prev => prev ?? r.data[0]?.id ?? null) })
      .catch(() => {})
    // El centro solo se elige cuando NO hay scope fijo (el coordinador ya tiene el suyo).
    if (!lockScope) {
      api.get<CentroOpt[]>('/dashboard/super-admin/centros')
        .then(r => setCentros(r.data))
        .catch(() => {})
    }
    api.get<CoordOpt[]>('/coordinaciones')
      .then(r => setCoords(r.data))
      .catch(() => {})
    if (ficha) void refreshExisting(ficha.id)
  }, [])

  useEffect(() => {
    if (progId == null) { setComps([]); return }
    api.get<{ competencias: CompetenciaResumen[] }>(`/programas/${progId}`)
      .then(r => setComps(r.data.competencias ?? []))
      .catch(() => setComps([]))
  }, [progId])

  // Solo instructores de la coordinación de la ficha (regla: misma coordinación).
  useEffect(() => {
    if (coordId == null) { setInstructores([]); return }
    api.get<InstructorOpt[]>(`/usuarios?rol=INSTRUCTOR&coordinacion_id=${coordId}`)
      .then(r => setInstructores(r.data))
      .catch(() => setInstructores([]))
  }, [coordId])

  // Construye/mantiene las filas de asignación a partir de las competencias + lo ya guardado.
  useEffect(() => {
    setAsign(prev => {
      const next: Record<number, AsignRow> = {}
      for (const c of comps) {
        const ex = existing[c.id]
        next[c.id] = prev[c.id] ?? { instructorId: ex?.instructorId ?? '', horas: String(ex?.horas ?? c.horas_maximas) }
      }
      return next
    })
  }, [comps, existing])

  const selProg = programs.find(p => p.id === progId) ?? null
  // Solo se pueden asignar instructores si el diseño curricular del programa está digitalizado.
  const progDigitalizado = !!selProg?.tiene_disenio_curricular

  // Filtra coordinaciones por el centro elegido si el dato existe.
  const coordsVisibles = (centroId != null && coords.some(c => c.centro_formacion_id != null))
    ? coords.filter(c => c.centro_formacion_id === centroId)
    : coords

  async function refreshExisting(fichaId: number) {
    try {
      const r = await api.get<{ asignaciones: { id: number; competencia_id: number; instructor_id: string; horas_asignadas: number }[] }>(`/fichas/${fichaId}`)
      const map: Record<number, AsignExistente> = {}
      for (const a of r.data.asignaciones ?? []) {
        map[a.competencia_id] = { id: a.id, instructorId: a.instructor_id, horas: Number(a.horas_asignadas) }
      }
      setExisting(map)
    } catch { /* noop */ }
  }

  // Al cambiar de coordinación cambia el pool de instructores → limpiamos las selecciones.
  function changeCoord(newId: number | null) {
    setCoordId(newId)
    setAsign(prev => {
      const next: Record<number, AsignRow> = {}
      for (const k of Object.keys(prev)) {
        const id = Number(k)
        next[id] = { ...prev[id], instructorId: '' }
      }
      return next
    })
  }

  function autoAsignar() {
    if (instructores.length === 0) return
    setAsign(prev => {
      const next = { ...prev }
      for (const c of comps) {
        const cur = next[c.id] ?? { instructorId: '', horas: String(c.horas_maximas) }
        if (!cur.instructorId) next[c.id] = { ...cur, instructorId: instructores[0].id }
      }
      return next
    })
  }

  function setRow(compId: number, patch: Partial<AsignRow>) {
    setAsign(prev => {
      const cur = prev[compId] ?? { instructorId: '', horas: '' }
      return { ...prev, [compId]: { ...cur, ...patch } }
    })
  }

  // Crea/actualiza/elimina asignaciones para que coincidan con la tabla. Devuelve errores por fila.
  async function reconcileAsignaciones(fichaId: number): Promise<string[]> {
    const errs: string[] = []
    for (const c of comps) {
      const row = asign[c.id]
      const ex = existing[c.id]
      const wantInstr = row?.instructorId || ''
      const wantHoras = Number(row?.horas) || 0
      try {
        if (!wantInstr) {
          if (ex) await api.delete(`/asignaciones/${ex.id}`)
        } else if (!ex) {
          await api.post('/asignaciones', { ficha_id: fichaId, instructor_id: wantInstr, competencia_id: c.id, horas_asignadas: wantHoras })
        } else if (ex.instructorId !== wantInstr) {
          await api.delete(`/asignaciones/${ex.id}`)
          await api.post('/asignaciones', { ficha_id: fichaId, instructor_id: wantInstr, competencia_id: c.id, horas_asignadas: wantHoras })
        } else if (ex.horas !== wantHoras) {
          await api.patch(`/asignaciones/${ex.id}`, { horas_asignadas: wantHoras })
        }
      } catch (e) {
        const m = axios.isAxiosError(e) ? (e.response?.data?.message ?? e.message) : 'error'
        errs.push(`${c.codigo_norma}: ${Array.isArray(m) ? m.join(', ') : m}`)
      }
    }
    return errs
  }

  async function handleSave() {
    setError(null)
    if (!numero.trim() || progId == null || centroId == null || coordId == null || !fechaInicio || !fechaFin) {
      setError('Completa los obligatorios: número, programa, centro, coordinación y fechas.')
      return
    }
    setSaving(true)
    try {
      let fichaId = savedId
      if (fichaId == null) {
        const res = await api.post<{ id: number }>('/fichas', {
          programa_id:               progId,
          centro_formacion_id:       centroId,
          coordinacion_academica_id: coordId,
          numero_ficha:              numero.trim(),
          fecha_inicio:              fechaInicio,
          fecha_fin_lectiva:         fechaFin,
          sede:                      sede.trim() || undefined,
          jornada,
        })
        fichaId = res.data.id
        setSavedId(fichaId)
      } else {
        // UpdateFichaDto no permite cambiar programa, número ni fecha de inicio.
        await api.patch(`/fichas/${fichaId}`, {
          centro_formacion_id:       centroId,
          coordinacion_academica_id: coordId,
          fecha_fin_lectiva:         fechaFin,
          sede:                      sede.trim() || undefined,
          jornada,
          estado,
        })
      }

      const asignErrors = await reconcileAsignaciones(fichaId)
      if (asignErrors.length) {
        await refreshExisting(fichaId)
        setError('La ficha se guardó, pero algunas asignaciones fallaron: ' + asignErrors.join(' · '))
        setSaving(false)
        return
      }
      onSaved()
    } catch (e) {
      const msg = axios.isAxiosError(e)
        ? (e.response?.data?.message ?? e.message)
        : 'No se pudo guardar la ficha.'
      setError(Array.isArray(msg) ? msg.join(' · ') : String(msg))
      setSaving(false)
    }
  }

  return (
    <div style={{ paddingBottom: 48 }}>
      <button
        onClick={onCancel}
        style={{ fontSize: 12.5, color: '#52525b', display: 'flex', gap: 6, background: 'none', border: 'none', cursor: 'pointer', marginBottom: 16, alignItems: 'center' }}
      >
        <Ic n="arrowLeft" s={14}/>Fichas
      </button>

      <h2 style={{ fontSize: 22, fontWeight: 600, color: '#0a0a0b', marginBottom: 4 }}>
        {editando ? `Editar ficha ${ficha!.numero_ficha}` : 'Crear ficha de formación'}
      </h2>
      <div style={{ fontSize: 13, color: '#52525b', marginBottom: 24 }}>
        Define el grupo, el programa y asigna instructores por competencia.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, alignItems: 'start' }}>
        {/* Columna principal */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Datos generales */}
          <Card style={{ padding: 24 }}>
            <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#71717a', fontWeight: 600, marginBottom: 16 }}>
              Datos generales
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Field label="Número de ficha" required hint="7 dígitos">
                <input
                  className="nx-input" placeholder="2871450" value={numero}
                  onChange={e => setNumero(e.target.value)} disabled={locked}
                  style={{ fontFamily: '"JetBrains Mono", monospace' }}
                />
              </Field>
              <Field label="Programa" required>
                <select className="nx-input" value={progId ?? ''} onChange={e => setProgId(Number(e.target.value))} disabled={locked}>
                  {programs.length === 0 && <option value="">Cargando…</option>}
                  {programs.map(p => <option key={p.id} value={p.id}>{p.codigo} · {p.nombre}</option>)}
                </select>
              </Field>
              {lockScope ? (
                <Field label="Coordinación académica" hint="define los instructores disponibles">
                  <input className="nx-input" value={coords.find(c => c.id === coordId)?.nombre ?? 'Tu coordinación'} disabled/>
                </Field>
              ) : (
                <>
                  <Field label="Centro de formación" required>
                    <select className="nx-input" value={centroId ?? ''} onChange={e => { setCentroId(e.target.value ? Number(e.target.value) : null); changeCoord(null) }}>
                      <option value="">Selecciona un centro…</option>
                      {centros.map(c => <option key={c.id} value={c.id}>{c.codigo} · {c.nombre}</option>)}
                    </select>
                  </Field>
                  <Field label="Coordinación académica" required hint="define los instructores disponibles">
                    <select className="nx-input" value={coordId ?? ''} onChange={e => changeCoord(e.target.value ? Number(e.target.value) : null)} disabled={centroId == null}>
                      <option value="">{centroId == null ? 'Elige un centro primero…' : 'Selecciona una coordinación…'}</option>
                      {coordsVisibles.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </Field>
                </>
              )}
              <Field label="Sede">
                <input className="nx-input" placeholder="Cazucá · Bloque A" value={sede} onChange={e => setSede(e.target.value)}/>
              </Field>
              <Field label="Fecha de inicio" required>
                <input className="nx-input" type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} disabled={locked}/>
              </Field>
              <Field label="Fecha fin lectiva" required>
                <input className="nx-input" type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)}/>
              </Field>
              <Field label="Jornada">
                <Seg name="jornada" value={jornada} onChange={v => setJornada(v as Jornada)} options={JORNADAS}/>
              </Field>
              {editando && (
                <Field label="Estado">
                  <select className="nx-input" value={estado} onChange={e => setEstado(e.target.value as EstadoFicha)}>
                    {ESTADOS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>
              )}
            </div>
            {locked && (
              <div style={{ fontSize: 11, color: '#a1a1aa', marginTop: 12 }}>
                El número de ficha, el programa y la fecha de inicio no se pueden modificar después de crear la ficha.
              </div>
            )}
          </Card>

          {/* Asignación de instructores */}
          <Card style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#71717a', fontWeight: 600 }}>
                  Asignación de instructores
                </div>
                <div style={{ fontSize: 12, color: '#52525b', marginTop: 2 }}>
                  Solo instructores de la coordinación seleccionada.
                </div>
              </div>
              <Btn size="sm" variant="ghost" icon="sparkles" onClick={autoAsignar} disabled={!progDigitalizado}>Auto-asignar</Btn>
            </div>
            {selProg && !progDigitalizado ? (
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: 16, background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 8 }}>
                <Ic n="alert" s={16} style={{ color: '#a16207', flexShrink: 0, marginTop: 1 }}/>
                <div style={{ fontSize: 12.5, color: '#854d0e', lineHeight: 1.5 }}>
                  <strong>Diseño curricular no digitalizado.</strong> Este programa todavía no tiene su diseño curricular cargado, por lo que no tiene competencias para asignar. Digitalízalo primero (Programas → Digitalizar) y después podrás asignar instructores a esta ficha.
                </div>
              </div>
            ) : (
            <div style={{ border: '1px solid #e4e4e7', borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#71717a', background: '#f7f7f8', borderBottom: '1px solid #e4e4e7' }}>
                    {['Código', 'Competencia', 'Horas', 'Instructor'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: h === 'Horas' ? 'right' : 'left', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comps.length === 0 && (
                    <tr><td colSpan={4} style={{ padding: '18px 10px', textAlign: 'center', color: '#a1a1aa', fontSize: 12 }}>
                      {progId == null ? 'Selecciona un programa.' : 'Este programa no tiene competencias digitalizadas.'}
                    </td></tr>
                  )}
                  {comps.map(c => {
                    const row = asign[c.id] ?? { instructorId: '', horas: String(c.horas_maximas) }
                    return (
                    <tr key={c.id} style={{ borderBottom: '1px solid #f1f1f3' }}>
                      <td style={{ padding: '8px 10px', fontFamily: '"JetBrains Mono", monospace', color: '#71717a', fontSize: 10.5 }}>{c.codigo_norma}</td>
                      <td style={{ padding: '8px 10px', color: '#18181b', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nombre}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                        <input
                          value={row.horas}
                          onChange={e => setRow(c.id, { horas: e.target.value })}
                          style={{ width: 50, textAlign: 'right', padding: '3px 6px', border: '1px solid #e4e4e7', borderRadius: 4, fontSize: 12, fontFamily: '"JetBrains Mono", monospace' }}
                        />
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <select
                          value={row.instructorId}
                          onChange={e => setRow(c.id, { instructorId: e.target.value })}
                          disabled={coordId == null}
                          style={{ fontSize: 12, padding: '3px 6px', border: '1px solid #e4e4e7', borderRadius: 4, width: '100%', fontFamily: 'Inter, sans-serif' }}
                        >
                          <option value="">{coordId == null ? 'Elige coordinación' : 'Sin asignar'}</option>
                          {coordId != null && instructores.length === 0 && <option disabled>No hay instructores en esta coordinación</option>}
                          {instructores.map(i => <option key={i.id} value={i.id}>{i.nombre_completo}</option>)}
                        </select>
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            )}
          </Card>

          {/* Error + acciones */}
          {error && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 14px', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 8 }}>
              <Ic n="alert" s={15} style={{ color: '#b91c1c', flexShrink: 0 }}/>
              <span style={{ fontSize: 12.5, color: '#b91c1c' }}>{error}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Btn variant="ghost" onClick={onCancel} disabled={saving}>Cancelar</Btn>
            <Btn variant="accent" icon={editando ? 'check' : 'plus'} onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear ficha'}
            </Btn>
          </div>
        </div>

        {/* Columna lateral */}
        <div>
          <Card style={{ padding: 20, position: 'sticky', top: 80 }}>
            <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#71717a', fontWeight: 600, marginBottom: 12 }}>
              Programa seleccionado
            </div>
            {selProg ? (
              <>
                <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 6, background: '#0a0a0b', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 9.5, fontWeight: 700, flexShrink: 0, fontFamily: '"JetBrains Mono", monospace' }}>
                    {selProg.codigo.slice(0, 4)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0a0a0b', lineHeight: 1.3 }}>{selProg.nombre}</div>
                    <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: '#52525b', marginTop: 2 }}>
                      {selProg.codigo} · {fmtVersion(selProg.version)}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, paddingTop: 12, borderTop: '1px solid #f1f1f3' }}>
                  {([
                    ['Comp.', selProg.total_competencias],
                    ['RAs',   selProg.total_ra],
                    ['Horas', (selProg.horas_lectivas + (selProg.horas_productivas ?? 0)).toLocaleString('es-CO')],
                  ] as const).map(([l, v]) => (
                    <div key={l}>
                      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#71717a' }}>{l}</div>
                      <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 15, fontWeight: 600, color: '#0a0a0b', marginTop: 4 }}>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #f1f1f3', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 10.5, color: '#71717a' }}>Diseño curricular</span>
                  <Bdg tone={selProg.tiene_disenio_curricular ? 'ok' : 'warn'}>
                    {selProg.tiene_disenio_curricular ? 'Validado' : 'Pendiente'}
                  </Bdg>
                </div>
              </>
            ) : (
              <div style={{ fontSize: 12.5, color: '#a1a1aa', padding: '8px 0' }}>Selecciona un programa.</div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
