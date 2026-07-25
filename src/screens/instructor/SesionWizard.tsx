import { useState, useEffect } from 'react'
import { Ic, Card, Btn, Tag, Bdg, Prog } from '../../components/ui'
import api from '../../lib/api'
import {
  Pill, Stepper, Seg, WizSteps, fd, Spinner, LoadingBlock, CenterState, statusFromAvance,
} from '../shared/parts'
import type { AsignacionItem, CurriculoAsignacion, MaterialSesion, TipoMaterial } from './types'
import './instructor.css'

const WIZ_STEPS = ['Información', 'Resultados', 'Conocimientos', 'Criterios', 'Materiales', 'Evidencias', 'Confirmar']

// Evidencia que el instructor adjunta (no se revisa; es obligatoria ≥1).
interface EvidenciaDraft {
  tipo: 'CONOCIMIENTO' | 'DESEMPENO' | 'PRODUCTO'
  medio: 'ARCHIVO' | 'ENLACE'
  titulo: string
  descripcion?: string
  enlace?: string
  file?: File | null
}

interface WizState {
  fichaId: number | null
  asignacionId: number
  fecha: string
  horas: number
  tipo: 'PRESENCIAL' | 'VIRTUAL' | 'MIXTA'
  obs: string
  // RAs trabajados en la sesión (solo selección; el avance lo deriva el backend
  // de la cobertura de sus conocimientos/criterios).
  ras: Set<number>
  conocimientos: Set<number>
  criterios: Set<number>
  materiales: MaterialSesion[]
  evidencias: EvidenciaDraft[]
}

function hoyISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function SesionWizard({ asignacionId, onCancel, onSaved }: {
  asignacionId: number
  onCancel: () => void
  onSaved: (sesionId: number) => void
}) {
  "use no memo"
  const [step, setStep] = useState(0)
  const [asignaciones, setAsignaciones] = useState<AsignacionItem[]>([])
  const [curriculo, setCurriculo] = useState<CurriculoAsignacion | null>(null)
  const [loadingCur, setLoadingCur] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [st, setSt] = useState<WizState>({
    fichaId: null,
    asignacionId: asignacionId || 0,
    fecha: hoyISO(),
    horas: 4,
    tipo: 'PRESENCIAL',
    obs: '',
    ras: new Set(),
    conocimientos: new Set(),
    criterios: new Set(),
    materiales: [],
    evidencias: [],
  })

  const [sugerencias, setSugerencias] = useState<{ nombre: string; tipo: TipoMaterial; unidad: string | null }[]>([])

  // Lista de asignaciones (para el selector del paso 1)
  useEffect(() => {
    api.get<AsignacionItem[]>('/dashboard/instructor/asignaciones')
      .then(r => setAsignaciones(r.data))
      .catch(() => {})
    api.get<{ nombre: string; tipo: TipoMaterial; unidad: string | null }[]>('/sesiones/materiales/sugerencias')
      .then(r => setSugerencias(r.data))
      .catch(() => {})
  }, [])

  // Si se entró con una asignación preseleccionada, deducimos su ficha al cargar.
  useEffect(() => {
    if (st.asignacionId && st.fichaId == null && asignaciones.length) {
      const a = asignaciones.find(x => x.asignacion_id === st.asignacionId)
      if (a) setSt(s => ({ ...s, fichaId: a.ficha_id }))
    }
  }, [asignaciones, st.asignacionId, st.fichaId])

  // Currículo de la asignación seleccionada
  useEffect(() => {
    if (!st.asignacionId) { setCurriculo(null); return }
    setLoadingCur(true)
    api.get<CurriculoAsignacion>(`/dashboard/instructor/asignaciones/${st.asignacionId}/curriculo`)
      .then(r => setCurriculo(r.data))
      .catch(() => setCurriculo(null))
      .finally(() => setLoadingCur(false))
  }, [st.asignacionId])

  // Al elegir ficha en el paso 1: limpiamos la competencia y todas las selecciones.
  function selectFicha(fichaId: number) {
    setSt(s => ({ ...s, fichaId, asignacionId: 0, ras: new Set(), conocimientos: new Set(), criterios: new Set() }))
  }
  // Al cambiar de competencia, limpiamos selección de elementos
  function selectAsignacion(id: number) {
    setSt(s => ({ ...s, asignacionId: id, ras: new Set(), conocimientos: new Set(), criterios: new Set() }))
  }

  const selRas = [...st.ras]

  function toggleRa(id: number) {
    setSt(s => {
      const ras = new Set(s.ras)
      ras.has(id) ? ras.delete(id) : ras.add(id)
      // Quitar conocimientos/criterios huérfanos
      const con = new Set([...s.conocimientos].filter(cid => {
        const k = curriculo?.conocimientos.find(x => x.id === cid)
        return k && k.ra_id != null && ras.has(k.ra_id)
      }))
      const cri = new Set([...s.criterios].filter(crid => {
        const c = curriculo?.criterios.find(x => x.id === crid)
        return c && c.ra_id != null && ras.has(c.ra_id)
      }))
      return { ...s, ras, conocimientos: con, criterios: cri }
    })
  }
  function toggleSet(field: 'conocimientos' | 'criterios', id: number) {
    setSt(s => {
      const next = new Set(s[field])
      next.has(id) ? next.delete(id) : next.add(id)
      return { ...s, [field]: next }
    })
  }

  async function guardar() {
    if (!curriculo) return
    setSaving(true); setError(null)
    const contenido = [
      // El avance del RA lo deriva el backend de sus conocimientos/criterios;
      // aquí solo declaramos que el RA se trabajó en esta sesión.
      ...selRas.map(id => ({
        tipo_elemento: 'RA' as const,
        elemento_id: id,
        estado_cobertura: 'EN_PROGRESO' as const,
        porcentaje_avance: 0,
      })),
      ...[...st.conocimientos].map(id => {
        const k = curriculo.conocimientos.find(x => x.id === id)!
        return {
          tipo_elemento: k.tipo === 'PROCESO' ? ('CONOCIMIENTO_PROCESO' as const) : ('CONOCIMIENTO_SABER' as const),
          elemento_id: id,
          estado_cobertura: 'COMPLETADO' as const,
          porcentaje_avance: 100,
        }
      }),
      ...[...st.criterios].map(id => ({
        tipo_elemento: 'CRITERIO' as const,
        elemento_id: id,
        estado_cobertura: 'COMPLETADO' as const,
        porcentaje_avance: 100,
      })),
    ]
    if (st.evidencias.length === 0) {
      setSaving(false)
      setError('Debes adjuntar al menos una evidencia.')
      setStep(5)
      return
    }

    // La sesión y sus evidencias se envían en UNA sola operación (multipart):
    // el backend las inserta en la misma transacción y rechaza si no hay evidencia.
    const fd = new FormData()
    const archivos: File[] = []
    const evidencias = st.evidencias.map(ev => {
      const base = {
        tipo_evidencia: ev.tipo,
        medio: ev.medio,
        titulo: ev.titulo.trim(),
        descripcion: ev.descripcion?.trim() || undefined,
      }
      if (ev.medio === 'ENLACE') return { ...base, enlace_url: ev.enlace?.trim() }
      const archivo_idx = archivos.length
      archivos.push(ev.file as File)
      return { ...base, archivo_idx }
    })

    const payload = {
      asignacion_id: st.asignacionId,
      fecha: st.fecha,
      horas_ejecutadas: st.horas,
      tipo_sesion: st.tipo,
      observaciones: st.obs || undefined,
      contenido,
      materiales: st.materiales
        .filter(m => m.nombre.trim())
        .map(m => ({
          tipo: m.tipo,
          nombre: m.nombre.trim(),
          cantidad: m.cantidad ?? undefined,
          unidad: m.unidad?.trim() || undefined,
          descripcion: m.descripcion?.trim() || undefined,
        })),
      evidencias,
    }
    fd.append('payload', JSON.stringify(payload))
    archivos.forEach(f => fd.append('archivos', f))

    try {
      const r = await api.post<{ id: number }>('/sesiones/registrar', fd)
      onSaved(r.data.id)
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'No se pudo guardar la sesión.')
      setSaving(false)
    }
  }

  // Validación de avance por paso
  const canNext =
    step === 0 ? !!st.asignacionId && !!st.fecha && st.horas >= 0.5 :
    step === 1 ? selRas.length > 0 :
    step === 5 ? st.evidencias.length > 0 :   // evidencias obligatorias
    true

  const footerBtns = (
    <>
      {step === 0
        ? <Btn variant="ghost" icon="arrowLeft" onClick={onCancel}>Cancelar</Btn>
        : <Btn variant="secondary" icon="arrowLeft" onClick={() => setStep(s => s - 1)}>Atrás</Btn>}
      {step < 6
        ? <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {step === 1 && <span style={{ fontSize: 12, color: '#52525b' }}><strong style={{ color: '#18181b', fontFamily: '"JetBrains Mono", monospace' }}>{selRas.length}</strong> seleccionados</span>}
            {step === 4 && <span style={{ fontSize: 12, color: '#52525b' }}><strong style={{ color: '#18181b', fontFamily: '"JetBrains Mono", monospace' }}>{st.materiales.length}</strong> materiales</span>}
            {step === 5 && <span style={{ fontSize: 12, color: st.evidencias.length ? '#52525b' : '#b91c1c' }}><strong style={{ color: '#18181b', fontFamily: '"JetBrains Mono", monospace' }}>{st.evidencias.length}</strong> evidencia(s){st.evidencias.length === 0 ? ' · obligatorio' : ''}</span>}
            <Btn variant="accent" iconRight="arrowRight" onClick={() => canNext && setStep(s => s + 1)} disabled={!canNext}>Continuar</Btn>
          </div>
        : <Btn variant="accent" size="lg" onClick={guardar} disabled={saving}>
            {saving ? <><Spinner size={14} color="#fff"/> Guardando…</> : <>Guardar sesión <Ic n="check" s={14}/></>}
          </Btn>}
    </>
  )

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 24 }}>
        <button onClick={onCancel} style={{ fontSize: 12.5, color: '#52525b', display: 'flex', gap: 6, background: 'none', border: 'none', cursor: 'pointer', marginBottom: 8, alignItems: 'center', fontFamily: 'inherit' }}>
          <Ic n="arrowLeft" s={12}/>Sesiones
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 600, color: '#0a0a0b' }}>Registrar sesión</h2>
            <div style={{ fontSize: 12.5, color: '#52525b', marginTop: 4 }}>
              Paso <strong style={{ color: '#18181b', fontFamily: '"JetBrains Mono", monospace' }}>{step + 1}</strong>/7 · {WIZ_STEPS[step]}
            </div>
          </div>
          <button onClick={onCancel} style={{ fontSize: 12.5, color: '#52525b', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
        </div>
        <div style={{ marginTop: 18, maxWidth: 820 }}><WizSteps steps={WIZ_STEPS} current={step}/></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, alignItems: 'start' }}>
        <div>
          {error && <Card style={{ padding: 14, marginBottom: 14, background: '#fee2e2', border: '1px solid #fecaca' }}>
            <div style={{ fontSize: 13, color: '#b91c1c' }}>{error}</div>
          </Card>}

          {step === 0 && <StepInfo st={st} setSt={setSt} asignaciones={asignaciones} onSelectFicha={selectFicha} onSelectAsignacion={selectAsignacion}/>}
          {step > 0 && loadingCur && <LoadingBlock/>}
          {step > 0 && !loadingCur && !curriculo && <Card style={{ padding: 24 }}><CenterState icon="alert" title="Sin currículo" sub="No se pudo cargar el contenido de esta asignación."/></Card>}
          {step === 1 && curriculo && <StepRas curriculo={curriculo} st={st} onToggle={toggleRa}/>}
          {step === 2 && curriculo && <StepConocimientos curriculo={curriculo} selRas={selRas} st={st} onToggle={id => toggleSet('conocimientos', id)}/>}
          {step === 3 && curriculo && <StepCriterios curriculo={curriculo} selRas={selRas} st={st} onToggle={id => toggleSet('criterios', id)}/>}
          {step === 4 && curriculo && <StepMateriales st={st} setSt={setSt} sugerencias={sugerencias}/>}
          {step === 5 && curriculo && <StepEvidencias st={st} setSt={setSt}/>}
          {step === 6 && curriculo && <StepConfirmar curriculo={curriculo} st={st} selRas={selRas}/>}
        </div>

        <WizSummary st={st} step={step} curriculo={curriculo} selRas={selRas}/>
      </div>

      <div style={{ position: 'sticky', bottom: 0, marginTop: 32, marginLeft: -28, marginRight: -28, padding: '12px 28px', background: 'rgba(255,255,255,.96)', backdropFilter: 'blur(8px)', borderTop: '1px solid #e4e4e7', display: 'flex', justifyContent: 'space-between', zIndex: 10 }}>
        {footerBtns}
      </div>
    </div>
  )
}

