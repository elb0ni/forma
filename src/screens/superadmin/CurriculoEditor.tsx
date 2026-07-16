import { useState, useEffect } from 'react'
import axios from 'axios'
import { Ic, Card, Btn, Bdg } from '../../components/ui'
import api from '../../lib/api'
import type { ProgramaDetalle, CompetenciaResumen } from '../../types'

type RA  = NonNullable<CompetenciaResumen['resultados_aprendizaje']>[number]
type Con = NonNullable<CompetenciaResumen['conocimientos']>[number]
type Cri = NonNullable<CompetenciaResumen['criterios']>[number]

// ─── Reglas de validación del diseño curricular ─────────────────────────────────

type Problema = { sev: 'error' | 'warn'; comp: string; ra?: string; msg: string }

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

// Reglas: (1) competencia con ≥1 RA · (2) RA con ≥1 criterio · (3) RA con ≥1
// conocimiento · (4) sin criterios/conocimientos huérfanos (ra_id null) ·
// (5) sin duplicados dentro del mismo RA.
function validar(comps: CompetenciaResumen[]): Problema[] {
  const out: Problema[] = []
  for (const c of comps) {
    const ras = c.resultados_aprendizaje ?? []
    const con = c.conocimientos ?? []
    const cri = c.criterios ?? []

    if (ras.length === 0) {
      out.push({ sev: 'error', comp: c.nombre, msg: 'La competencia no tiene resultados de aprendizaje.' })
    }
    for (const ra of ras) {
      const cris = cri.filter(x => x.ra_id === ra.id)
      const cons = con.filter(x => x.ra_id === ra.id)
      if (cris.length === 0) out.push({ sev: 'error', comp: c.nombre, ra: ra.numero, msg: 'RA sin criterio de evaluación.' })
      if (cons.length === 0) out.push({ sev: 'warn', comp: c.nombre, ra: ra.numero, msg: 'RA sin conocimientos.' })
      // duplicados dentro del mismo RA
      const dCri = new Set<string>(), dupCri = cris.some(x => { const k = norm(x.descripcion); if (dCri.has(k)) return true; dCri.add(k); return false })
      const dCon = new Set<string>(), dupCon = cons.some(x => { const k = norm(x.descripcion); if (dCon.has(k)) return true; dCon.add(k); return false })
      if (dupCri) out.push({ sev: 'warn', comp: c.nombre, ra: ra.numero, msg: 'Criterios duplicados en el mismo RA.' })
      if (dupCon) out.push({ sev: 'warn', comp: c.nombre, ra: ra.numero, msg: 'Conocimientos duplicados en el mismo RA.' })
    }
    const critHuerf = cri.filter(x => x.ra_id == null).length
    const conHuerf  = con.filter(x => x.ra_id == null).length
    if (critHuerf) out.push({ sev: 'error', comp: c.nombre, msg: `${critHuerf} criterio(s) sin RA asignado.` })
    if (conHuerf)  out.push({ sev: 'error', comp: c.nombre, msg: `${conHuerf} conocimiento(s) sin RA asignado.` })
  }
  return out
}

// ─── Formulario inline (uno activo a la vez) ─────────────────────────────────────

type FormState =
  | { t: 'add-cri'; competenciaId: number; raId: number }
  | { t: 'add-con'; competenciaId: number; raId: number; tipo: 'PROCESO' | 'SABER' }
  | { t: 'add-ra';  competenciaId: number }
  | { t: 'edit';    kind: 'cri' | 'con'; id: number }
  | { t: 'edit-ra'; id: number }
  | null

// ─── Editor ──────────────────────────────────────────────────────────────────────

