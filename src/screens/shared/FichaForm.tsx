import { useState, useEffect, Fragment } from 'react'
import type { ReactNode } from 'react'
import axios from 'axios'
import { Ic, Card, Btn } from '../../components/ui'
import { useAuthStore } from '../../store/auth'
import type { ProgramaResumen } from '../../types'
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
  modalidad_formacion?:      'PRESENCIAL' | 'VIRTUAL' | 'A_DISTANCIA' | null
  estrategia_formativa?:     string | null
  etapa_actual?:             'LECTIVA' | 'PRACTICA' | null
}

interface CentroOpt     { id: number; nombre: string; codigo: string }
interface CoordOpt      { id: number; nombre: string; centro_formacion_id: number | null }


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
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--fx-tinta)' }}>
          {label}{required && <span style={{ color: 'var(--fx-atraso)' }}> *</span>}
        </span>
        {hint && <span style={{ fontSize: 11, color: 'var(--fx-tinta-3)' }}>{hint}</span>}
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
    <div className="seg" style={{ display: 'inline-flex', padding: 2, background: 'var(--fx-superficie-2)', borderRadius: 8, border: '1px solid var(--fx-linea)', opacity: disabled ? 0.6 : 1 }}>
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
  const [programs,     setPrograms]     = useState<ProgramaResumen[]>([])
  const [centros,      setCentros]      = useState<CentroOpt[]>([])
  const [coords,       setCoords]       = useState<CoordOpt[]>([])

  // Campos del formulario
  const [numero,      setNumero]      = useState(ficha?.numero_ficha ?? '')
  const [progId,      setProgId]      = useState<number | null>(ficha?.programa_id ?? null)
  const [centroId,    setCentroId]    = useState<number | null>(ficha?.centro_formacion_id ?? lockScope?.centroId ?? null)
  const [coordId,     setCoordId]     = useState<number | null>(ficha?.coordinacion_academica_id ?? lockScope?.coordinacionId ?? null)
  const [fechaInicio, setFechaInicio] = useState(toInputDate(ficha?.fecha_inicio ?? null))
  const [fechaFin,    setFechaFin]    = useState(toInputDate(ficha?.fecha_fin_lectiva ?? null))
  const [sede,        setSede]        = useState(ficha?.sede ?? '')
  const [jornada,     setJornada]     = useState<Jornada>(normalizeJornada(ficha?.jornada))
  // GFPI-F-023: en el formato de etapa productiva salen bloqueados, así que
  // este es el único sitio donde se diligencian.
  const [modalidadForm,  setModalidadForm]  = useState(ficha?.modalidad_formacion ?? '')
  const [estrategiaForm, setEstrategiaForm] = useState(ficha?.estrategia_formativa ?? '')
  const [estado,      setEstado]      = useState<EstadoFicha>(ficha?.estado ?? 'EN_EJECUCION')

  const [savedId,  setSavedId]  = useState<number | null>(ficha?.id ?? null)

  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  // Una vez creada la ficha (o si ya editamos), bloqueamos lo que el backend no deja cambiar.
  const locked = editando || savedId != null

  // El coordinador solo asigna instructores (a la ficha y a aprendices
  // sueltos): los datos de la ficha quedan de solo lectura y no hay botón de
  // guardar la ficha (el backend tampoco se lo permite). El Super Admin
  // conserva edición completa.
  const soloAsignacionCoord = useAuthStore(s => s.user?.rol) === 'COORD_ACADEMICO'

  useEffect(() => {
    api.get<ProgramaResumen[]>('/programas')
      .then(r => setPrograms(r.data))
      .catch(() => {})
    // El centro solo se elige cuando NO hay scope fijo (el coordinador ya tiene el suyo).
    if (!lockScope) {
      api.get<CentroOpt[]>('/centros')
        .then(r => setCentros(r.data))
        .catch(() => {})
    }
    api.get<CoordOpt[]>('/coordinaciones')
      .then(r => setCoords(r.data))
      .catch(() => {})
  }, [])

  const selProg = programs.find(p => p.id === progId) ?? null

  // Filtra coordinaciones por el centro elegido si el dato existe.
  const coordsVisibles = (centroId != null && coords.some(c => c.centro_formacion_id != null))
    ? coords.filter(c => c.centro_formacion_id === centroId)
    : coords

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
          modalidad_formacion:       modalidadForm || undefined,
          estrategia_formativa:      estrategiaForm.trim() || undefined,
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
          modalidad_formacion:       modalidadForm || undefined,
          estrategia_formativa:      estrategiaForm.trim() || undefined,
          estado,
        })
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
        style={{ fontSize: 12.5, color: 'var(--fx-tinta-2)', display: 'flex', gap: 6, background: 'none', border: 'none', cursor: 'pointer', marginBottom: 16, alignItems: 'center' }}
      >
        <Ic n="arrowLeft" s={14}/>Fichas
      </button>

      <h2 style={{ fontSize: 22, fontWeight: 600, color: 'var(--fx-tinta)', marginBottom: 4 }}>
        {soloAsignacionCoord ? `Asignar instructores · ficha ${ficha?.numero_ficha ?? ''}` : editando ? `Editar ficha ${ficha!.numero_ficha}` : 'Crear ficha de formación'}
      </h2>
      <div style={{ fontSize: 13, color: 'var(--fx-tinta-2)', marginBottom: 24 }}>
        Define el grupo y el programa. El instructor de seguimiento se asigna después, desde la ficha.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, alignItems: 'start' }}>
        {/* Columna principal */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Datos generales */}
          <Card style={{ padding: 24 }}>
            <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--fx-tinta-3)', fontWeight: 600, marginBottom: 16 }}>
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
                <select className="nx-input" value={progId ?? ''} onChange={e => setProgId(e.target.value ? Number(e.target.value) : null)} disabled={locked}>
                  {programs.length === 0
                    ? <option value="">Cargando…</option>
                    : <option value="" disabled>Selecciona un programa…</option>}
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
                    <select className="nx-input" value={centroId ?? ''} onChange={e => { setCentroId(e.target.value ? Number(e.target.value) : null); setCoordId(null) }}>
                      <option value="">Selecciona un centro…</option>
                      {centros.map(c => <option key={c.id} value={c.id}>{c.codigo} · {c.nombre}</option>)}
                    </select>
                  </Field>
                  <Field label="Coordinación académica" required hint="define los instructores disponibles">
                    <select className="nx-input" value={coordId ?? ''} onChange={e => setCoordId(e.target.value ? Number(e.target.value) : null)} disabled={centroId == null}>
                      <option value="">{centroId == null ? 'Elige un centro primero…' : 'Selecciona una coordinación…'}</option>
                      {coordsVisibles.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </Field>
                </>
              )}
              <Field label="Sede">
                <input className="nx-input" placeholder="Cazucá · Bloque A" value={sede} onChange={e => setSede(e.target.value)} disabled={soloAsignacionCoord}/>
              </Field>
              <Field label="Fecha de inicio" required>
                <input className="nx-input" type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} disabled={locked}/>
              </Field>
              <Field label="Fecha fin lectiva" required>
                <input className="nx-input" type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} disabled={soloAsignacionCoord}/>
              </Field>
              <Field label="Jornada">
                <Seg name="jornada" value={jornada} onChange={v => setJornada(v as Jornada)} options={JORNADAS} disabled={soloAsignacionCoord}/>
              </Field>
              <Field label="Modalidad de formación" hint="GFPI-F-023">
                <select className="nx-input" value={modalidadForm} onChange={e => setModalidadForm(e.target.value as typeof modalidadForm)} disabled={soloAsignacionCoord}>
                  <option value="">Sin definir</option>
                  <option value="PRESENCIAL">Presencial</option>
                  <option value="VIRTUAL">Virtual</option>
                  <option value="A_DISTANCIA">A distancia</option>
                </select>
              </Field>
              <Field label="Estrategia formativa" hint="GFPI-F-023">
                <input className="nx-input" value={estrategiaForm} onChange={e => setEstrategiaForm(e.target.value)} disabled={soloAsignacionCoord}/>
              </Field>
              {editando && (
                <Field label="Estado">
                  <select className="nx-input" value={estado} onChange={e => setEstado(e.target.value as EstadoFicha)} disabled={soloAsignacionCoord}>
                    {ESTADOS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>
              )}
            </div>
            {soloAsignacionCoord ? (
              <div style={{ fontSize: 11, color: 'var(--fx-tinta-4)', marginTop: 12 }}>
                Los datos generales de la ficha son de solo lectura para coordinación. Si necesitas corregir fechas, sede, jornada o estado, contacta a un administrador.
              </div>
            ) : locked && (
              <div style={{ fontSize: 11, color: 'var(--fx-tinta-4)', marginTop: 12 }}>
                El número de ficha, el programa y la fecha de inicio no se pueden modificar después de crear la ficha.
              </div>
            )}
          </Card>

          {/* v3: el instructor (de la ficha o por aprendiz) se asigna solo desde
              el panel "Asignar" de la ficha o desde Asignación. */}
          {savedId != null && (
            <div style={{ fontSize: 12.5, color: 'var(--fx-tinta-3)' }}>
              El instructor de seguimiento se asigna con el botón "Asignar" en la página de la ficha.
            </div>
          )}

          {/* Error + acciones */}
          {error && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 14px', background: 'var(--fx-atraso-suave)', border: '1px solid var(--fx-atraso-linea)', borderRadius: 8 }}>
              <Ic n="alert" s={15} style={{ color: 'var(--fx-atraso)', flexShrink: 0 }}/>
              <span style={{ fontSize: 12.5, color: 'var(--fx-atraso)' }}>{error}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            {soloAsignacionCoord ? (
              // Cada asignación se guarda sola en su bloque; aquí solo se vuelve.
              <Btn variant="accent" icon="check" onClick={onSaved}>Listo</Btn>
            ) : (
              <>
                <Btn variant="ghost" onClick={onCancel} disabled={saving}>Cancelar</Btn>
                <Btn variant="accent" icon={editando ? 'check' : 'plus'} onClick={handleSave} disabled={saving}>
                  {saving ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear ficha'}
                </Btn>
              </>
            )}
          </div>
        </div>

        {/* Columna lateral */}
        <div>
          <Card style={{ padding: 20, position: 'sticky', top: 80 }}>
            <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--fx-tinta-3)', fontWeight: 600, marginBottom: 12 }}>
              Programa seleccionado
            </div>
            {selProg ? (
              <>
                <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 6, background: 'var(--fx-tinta)', color: 'var(--fx-superficie)', display: 'grid', placeItems: 'center', fontSize: 9.5, fontWeight: 700, flexShrink: 0, fontFamily: '"JetBrains Mono", monospace' }}>
                    {selProg.codigo.slice(0, 4)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fx-tinta)', lineHeight: 1.3 }}>{selProg.nombre}</div>
                    <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: 'var(--fx-tinta-2)', marginTop: 2 }}>
                      {selProg.codigo} · {fmtVersion(selProg.version)}
                    </div>
                  </div>
                </div>
                <div style={{ paddingTop: 12, borderTop: '1px solid var(--fx-superficie-2)', display: 'grid', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--fx-tinta-3)' }}>Nivel de formación</div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fx-tinta)', marginTop: 3 }}>{selProg.nivel_formacion}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--fx-tinta-3)' }}>Título que otorga</div>
                    <div style={{ fontSize: 12.5, color: 'var(--fx-tinta-2)', marginTop: 3, lineHeight: 1.4 }}>{selProg.titulo_otorga}</div>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ fontSize: 12.5, color: 'var(--fx-tinta-4)', padding: '8px 0' }}>Selecciona un programa.</div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