// ─── Paso 1: información general ──────────────────────────────────────────────────

function StepInfo({ st, setSt, asignaciones, onSelectFicha, onSelectAsignacion }: {
  st: WizState; setSt: React.Dispatch<React.SetStateAction<WizState>>
  asignaciones: AsignacionItem[]
  onSelectFicha: (fichaId: number) => void
  onSelectAsignacion: (id: number) => void
}) {
  // Agrupamos las asignaciones por ficha para el selector en dos pasos.
  const fichasMap = new Map<number, { ficha_id: number; numero_ficha: string; programa_codigo: string; programa_nombre: string; comps: AsignacionItem[] }>()
  for (const a of asignaciones) {
    const f = fichasMap.get(a.ficha_id) ?? {
      ficha_id: a.ficha_id, numero_ficha: a.numero_ficha,
      programa_codigo: a.programa_codigo, programa_nombre: a.programa_nombre, comps: [],
    }
    f.comps.push(a)
    fichasMap.set(a.ficha_id, f)
  }
  const fichas = [...fichasMap.values()]
  const fichaSel = st.fichaId != null ? fichasMap.get(st.fichaId) : undefined

  return (
    <Card style={{ padding: 24 }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#0a0a0b', marginBottom: 4 }}>Datos generales</div>
      <div style={{ fontSize: 12.5, color: '#52525b', marginBottom: 20 }}>Primero elige la ficha, luego la competencia que vas a registrar.</div>

      <Field label="Ficha" required>
        {fichas.length === 0 ? (
          <div style={{ fontSize: 12.5, color: '#71717a' }}>No tienes asignaciones activas.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 240, overflowY: 'auto' }}>
            {fichas.map(f => {
              const sel = st.fichaId === f.ficha_id
              return (
                <button key={f.ficha_id} onClick={() => onSelectFicha(f.ficha_id)} style={{
                  textAlign: 'left', padding: 12, borderRadius: 8, cursor: 'pointer',
                  border: `2px solid ${sel ? '#4f46e5' : '#e4e4e7'}`,
                  background: sel ? 'rgba(79,70,229,.04)' : '#fff', fontFamily: 'inherit',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Tag>{f.programa_codigo}</Tag>
                      <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 13, fontWeight: 600, color: '#0a0a0b' }}># {f.numero_ficha}</span>
                    </div>
                    <span style={{ fontSize: 11, color: '#71717a' }}>
                      {sel ? <Ic n="check" s={14} style={{ color: '#4f46e5' }}/> : `${f.comps.length} comp.`}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#3f3f46', marginTop: 4 }}>{f.programa_nombre}</div>
                </button>
              )
            })}
          </div>
        )}
      </Field>

      {fichaSel && (
        <Field label="Competencia" required style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 240, overflowY: 'auto' }}>
            {fichaSel.comps.map(a => {
              const sel = st.asignacionId === a.asignacion_id
              return (
                <button key={a.asignacion_id} onClick={() => onSelectAsignacion(a.asignacion_id)} style={{
                  textAlign: 'left', padding: 12, borderRadius: 8, cursor: 'pointer',
                  border: `2px solid ${sel ? '#4f46e5' : '#e4e4e7'}`,
                  background: sel ? 'rgba(79,70,229,.04)' : '#fff', fontFamily: 'inherit',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, alignItems: 'center' }}>
                    <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: '#71717a' }}>{a.codigo_norma}</span>
                    {sel && <Ic n="check" s={14} style={{ color: '#4f46e5' }}/>}
                  </div>
                  <div style={{ fontSize: 12.5, color: '#18181b' }}>{a.competencia_nombre}</div>
                </button>
              )
            })}
          </div>
        </Field>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 18 }}>
        <Field label="Fecha" required>
          <input type="date" className="nx-input" value={st.fecha} onChange={e => setSt(s => ({ ...s, fecha: e.target.value }))}/>
        </Field>
        <Field label="Horas ejecutadas" required hint="Pasos de 0.5">
          <Stepper value={st.horas} onChange={v => setSt(s => ({ ...s, horas: v }))} step={0.5} min={0.5} max={12} suffix="h"/>
        </Field>
      </div>

      <Field label="Tipo de sesión" required style={{ marginTop: 18 }}>
        <Seg name="tipo" value={st.tipo} onChange={v => setSt(s => ({ ...s, tipo: v as WizState['tipo'] }))}
          options={[
            { value: 'PRESENCIAL', label: 'Presencial', icon: 'pin' },
            { value: 'VIRTUAL', label: 'Virtual', icon: 'external' },
            { value: 'MIXTA', label: 'Mixta', icon: 'layers' },
          ]}/>
      </Field>

      <Field label="Observaciones" hint="Opcional" style={{ marginTop: 18 }}>
        <textarea className="nx-input" style={{ resize: 'none' }} rows={3} value={st.obs}
          onChange={e => setSt(s => ({ ...s, obs: e.target.value }))} placeholder="¿Algo a tener en cuenta?"/>
      </Field>
    </Card>
  )
}