export function CurriculoEditor({ programaId, onBack }: { programaId: number; onBack: () => void }) {
  "use no memo"
  const [data, setData]   = useState<ProgramaDetalle | null>(null)
  const [loadErr, setLoadErr] = useState(false)
  const [busy, setBusy]   = useState(false)
  const [err, setErr]     = useState<string | null>(null)
  const [form, setForm]   = useState<FormState>(null)
  const [text, setText]   = useState('')
  const [num, setNum]     = useState('')

  async function load() {
    try {
      const r = await api.get<ProgramaDetalle>(`/programas/${programaId}`)
      setData(r.data)
    } catch { setLoadErr(true) }
  }
  useEffect(() => { void load() }, [programaId])

  // Ejecuta una mutación, recarga el árbol y devuelve si tuvo éxito.
  async function run(fn: () => Promise<unknown>): Promise<boolean> {
    setBusy(true); setErr(null)
    try { await fn(); await load(); return true }
    catch (e) {
      const m = axios.isAxiosError(e) ? (e.response?.data?.message ?? e.message) : 'No se pudo completar la acción.'
      setErr(Array.isArray(m) ? m.join(' · ') : String(m)); return false
    } finally { setBusy(false) }
  }

  function openAddCri(competenciaId: number, raId: number) { setText(''); setForm({ t: 'add-cri', competenciaId, raId }) }
  function openAddCon(competenciaId: number, raId: number, tipo: 'PROCESO' | 'SABER') { setText(''); setForm({ t: 'add-con', competenciaId, raId, tipo }) }
  function openAddRa(competenciaId: number) { setText(''); setNum(''); setForm({ t: 'add-ra', competenciaId }) }
  function openEdit(kind: 'cri' | 'con', id: number, desc: string) { setText(desc); setForm({ t: 'edit', kind, id }) }
  function openEditRa(ra: RA) { setText(ra.descripcion); setNum(ra.numero); setForm({ t: 'edit-ra', id: ra.id }) }

  async function submitForm() {
    if (!form) return
    const d = text.trim()
    let ok = false
    if (form.t === 'add-cri') {
      if (!d) return
      ok = await run(() => api.post('/criterios-evaluacion', { competencia_id: form.competenciaId, resultado_aprendizaje_id: form.raId, descripcion: d }))
    } else if (form.t === 'add-con') {
      if (!d) return
      ok = await run(() => api.post('/conocimientos', { competencia_id: form.competenciaId, resultado_aprendizaje_id: form.raId, tipo: form.tipo, descripcion: d }))
    } else if (form.t === 'add-ra') {
      if (!d || !num.trim()) return
      ok = await run(() => api.post('/resultados-aprendizaje', { competencia_id: form.competenciaId, numero: num.trim(), descripcion: d }))
    } else if (form.t === 'edit') {
      if (!d) return
      const url = form.kind === 'cri' ? `/criterios-evaluacion/${form.id}` : `/conocimientos/${form.id}`
      ok = await run(() => api.patch(url, { descripcion: d }))
    } else if (form.t === 'edit-ra') {
      if (!d || !num.trim()) return
      ok = await run(() => api.patch(`/resultados-aprendizaje/${form.id}`, { numero: num.trim(), descripcion: d }))
    }
    if (ok) setForm(null)
  }

  function reassign(kind: 'cri' | 'con', id: number, raId: number) {
    const url = kind === 'cri' ? `/criterios-evaluacion/${id}` : `/conocimientos/${id}`
    void run(() => api.patch(url, { resultado_aprendizaje_id: raId }))
  }
  function del(kind: 'cri' | 'con' | 'ra', id: number) {
    const label = kind === 'cri' ? 'este criterio' : kind === 'con' ? 'este conocimiento' : 'este RA y todo su contenido'
    if (!window.confirm(`¿Eliminar ${label}? Esta acción no se puede deshacer.`)) return
    const url = kind === 'cri' ? `/criterios-evaluacion/${id}` : kind === 'con' ? `/conocimientos/${id}` : `/resultados-aprendizaje/${id}`
    void run(() => api.delete(url))
  }

  const back = (
    <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#52525b', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 16 }}>
      <Ic n="arrowLeft" s={14}/> Volver al programa
    </button>
  )

  if (loadErr) return <div>{back}<Card style={{ padding: 24 }}><div style={{ fontSize: 13.5, color: '#b91c1c' }}>No se pudo cargar el diseño curricular.</div></Card></div>
  if (!data) return <div>{back}<Card style={{ padding: 40, textAlign: 'center', color: '#71717a', fontSize: 13 }}>Cargando…</Card></div>

  const comps = data.competencias
  const problemas = validar(comps)
  const errores = problemas.filter(p => p.sev === 'error')
  const avisos  = problemas.filter(p => p.sev === 'warn')

  return (
    <div style={{ maxWidth: 1000, paddingBottom: 48 }}>
      {back}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 8, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 600, color: '#0a0a0b' }}>Editar diseño curricular</h2>
          <div style={{ fontSize: 13, color: '#52525b', marginTop: 4 }}>{data.nombre} · <span style={{ fontFamily: '"JetBrains Mono", monospace' }}>{data.codigo}</span></div>
        </div>
      </div>

      {/* Panel de validación */}
      <Card style={{ padding: 16, marginBottom: 18, background: errores.length ? '#fef2f2' : avisos.length ? '#fffbeb' : '#f0fdf4', border: `1px solid ${errores.length ? '#fecaca' : avisos.length ? '#fde68a' : '#bbf7d0'}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: errores.length || avisos.length ? 10 : 0 }}>
          <Ic n={errores.length ? 'alert' : avisos.length ? 'alert' : 'checkCircle'} s={16} style={{ color: errores.length ? '#b91c1c' : avisos.length ? '#a16207' : '#15803d' }}/>
          <span style={{ fontSize: 13, fontWeight: 600, color: errores.length ? '#b91c1c' : avisos.length ? '#a16207' : '#15803d' }}>
            {errores.length ? `Diseño incompleto · ${errores.length} regla(s) sin cumplir` : avisos.length ? `Válido con ${avisos.length} aviso(s)` : 'Diseño válido — cumple todas las reglas'}
          </span>
        </div>
        {(errores.length > 0 || avisos.length > 0) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {[...errores, ...avisos].map((p, i) => (
              <div key={i} style={{ fontSize: 12, color: p.sev === 'error' ? '#991b1b' : '#854d0e', display: 'flex', gap: 8 }}>
                <span style={{ flexShrink: 0 }}>{p.sev === 'error' ? '●' : '○'}</span>
                <span><strong>{p.comp}</strong>{p.ra ? ` · ${p.ra}` : ''} — {p.msg}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {err && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 14px', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 8, marginBottom: 14 }}>
          <Ic n="alert" s={15} style={{ color: '#b91c1c', flexShrink: 0 }}/>
          <span style={{ fontSize: 12.5, color: '#b91c1c' }}>{err}</span>
        </div>
      )}

      {/* Competencias */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {comps.map(c => {
          const ras: RA[] = c.resultados_aprendizaje ?? []
          const con: Con[] = c.conocimientos ?? []
          const cri: Cri[] = c.criterios ?? []
          const critHuerf = cri.filter(x => x.ra_id == null)
          const conHuerf  = con.filter(x => x.ra_id == null)

          return (
            <Card key={c.id} style={{ padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                <div>
                  <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5, color: '#71717a' }}>{c.codigo_norma}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#0a0a0b' }}>{c.nombre}</div>
                </div>
                <Btn size="sm" variant="ghost" icon="plus" onClick={() => openAddRa(c.id)} disabled={busy}>RA</Btn>
              </div>

              {/* Huérfanos: asignar a un RA */}
              {(critHuerf.length > 0 || conHuerf.length > 0) && (
                <div style={{ border: '1px dashed #fca5a5', background: '#fef2f2', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#b91c1c', marginBottom: 8 }}>
                    Sin RA asignado · {critHuerf.length + conHuerf.length}
                  </div>
                  {[...conHuerf.map(x => ({ k: 'con' as const, x })), ...critHuerf.map(x => ({ k: 'cri' as const, x }))].map(({ k, x }) => (
                    <div key={`${k}-${x.id}`} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '5px 0' }}>
                      <span style={{ flexShrink: 0, fontSize: 9.5, fontWeight: 700, fontFamily: '"JetBrains Mono", monospace', background: k === 'cri' ? '#f3e8ff' : '#e0f2fe', color: k === 'cri' ? '#7c3aed' : '#0891b2', padding: '1px 5px', borderRadius: 4 }}>
                        {k === 'cri' ? 'CE' : (x as Con).tipo === 'PROCESO' ? 'CP' : 'CS'}
                      </span>
                      <span style={{ flex: 1, fontSize: 12, color: '#3f3f46' }}>{x.descripcion}</span>
                      <select disabled={busy || ras.length === 0} defaultValue=""
                        onChange={e => e.target.value && reassign(k, x.id, Number(e.target.value))}
                        style={{ fontSize: 11.5, padding: '3px 6px', border: '1px solid #e4e4e7', borderRadius: 4, fontFamily: 'inherit' }}>
                        <option value="">{ras.length === 0 ? 'Crea un RA primero' : 'Asignar a RA…'}</option>
                        {ras.map((r, i) => <option key={r.id} value={r.id}>RA{i + 1} · {r.numero}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              )}

              {/* RAs */}
              {ras.length === 0 ? (
                <div style={{ fontSize: 12.5, color: '#a1a1aa', padding: '8px 0' }}>Esta competencia no tiene RAs. Agrega al menos uno.</div>
              ) : ras.map((ra, i) => {
                const raCri = cri.filter(x => x.ra_id === ra.id)
                const raProc = con.filter(x => x.ra_id === ra.id && x.tipo === 'PROCESO')
                const raSaber = con.filter(x => x.ra_id === ra.id && x.tipo === 'SABER')
                const isEditRa = form?.t === 'edit-ra' && form.id === ra.id
                return (
                  <div key={ra.id} style={{ border: '1px solid #ececef', borderRadius: 10, padding: 12, marginBottom: 10 }}>
                    {isEditRa ? (
                      <FormRow text={text} setText={setText} num={num} setNum={setNum} withNum onSave={submitForm} onCancel={() => setForm(null)} busy={busy} placeholder="Descripción del RA"/>
                    ) : (
                      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 8 }}>
                        <span style={{ flexShrink: 0, width: 30, height: 22, borderRadius: 6, background: '#eef2ff', color: '#4f46e5', display: 'grid', placeItems: 'center', fontSize: 10.5, fontWeight: 700, fontFamily: '"JetBrains Mono", monospace' }}>RA{i + 1}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 10, color: '#a1a1aa', fontFamily: '"JetBrains Mono", monospace' }}>{ra.numero}</div>
                          <div style={{ fontSize: 12.5, color: '#18181b', lineHeight: 1.4 }}>{ra.descripcion}</div>
                          <div style={{ display: 'flex', gap: 6, marginTop: 5 }}>
                            {raCri.length === 0 && <Bdg tone="err">Sin criterio</Bdg>}
                            {raProc.length + raSaber.length === 0 && <Bdg tone="warn">Sin conocimientos</Bdg>}
                          </div>
                        </div>
                        <button onClick={() => openEditRa(ra)} title="Editar RA" disabled={busy} style={iconBtn}><Ic n="edit" s={13}/></button>
                        <button onClick={() => del('ra', ra.id)} title="Eliminar RA" disabled={busy} style={iconBtn}><Ic n="trash" s={13}/></button>
                      </div>
                    )}

                    <div style={{ paddingLeft: 40, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <ItemGroup
                        title="Criterios de evaluación" tone="cri" items={raCri} text={text} setText={setText} busy={busy}
                        onAdd={() => openAddCri(c.id, ra.id)} onEdit={x => openEdit('cri', x.id, x.descripcion)} onDelete={x => del('cri', x.id)}
                        onSave={submitForm} onCancel={() => setForm(null)}
                        addActive={form?.t === 'add-cri' && form.raId === ra.id}
                        editId={form?.t === 'edit' && form.kind === 'cri' ? form.id : null}
                      />
                      <ItemGroup
                        title="Conocimientos de proceso" tone="con" items={raProc} text={text} setText={setText} busy={busy}
                        onAdd={() => openAddCon(c.id, ra.id, 'PROCESO')} onEdit={x => openEdit('con', x.id, x.descripcion)} onDelete={x => del('con', x.id)}
                        onSave={submitForm} onCancel={() => setForm(null)}
                        addActive={form?.t === 'add-con' && form.raId === ra.id && form.tipo === 'PROCESO'}
                        editId={form?.t === 'edit' && form.kind === 'con' ? form.id : null}
                      />
                      <ItemGroup
                        title="Conocimientos del saber" tone="con" items={raSaber} text={text} setText={setText} busy={busy}
                        onAdd={() => openAddCon(c.id, ra.id, 'SABER')} onEdit={x => openEdit('con', x.id, x.descripcion)} onDelete={x => del('con', x.id)}
                        onSave={submitForm} onCancel={() => setForm(null)}
                        addActive={form?.t === 'add-con' && form.raId === ra.id && form.tipo === 'SABER'}
                        editId={form?.t === 'edit' && form.kind === 'con' ? form.id : null}
                      />
                    </div>
                  </div>
                )
              })}

              {form?.t === 'add-ra' && form.competenciaId === c.id && (
                <div style={{ border: '1px solid #c7d2fe', borderRadius: 10, padding: 12, marginTop: 4 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#4f46e5', marginBottom: 6 }}>Nuevo resultado de aprendizaje</div>
                  <FormRow text={text} setText={setText} num={num} setNum={setNum} withNum onSave={submitForm} onCancel={() => setForm(null)} busy={busy} placeholder="Descripción del RA"/>
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}

// ─── Subcomponentes ──────────────────────────────────────────────────────────────

const iconBtn: React.CSSProperties = { width: 26, height: 26, borderRadius: 6, background: 'none', border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center', color: '#71717a', flexShrink: 0 }

function ItemGroup({ title, tone, items, busy, onAdd, onEdit, onDelete, addActive, editId, text, setText, onSave, onCancel }: {
  title: string; tone: 'cri' | 'con'; items: (Cri | Con)[]; busy: boolean
  onAdd: () => void; onEdit: (x: Cri | Con) => void; onDelete: (x: Cri | Con) => void
  addActive: boolean; editId: number | null
  text: string; setText: (v: string) => void; onSave: () => void; onCancel: () => void
}) {
  const palette = tone === 'cri' ? { bg: '#f3e8ff', fg: '#7c3aed', lbl: 'CE' } : { bg: '#e0f2fe', fg: '#0891b2', lbl: '' }
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
        <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: palette.fg }}>{title} · {items.length}</span>
        <button onClick={onAdd} disabled={busy} style={{ ...iconBtn, width: 'auto', padding: '2px 8px', gap: 4, display: 'flex', alignItems: 'center', fontSize: 11, color: '#4f46e5', fontFamily: 'inherit' }}>
          <Ic n="plus" s={11}/> Agregar
        </button>
      </div>
      {items.length === 0 && !addActive && <div style={{ fontSize: 11.5, color: '#a1a1aa', padding: '2px 0' }}>Ninguno.</div>}
      {items.map(x => (
        editId === x.id ? (
          <FormRow key={x.id} text={text} setText={setText} onSave={onSave} onCancel={onCancel} busy={busy} placeholder="Descripción"/>
        ) : (
          <div key={x.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '4px 0' }}>
            <span style={{ flexShrink: 0, fontSize: 9, fontWeight: 700, fontFamily: '"JetBrains Mono", monospace', background: palette.bg, color: palette.fg, padding: '1px 4px', borderRadius: 4, marginTop: 1 }}>
              {tone === 'cri' ? 'CE' : (x as Con).tipo === 'PROCESO' ? 'CP' : 'CS'}
            </span>
            <span style={{ flex: 1, fontSize: 12, color: '#3f3f46', lineHeight: 1.4 }}>{x.descripcion}</span>
            <button onClick={() => onEdit(x)} title="Editar" disabled={busy} style={iconBtn}><Ic n="edit" s={12}/></button>
            <button onClick={() => onDelete(x)} title="Eliminar" disabled={busy} style={iconBtn}><Ic n="trash" s={12}/></button>
          </div>
        )
      ))}
      {addActive && <FormRow text={text} setText={setText} onSave={onSave} onCancel={onCancel} busy={busy} placeholder="Escribe la descripción…"/>}
    </div>
  )
}

function FormRow({ text, setText, num, setNum, withNum, onSave, onCancel, busy, placeholder }: {
  text: string; setText: (v: string) => void; num?: string; setNum?: (v: string) => void
  withNum?: boolean; onSave: () => void; onCancel: () => void; busy: boolean; placeholder: string
}) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', padding: '6px 0' }}>
      {withNum && (
        <input value={num ?? ''} onChange={e => setNum?.(e.target.value)} placeholder="N.º"
          style={{ width: 70, padding: '6px 8px', border: '1px solid #c7d2fe', borderRadius: 6, fontSize: 12, fontFamily: '"JetBrains Mono", monospace' }}/>
      )}
      <textarea value={text} onChange={e => setText(e.target.value)} placeholder={placeholder} rows={2} autoFocus
        style={{ flex: 1, padding: '6px 8px', border: '1px solid #c7d2fe', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', resize: 'vertical' }}/>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Btn size="sm" variant="accent" icon="check" onClick={onSave} disabled={busy}>Guardar</Btn>
        <Btn size="sm" variant="ghost" onClick={onCancel} disabled={busy}>Cancelar</Btn>
      </div>
    </div>
  )
}