// ─── Paso 2: RAs ─────────────────────────────────────────────────────────────────

function StepRas({ curriculo, st, onToggle }: {
  curriculo: CurriculoAsignacion; st: WizState
  onToggle: (id: number) => void
}) {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#0a0a0b' }}>Resultados de aprendizaje trabajados hoy</div>
        <div style={{ fontSize: 12.5, color: '#52525b', marginTop: 4 }}>
          Marca los que trabajaste. El estado y el avance se calculan solos según los conocimientos y criterios cubiertos.
        </div>
      </div>
      {curriculo.resultados_aprendizaje.length === 0
        ? <Card style={{ padding: 24 }}><CenterState icon="info" title="Sin RAs" sub="Esta competencia no tiene resultados de aprendizaje cargados."/></Card>
        : <Card>
            {curriculo.resultados_aprendizaje.map((ra, i) => {
              const sel = st.ras.has(ra.id)
              const status = statusFromAvance(ra.avance)
              return (
                <div key={ra.id} style={{ padding: '14px 16px', borderBottom: i < curriculo.resultados_aprendizaje.length - 1 ? '1px solid #f1f1f3' : 'none', background: sel ? 'rgba(79,70,229,.03)' : '#fff' }}>
                  <label style={{ display: 'flex', gap: 14, cursor: 'pointer' }}>
                    <input type="checkbox" className="nx-check nx-check-lg" checked={sel} onChange={() => onToggle(ra.id)} style={{ marginTop: 3 }}/>
                    <div style={{ width: 28, height: 28, borderRadius: 6, background: '#f7f7f8', border: '1px solid #e4e4e7', display: 'grid', placeItems: 'center', fontSize: 11, flexShrink: 0, fontFamily: '"JetBrains Mono", monospace' }}>RA{i + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                        <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5, color: '#71717a' }}>{ra.numero}</span>
                        <Pill status={status} size="sm"/>
                      </div>
                      <div style={{ fontSize: 13.5, color: '#18181b', lineHeight: 1.4, marginBottom: 8 }}>{ra.descripcion}</div>
                      <Prog value={ra.avance} status={status} showLabel style={{ maxWidth: 340 }}/>
                    </div>
                  </label>
                </div>
              )
            })}
          </Card>}
    </div>
  )
}

// ─── Paso 3: conocimientos ───────────────────────────────────────────────────────

function StepConocimientos({ curriculo, selRas, st, onToggle }: {
  curriculo: CurriculoAsignacion; selRas: number[]; st: WizState; onToggle: (id: number) => void
}) {
  const ras = curriculo.resultados_aprendizaje.filter(r => selRas.includes(r.id))

  // Una fila de conocimiento. Los ya cubiertos quedan bloqueados: un conocimiento
  // se imparte una sola vez, así que no se puede volver a registrar.
  const Row = ({ c }: { c: CurriculoAsignacion['conocimientos'][number] }) => {
    const sel = st.conocimientos.has(c.id)
    const locked = c.completado
    return (
      <label style={{ display: 'flex', gap: 10, padding: '10px 0', cursor: locked ? 'default' : 'pointer', alignItems: 'flex-start', opacity: locked ? 0.65 : 1 }}>
        <input type="checkbox" className="nx-check" checked={locked || sel} disabled={locked} onChange={() => !locked && onToggle(c.id)} style={{ marginTop: 2 }}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, color: '#18181b', lineHeight: 1.35 }}>{c.descripcion}</div>
          {locked && (
            <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Bdg tone="ok" icon="check">Ya cubierto</Bdg>
              <span style={{ fontSize: 10.5, color: '#71717a' }}>No se puede volver a registrar</span>
            </div>
          )}
        </div>
      </label>
    )
  }

  const SubBlock = ({ title, list }: { title: string; list: CurriculoAsignacion['conocimientos'] }) => {
    if (list.length === 0) return null
    return (
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#52525b', fontWeight: 600, marginBottom: 2 }}>{title}</div>
        {list.map(c => <Row key={c.id} c={c}/>)}
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#0a0a0b' }}>Conocimientos cubiertos</div>
        <div style={{ fontSize: 12.5, color: '#52525b', marginTop: 4 }}>
          Los que faltan por cada RA seleccionado. Los <strong style={{ color: '#18181b' }}>ya cubiertos</strong> aparecen bloqueados.
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {ras.map(ra => {
          const idx = curriculo.resultados_aprendizaje.findIndex(r => r.id === ra.id)
          const items = curriculo.conocimientos.filter(c => c.ra_id === ra.id)
          const seleccionables = items.filter(c => !c.completado)
          const seleccionados = items.filter(c => st.conocimientos.has(c.id)).length
          return (
            <Card key={ra.id} style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Tag>RA{idx + 1}</Tag>
                  <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5, color: '#71717a' }}>{ra.numero}</span>
                </div>
                <span style={{ fontSize: 11, color: '#52525b', fontFamily: '"JetBrains Mono", monospace' }}>
                  {seleccionados}/{seleccionables.length}
                </span>
              </div>
              {items.length === 0
                ? <div style={{ fontSize: 12, color: '#71717a', padding: '12px 0' }}>Este RA no tiene conocimientos cargados.</div>
                : <>
                    <SubBlock title="Del Proceso" list={items.filter(c => c.tipo === 'PROCESO')}/>
                    <SubBlock title="Del Saber" list={items.filter(c => c.tipo === 'SABER')}/>
                  </>}
            </Card>
          )
        })}
      </div>
    </div>
  )
}

// ─── Paso 4: criterios ───────────────────────────────────────────────────────────

function StepCriterios({ curriculo, selRas, st, onToggle }: {
  curriculo: CurriculoAsignacion; selRas: number[]; st: WizState; onToggle: (id: number) => void
}) {
  const ras = curriculo.resultados_aprendizaje.filter(r => selRas.includes(r.id))
  const total = curriculo.criterios.filter(c => c.ra_id != null && selRas.includes(c.ra_id)).length

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#0a0a0b' }}>Criterios evaluados</div>
        <div style={{ fontSize: 12.5, color: '#52525b', marginTop: 4 }}>
          Criterios cubiertos en esta sesión. A diferencia de los conocimientos, un criterio puede reforzarse en varias sesiones.
        </div>
      </div>
      {total === 0
        ? <Card style={{ padding: 24 }}><CenterState icon="info" title="Sin criterios" sub="No hay criterios ligados a los RA seleccionados."/></Card>
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {ras.map(ra => {
              const idx = curriculo.resultados_aprendizaje.findIndex(r => r.id === ra.id)
              const items = curriculo.criterios.filter(c => c.ra_id === ra.id)
              if (items.length === 0) return null
              const seleccionados = items.filter(c => st.criterios.has(c.id)).length
              return (
                <Card key={ra.id} style={{ padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Tag>RA{idx + 1}</Tag>
                      <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5, color: '#71717a' }}>{ra.numero}</span>
                    </div>
                    <span style={{ fontSize: 11, color: '#52525b', fontFamily: '"JetBrains Mono", monospace' }}>{seleccionados}/{items.length}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {items.map(cr => {
                      const sel = st.criterios.has(cr.id)
                      return (
                        <label key={cr.id} style={{ display: 'flex', gap: 12, padding: 14, borderRadius: 8, border: `1px solid ${sel ? '#c7d2fe' : '#e4e4e7'}`, background: sel ? 'rgba(79,70,229,.04)' : '#fff', cursor: 'pointer', alignItems: 'flex-start' }}>
                          <input type="checkbox" className="nx-check nx-check-lg" checked={sel} onChange={() => onToggle(cr.id)} style={{ marginTop: 2 }}/>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13.5, color: '#18181b', lineHeight: 1.35 }}>{cr.descripcion}</div>
                            {cr.completado && <div style={{ marginTop: 6 }}><Bdg tone="ok" icon="check">Ya cubierto · puedes reforzarlo</Bdg></div>}
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </Card>
              )
            })}
          </div>}
    </div>
  )
}

// ─── Paso 5: materiales de formación ─────────────────────────────────────────────

const TIPO_MATERIAL: { value: TipoMaterial; label: string; hint: string; bg: string; fg: string }[] = [
  { value: 'DEVOLUTIVO', label: 'Devolutivo',     hint: 'Equipos y herramientas (se devuelven)', bg: '#dbeafe', fg: '#1d4ed8' },
  { value: 'CONSUMO',    label: 'De consumo',     hint: 'Insumos que se gastan',                 bg: '#fef9c3', fg: '#a16207' },
  { value: 'DIDACTICO',  label: 'Medio didáctico', hint: 'Material de apoyo, guías, software',    bg: '#f3e8ff', fg: '#7c3aed' },
  { value: 'AMBIENTE',   label: 'Ambiente',       hint: 'Aula, taller o laboratorio',            bg: '#dcfce7', fg: '#15803d' },
]
const tipoMat = (t: TipoMaterial) => TIPO_MATERIAL.find(x => x.value === t)!

function StepMateriales({ st, setSt, sugerencias }: {
  st: WizState; setSt: React.Dispatch<React.SetStateAction<WizState>>
  sugerencias: { nombre: string; tipo: TipoMaterial; unidad: string | null }[]
}) {
  "use no memo"
  const [tipo, setTipo]     = useState<TipoMaterial>('CONSUMO')
  const [nombre, setNombre] = useState('')
  const [cantidad, setCantidad] = useState('')
  const [unidad, setUnidad] = useState('')

  function agregar() {
    const nm = nombre.trim()
    if (!nm) return
    const m: MaterialSesion = {
      tipo, nombre: nm,
      cantidad: cantidad ? Number(cantidad) : null,
      unidad: unidad.trim() || null,
    }
    setSt(s => ({ ...s, materiales: [...s.materiales, m] }))
    setNombre(''); setCantidad(''); setUnidad('')
  }
  function quitar(i: number) {
    setSt(s => ({ ...s, materiales: s.materiales.filter((_, idx) => idx !== i) }))
  }
  // Al elegir una sugerencia, autocompleta tipo/unidad.
  function onNombre(v: string) {
    setNombre(v)
    const s = sugerencias.find(x => x.nombre.toLowerCase() === v.trim().toLowerCase())
    if (s) { setTipo(s.tipo); if (s.unidad && !unidad) setUnidad(s.unidad) }
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#0a0a0b' }}>Materiales de formación usados</div>
        <div style={{ fontSize: 12.5, color: '#52525b', marginTop: 4 }}>
          Registra los recursos que usaste en la sesión (opcional). Se clasifican como en el SENA:
          devolutivos, de consumo, medios didácticos y ambiente.
        </div>
      </div>

      <Card style={{ padding: 16, marginBottom: 14 }}>
        <Seg name="tipoMat" value={tipo} onChange={v => setTipo(v as TipoMaterial)}
          options={TIPO_MATERIAL.map(t => ({ value: t.value, label: t.label }))}/>
        <div style={{ fontSize: 11, color: '#71717a', margin: '6px 0 12px' }}>{tipoMat(tipo).hint}</div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 0.8fr 0.9fr auto', gap: 10, alignItems: 'end' }}>
          <div>
            <div style={{ fontSize: 11.5, color: '#52525b', marginBottom: 4 }}>Material</div>
            <input className="nx-input" list="mat-sug" placeholder="Nombre del material o recurso"
              value={nombre} onChange={e => onNombre(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); agregar() } }}/>
            <datalist id="mat-sug">
              {sugerencias.map((s, i) => <option key={i} value={s.nombre}/>)}
            </datalist>
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: '#52525b', marginBottom: 4 }}>Cantidad</div>
            <input className="nx-input" type="number" min={0} step="any" placeholder="—"
              value={cantidad} onChange={e => setCantidad(e.target.value)}/>
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: '#52525b', marginBottom: 4 }}>Unidad</div>
            <input className="nx-input" placeholder="unidad, m, kg…" value={unidad} onChange={e => setUnidad(e.target.value)}/>
          </div>
          <Btn variant="accent" icon="plus" onClick={agregar}>Agregar</Btn>
        </div>
      </Card>

      {st.materiales.length === 0 ? (
        <Card style={{ padding: 20 }}>
          <div style={{ fontSize: 12.5, color: '#71717a', textAlign: 'center' }}>
            Aún no agregaste materiales. Este paso es opcional: puedes continuar sin registrar ninguno.
          </div>
        </Card>
      ) : (
        <Card>
          {st.materiales.map((m, i) => {
            const t = tipoMat(m.tipo)
            return (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 16px', borderBottom: i < st.materiales.length - 1 ? '1px solid #f1f1f3' : 'none' }}>
                <span style={{ flexShrink: 0, fontSize: 9.5, fontWeight: 700, fontFamily: '"JetBrains Mono", monospace', background: t.bg, color: t.fg, padding: '2px 7px', borderRadius: 4 }}>{t.label}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: '#18181b' }}>{m.nombre}</div>
                </div>
                {(m.cantidad != null || m.unidad) && (
                  <span style={{ fontSize: 12, color: '#52525b', fontFamily: '"JetBrains Mono", monospace', whiteSpace: 'nowrap' }}>
                    {m.cantidad ?? ''} {m.unidad ?? ''}
                  </span>
                )}
                <button onClick={() => quitar(i)} aria-label="Quitar" style={{ flexShrink: 0, width: 26, height: 26, display: 'grid', placeItems: 'center', border: 'none', borderRadius: 6, background: '#f1f1f3', color: '#b91c1c', cursor: 'pointer' }}>
                  <Ic n="trash" s={13}/>
                </button>
              </div>
            )
          })}
        </Card>
      )}
    </div>
  )
}

// ─── Paso 6: confirmar ───────────────────────────────────────────────────────────

function StepConfirmar({ curriculo, st, selRas }: { curriculo: CurriculoAsignacion; st: WizState; selRas: number[] }) {
  const ras = curriculo.resultados_aprendizaje.filter(r => selRas.includes(r.id))
  const con = curriculo.conocimientos.filter(c => st.conocimientos.has(c.id))
  const cri = curriculo.criterios.filter(c => st.criterios.has(c.id))

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#0a0a0b' }}>Confirma y guarda</div>
        <div style={{ fontSize: 12.5, color: '#52525b', marginTop: 4 }}>Revisa los datos antes de registrar la sesión.</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
        {([['Ficha', `# ${curriculo.asignacion.numero_ficha}`, 'folder'], ['Horas', `${st.horas.toFixed(1)} h`, 'clock'], ['Tipo', st.tipo.toLowerCase(), 'layers']] as [string, string, any][]).map(([l, v, ic]) => (
          <Card key={l} style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#71717a', fontWeight: 600 }}>{l}</div>
              <Ic n={ic} s={13} style={{ color: '#a1a1aa' }}/>
            </div>
            <div style={{ fontSize: 17, fontWeight: 600, color: '#0a0a0b', marginTop: 8, textTransform: 'capitalize', fontFamily: '"JetBrains Mono", monospace' }}>{v}</div>
          </Card>
        ))}
      </div>

      <Card style={{ padding: 20, marginBottom: 12 }}>
        <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#52525b', fontWeight: 600, marginBottom: 12 }}>
          Resultados de aprendizaje · {ras.length}
        </div>
        {ras.map(ra => (
          <div key={ra.id} style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'center' }}>
            <Tag>RA{curriculo.resultados_aprendizaje.findIndex(r => r.id === ra.id) + 1}</Tag>
            <div style={{ flex: 1, fontSize: 12.5, color: '#18181b' }}>{ra.descripcion}</div>
            <Pill status={statusFromAvance(ra.avance)} size="sm"/>
          </div>
        ))}
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Card style={{ padding: 16 }}>
          <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#52525b', fontWeight: 600, marginBottom: 10 }}>Conocimientos · {con.length}</div>
          {con.slice(0, 6).map(c => (
            <div key={c.id} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <Ic n="check" s={13} style={{ color: '#15803d', flexShrink: 0, marginTop: 2 }}/>
              <div style={{ fontSize: 12.5, color: '#18181b' }}>{c.descripcion}</div>
            </div>
          ))}
          {con.length > 6 && <div style={{ fontSize: 11.5, color: '#52525b', marginTop: 4 }}>+ {con.length - 6} más</div>}
          {con.length === 0 && <div style={{ fontSize: 12, color: '#71717a' }}>Ninguno</div>}
        </Card>
        <Card style={{ padding: 16 }}>
          <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#52525b', fontWeight: 600, marginBottom: 10 }}>Criterios · {cri.length}</div>
          {cri.map(c => (
            <div key={c.id} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <Ic n="check" s={13} style={{ color: '#15803d', flexShrink: 0, marginTop: 2 }}/>
              <div style={{ fontSize: 12.5, color: '#18181b' }}>{c.descripcion}</div>
            </div>
          ))}
          {cri.length === 0 && <div style={{ fontSize: 12, color: '#71717a' }}>Ninguno</div>}
        </Card>
      </div>

      <Card style={{ padding: 16, marginTop: 10 }}>
        <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#52525b', fontWeight: 600, marginBottom: 10 }}>Materiales de formación · {st.materiales.length}</div>
        {st.materiales.length === 0
          ? <div style={{ fontSize: 12, color: '#71717a' }}>No se registraron materiales.</div>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {st.materiales.map((m, i) => {
                const t = tipoMat(m.tipo)
                return (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ flexShrink: 0, fontSize: 9, fontWeight: 700, fontFamily: '"JetBrains Mono", monospace', background: t.bg, color: t.fg, padding: '1px 6px', borderRadius: 4 }}>{t.label}</span>
                    <span style={{ fontSize: 12.5, color: '#18181b', flex: 1 }}>{m.nombre}</span>
                    {(m.cantidad != null || m.unidad) && <span style={{ fontSize: 11.5, color: '#52525b', fontFamily: '"JetBrains Mono", monospace' }}>{m.cantidad ?? ''} {m.unidad ?? ''}</span>}
                  </div>
                )
              })}
            </div>}
      </Card>

      <Card style={{ padding: 16, marginTop: 10 }}>
        <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#52525b', fontWeight: 600, marginBottom: 10 }}>Evidencias · {st.evidencias.length}</div>
        {st.evidencias.length === 0
          ? <div style={{ fontSize: 12, color: '#b91c1c' }}>Falta adjuntar evidencia (obligatoria).</div>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {st.evidencias.map((e, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Ic n={e.medio === 'ENLACE' ? 'external' : 'fileText'} s={13} style={{ color: '#15803d', flexShrink: 0 }}/>
                  <span style={{ fontSize: 12.5, color: '#18181b', flex: 1 }}>{e.titulo}</span>
                  <span style={{ fontSize: 10.5, color: '#71717a' }}>{e.medio === 'ENLACE' ? 'enlace' : 'archivo'}</span>
                </div>
              ))}
            </div>}
      </Card>
    </div>
  )
}

// ─── Paso 6: evidencias (obligatorias, sin revisión) ─────────────────────────────

const TIPO_EVID: { value: EvidenciaDraft['tipo']; label: string }[] = [
  { value: 'PRODUCTO', label: 'Producto' },
  { value: 'DESEMPENO', label: 'Desempeño' },
  { value: 'CONOCIMIENTO', label: 'Conocimiento' },
]

function StepEvidencias({ st, setSt }: {
  st: WizState; setSt: React.Dispatch<React.SetStateAction<WizState>>
}) {
  "use no memo"
  const [tipo, setTipo]   = useState<EvidenciaDraft['tipo']>('PRODUCTO')
  const [medio, setMedio] = useState<'ARCHIVO' | 'ENLACE'>('ARCHIVO')
  const [titulo, setTitulo] = useState('')
  const [desc, setDesc]   = useState('')
  const [enlace, setEnlace] = useState('')
  const [file, setFile]   = useState<File | null>(null)
  const [err, setErr]     = useState<string | null>(null)

  function agregar() {
    setErr(null)
    if (!titulo.trim()) { setErr('Ponle un título a la evidencia.'); return }
    if (medio === 'ENLACE' && !/^https?:\/\//i.test(enlace.trim())) { setErr('El enlace debe empezar con http:// o https://'); return }
    if (medio === 'ARCHIVO' && !file) { setErr('Selecciona un archivo.'); return }
    const ev: EvidenciaDraft = { tipo, medio, titulo: titulo.trim(), descripcion: desc.trim() || undefined }
    if (medio === 'ENLACE') ev.enlace = enlace.trim(); else ev.file = file
    setSt(s => ({ ...s, evidencias: [...s.evidencias, ev] }))
    setTitulo(''); setDesc(''); setEnlace(''); setFile(null)
  }
  function quitar(i: number) {
    setSt(s => ({ ...s, evidencias: s.evidencias.filter((_, idx) => idx !== i) }))
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#0a0a0b' }}>Evidencias de la sesión</div>
        <div style={{ fontSize: 12.5, color: '#52525b', marginTop: 4 }}>
          Adjunta soportes de la sesión (archivos o enlaces). <strong style={{ color: '#18181b' }}>Es obligatorio al menos una.</strong> No se revisan: quedan como respaldo.
        </div>
      </div>

      <Card style={{ padding: 16, marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: '#27272a' }}>
            Tipo
            <select value={tipo} onChange={e => setTipo(e.target.value as EvidenciaDraft['tipo'])} className="nx-input" style={{ marginTop: 4, minWidth: 150 }}>
              {TIPO_EVID.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 12, color: '#27272a' }}>
            Medio
            <select value={medio} onChange={e => setMedio(e.target.value as 'ARCHIVO' | 'ENLACE')} className="nx-input" style={{ marginTop: 4, minWidth: 130 }}>
              <option value="ARCHIVO">Archivo</option>
              <option value="ENLACE">Enlace</option>
            </select>
          </label>
        </div>
        <input className="nx-input" placeholder="Título de la evidencia" value={titulo} onChange={e => setTitulo(e.target.value)} style={{ marginBottom: 10 }}/>
        <textarea className="nx-input" rows={2} placeholder="Descripción (opcional)" value={desc} onChange={e => setDesc(e.target.value)} style={{ resize: 'vertical', marginBottom: 10 }}/>
        {medio === 'ENLACE'
          ? <input className="nx-input" placeholder="https://… (Drive, repositorio, video)" value={enlace} onChange={e => setEnlace(e.target.value)}/>
          : <input type="file" onChange={e => setFile(e.target.files?.[0] ?? null)} style={{ fontSize: 12.5 }}/>}
        {medio === 'ARCHIVO' && <div style={{ fontSize: 11, color: '#71717a', marginTop: 6 }}>Máx. 20 MB · PDF, imágenes, Office o ZIP.</div>}
        {err && <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 8 }}>{err}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <Btn variant="accent" icon="plus" onClick={agregar}>Agregar evidencia</Btn>
        </div>
      </Card>

      {st.evidencias.length === 0 ? (
        <Card style={{ padding: 20 }}>
          <div style={{ fontSize: 12.5, color: '#a16207', textAlign: 'center' }}>
            Debes adjuntar al menos una evidencia para poder registrar la sesión.
          </div>
        </Card>
      ) : (
        <Card>
          {st.evidencias.map((e, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 16px', borderBottom: i < st.evidencias.length - 1 ? '1px solid #f1f1f3' : 'none' }}>
              <span style={{ flexShrink: 0, fontSize: 9.5, fontWeight: 700, fontFamily: '"JetBrains Mono", monospace', background: '#eef2ff', color: '#4f46e5', padding: '2px 7px', borderRadius: 4 }}>
                {TIPO_EVID.find(t => t.value === e.tipo)?.label ?? e.tipo}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: '#18181b' }}>{e.titulo}</div>
                <div style={{ fontSize: 11, color: '#71717a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {e.medio === 'ENLACE' ? e.enlace : e.file?.name}
                </div>
              </div>
              <button onClick={() => quitar(i)} aria-label="Quitar" style={{ flexShrink: 0, width: 26, height: 26, display: 'grid', placeItems: 'center', border: 'none', borderRadius: 6, background: '#f1f1f3', color: '#b91c1c', cursor: 'pointer' }}>
                <Ic n="trash" s={13}/>
              </button>
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}

// ─── Resumen lateral ─────────────────────────────────────────────────────────────

function WizSummary({ st, step, curriculo, selRas }: {
  st: WizState; step: number; curriculo: CurriculoAsignacion | null; selRas: number[]
}) {
  const rows: [string, React.ReactNode][] = [
    ['Fecha', <span style={{ fontFamily: '"JetBrains Mono", monospace' }}>{fd(st.fecha)}</span>],
    ['Horas', <span style={{ fontFamily: '"JetBrains Mono", monospace' }}>{st.horas.toFixed(1)} h</span>],
    ['Tipo', <span style={{ textTransform: 'capitalize' }}>{st.tipo.toLowerCase()}</span>],
  ]
  const elemRows: [string, number, number][] = [
    ['RA seleccionados', selRas.length, 1],
    ['Conocimientos', st.conocimientos.size, 2],
    ['Criterios', st.criterios.size, 3],
    ['Materiales', st.materiales.length, 4],
    ['Evidencias', st.evidencias.length, 5],
  ]

  return (
    <Card style={{ padding: 20, position: 'sticky', top: 80 }}>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#71717a', fontWeight: 600, marginBottom: 8 }}>Resumen</div>
      {curriculo ? (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 4, alignItems: 'center' }}>
            <Tag>{curriculo.asignacion.programa_codigo}</Tag>
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 13, fontWeight: 600, color: '#0a0a0b' }}># {curriculo.asignacion.numero_ficha}</span>
          </div>
          <div style={{ fontSize: 12, color: '#3f3f46', marginBottom: 16 }}>{curriculo.asignacion.competencia_nombre}</div>
        </>
      ) : (
        <div style={{ fontSize: 12, color: '#71717a', marginBottom: 16 }}>Selecciona una asignación.</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12 }}>
        {rows.map(([l, v]) => (
          <div key={l} style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#52525b' }}>{l}</span><span style={{ color: '#18181b' }}>{v}</span>
          </div>
        ))}
        <div style={{ height: 1, background: '#f1f1f3', margin: '4px 0' }}/>
        {elemRows.map(([l, v, minS]) => (
          <div key={l} style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: step >= minS ? '#3f3f46' : '#71717a' }}>{l}</span>
            <span style={{ color: step >= minS ? '#0a0a0b' : '#71717a', fontWeight: step >= minS ? 600 : 400, fontFamily: '"JetBrains Mono", monospace' }}>{step >= minS ? v : '—'}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

// ─── Field (label + control) ─────────────────────────────────────────────────────

function Field({ label, hint, required, children, style }: {
  label: string; hint?: string; required?: boolean; children: React.ReactNode; style?: React.CSSProperties
}) {
  return (
    <div style={style}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: '#27272a' }}>{label}{required && <span style={{ color: '#b91c1c' }}> *</span>}</span>
        {hint && <span style={{ fontSize: 11, color: '#71717a' }}>{hint}</span>}
      </div>
      {children}
    </div>
  )
}
