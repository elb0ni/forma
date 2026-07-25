import { useState, useEffect } from 'react'
import { Ic, Card, Btn, Tag, Bdg } from '../../components/ui'
import api from '../../lib/api'
import { InlineAlert, fd, LoadingBlock, CenterState } from '../shared/parts'
import { exportarGuia } from '../shared/guia'
import type { SesionListItem, SesionDetalle, Evidencia } from './types'
import './instructor.css'

// ─── Lista de sesiones ───────────────────────────────────────────────────────────

type EstadoFilt = 'TODAS' | 'REGISTRADA' | 'VALIDADA' | 'ANULADA'

const CHIPS: { key: EstadoFilt; label: string }[] = [
  { key: 'TODAS', label: 'Todas' },
  { key: 'REGISTRADA', label: 'Registradas' },
  { key: 'VALIDADA', label: 'Validadas' },
  { key: 'ANULADA', label: 'Anuladas' },
]

const TIPO_LABEL: Record<string, string> = { PRESENCIAL: 'Presencial', VIRTUAL: 'Virtual', MIXTA: 'Mixta' }

const MAT_TIPO: Record<string, { label: string; bg: string; fg: string }> = {
  DEVOLUTIVO: { label: 'Devolutivo',    bg: '#dbeafe', fg: '#1d4ed8' },
  CONSUMO:    { label: 'De consumo',    bg: '#fef9c3', fg: '#a16207' },
  DIDACTICO:  { label: 'Didáctico',     bg: '#f3e8ff', fg: '#7c3aed' },
  AMBIENTE:   { label: 'Ambiente',      bg: '#dcfce7', fg: '#15803d' },
}

export function InstSesionesList({ onOpen, onNueva }: {
  onOpen: (id: number) => void; onNueva: () => void
}) {
  "use no memo"
  const [sesiones, setSesiones] = useState<SesionListItem[] | null>(null)
  const [error, setError] = useState(false)
  const [filt, setFilt] = useState<EstadoFilt>('TODAS')
  const [q, setQ] = useState('')

  useEffect(() => {
    api.get<SesionListItem[]>('/dashboard/instructor/sesiones')
      .then(r => setSesiones(r.data))
      .catch(() => setError(true))
  }, [])

  if (error) return <Card style={{ padding: 24 }}><CenterState icon="alert" title="No se pudieron cargar tus sesiones" sub="Verifica la conexión con el servidor."/></Card>
  if (!sesiones) return <LoadingBlock/>

  const counts: Record<EstadoFilt, number> = {
    TODAS: sesiones.length,
    REGISTRADA: sesiones.filter(s => s.estado_sesion === 'REGISTRADA').length,
    VALIDADA: sesiones.filter(s => s.estado_sesion === 'VALIDADA').length,
    ANULADA: sesiones.filter(s => s.estado_sesion === 'ANULADA').length,
  }
  const ql = q.trim().toLowerCase()
  const view = sesiones.filter(s => {
    if (filt !== 'TODAS' && s.estado_sesion !== filt) return false
    if (ql && !s.numero_ficha.toLowerCase().includes(ql) && !s.competencia_nombre.toLowerCase().includes(ql)) return false
    return true
  })

  const totalHoras = view.reduce((a, s) => a + s.horas_ejecutadas, 0)

  return (
    <div style={{ maxWidth: 1200 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 4, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13.5, color: '#52525b' }}>
          {view.length} sesion{view.length === 1 ? '' : 'es'} · <strong style={{ color: '#18181b', fontFamily: '"JetBrains Mono", monospace' }}>{totalHoras.toFixed(1)}</strong> horas
        </div>
        <Btn variant="accent" icon="plus" onClick={onNueva}>Registrar sesión</Btn>
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
          <input className="inst-search__input" placeholder="Buscar ficha o competencia…" value={q} onChange={e => setQ(e.target.value)}/>
        </div>
      </div>

      {view.length === 0 ? (
        <Card><CenterState icon="list" title="Sin sesiones" sub="No hay sesiones que coincidan con el filtro. Registra una nueva para empezar."/></Card>
      ) : (
        <Card style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e4e4e7', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#52525b' }}>
                {['Fecha', 'Ficha', 'Competencia', 'Horas', 'Tipo', 'Cobertura', 'Estado'].map(h => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: h === 'Horas' ? 'right' : 'left', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {view.map(s => (
                <tr key={s.id} className="inst-row" style={{ borderBottom: '1px solid #f1f1f3', cursor: 'pointer' }} onClick={() => onOpen(s.id)}>
                  <td style={{ padding: '12px 14px', fontFamily: '"JetBrains Mono", monospace', fontSize: 12, color: '#3f3f46', whiteSpace: 'nowrap' }}>{fd(s.fecha)}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <Tag>{s.programa_codigo}</Tag>
                      <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12, fontWeight: 600, color: '#0a0a0b' }}>{s.numero_ficha}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px', maxWidth: 280 }}>
                    <div style={{ fontSize: 12.5, color: '#18181b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.competencia_nombre}</div>
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: '"JetBrains Mono", monospace', fontSize: 13, color: '#18181b' }}>{s.horas_ejecutadas.toFixed(1)}</td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: '#52525b' }}>{TIPO_LABEL[s.tipo_sesion] ?? s.tipo_sesion}</td>
                  <td style={{ padding: '12px 14px', fontFamily: '"JetBrains Mono", monospace', fontSize: 11.5, color: '#52525b' }}>{s.ras} RA · {s.conocimientos} con · {s.criterios} crit.</td>
                  <td style={{ padding: '12px 14px' }}>
                    <Bdg tone={s.estado_sesion === 'VALIDADA' ? 'accent' : s.estado_sesion === 'ANULADA' ? 'err' : 'neutral'}>{s.estado_sesion}</Bdg>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}

// ─── Detalle de sesión (basado en forma.html S10) ────────────────────────────────

export function InstSesionDetalle({ sesionId, justSaved, onBack }: {
  sesionId: number; justSaved?: boolean; onBack: () => void
}) {
  "use no memo"
  const [s, setS] = useState<SesionDetalle | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setS(null); setError(null)
    api.get<SesionDetalle>(`/dashboard/instructor/sesiones/${sesionId}`)
      .then(r => setS(r.data))
      .catch(e => setError(e?.response?.data?.message ?? 'No se pudo cargar la sesión'))
  }, [sesionId])

  const back = (
    <button onClick={onBack} style={{ fontSize: 12.5, color: '#52525b', display: 'flex', gap: 6, background: 'none', border: 'none', cursor: 'pointer', marginBottom: 16, alignItems: 'center', fontFamily: 'inherit' }}>
      <Ic n="arrowLeft" s={14}/>Volver
    </button>
  )

  if (error) return <div style={{ maxWidth: 960 }}>{back}<Card style={{ padding: 24 }}><CenterState icon="alert" title="Sesión no disponible" sub={error}/></Card></div>
  if (!s) return <div style={{ maxWidth: 960 }}>{back}<LoadingBlock/></div>

  const kpis: [string, string, any][] = [
    ['Fecha', fd(s.fecha), 'calendar'],
    ['Horas', `${s.horas_ejecutadas.toFixed(1)} h`, 'clock'],
    ['Tipo', (TIPO_LABEL[s.tipo_sesion] ?? s.tipo_sesion), 'layers'],
    ['Sede', s.sede ?? '—', 'pin'],
  ]

  return (
    <div style={{ maxWidth: 960 }}>
      {back}
      {justSaved && (
        <InlineAlert tone="ok" icon="checkCircle" title="Sesión registrada correctamente" style={{ marginBottom: 20 }}>
          La sesión quedó registrada con sus evidencias y el avance de la ficha ya se actualizó.
          Descarga la guía de aprendizaje para el soporte firmado.
        </InlineAlert>
      )}

      <div style={{ display: 'flex', gap: 24, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <div style={{ display: 'flex', gap: 8, fontSize: 12, color: '#52525b', marginBottom: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <Tag>{s.programa_codigo}</Tag>
            <span style={{ fontFamily: '"JetBrains Mono", monospace' }}>Ficha {s.numero_ficha}</span>
            <span style={{ color: '#a1a1aa' }}>·</span>
            <span>{fd(s.fecha)}</span>
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: '#0a0a0b', lineHeight: 1.3 }}>{s.competencia_nombre}</h2>
          <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
            <Bdg tone={s.estado_sesion === 'VALIDADA' ? 'accent' : s.estado_sesion === 'ANULADA' ? 'err' : 'neutral'}>{s.estado_sesion}</Bdg>
            <span style={{ fontSize: 12, color: '#52525b' }}>por {s.instructor_nombre}</span>
          </div>
        </div>
        <div style={{ alignSelf: 'flex-start' }}>
          <Btn variant="accent" icon="download" onClick={() => exportarGuia(s)}>Guía de aprendizaje</Btn>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
        {kpis.map(([l, v, ic]) => (
          <Card key={l} style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#71717a', fontWeight: 600 }}>{l}</div>
              <Ic n={ic} s={13} style={{ color: '#a1a1aa' }}/>
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#0a0a0b', marginTop: 8, fontFamily: l === 'Fecha' || l === 'Horas' ? '"JetBrains Mono", monospace' : 'inherit' }}>{v}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <Card style={{ padding: 16 }}>
          <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#52525b', fontWeight: 600, marginBottom: 12 }}>
            Resultados de aprendizaje · {s.resultados_aprendizaje.length}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {s.resultados_aprendizaje.length === 0 && <div style={{ fontSize: 12, color: '#71717a' }}>Ninguno</div>}
            {s.resultados_aprendizaje.map((ra, i) => (
              <div key={ra.id} style={{ display: 'flex', gap: 10 }}>
                <Tag>RA{i + 1}</Tag>
                <div style={{ fontSize: 12.5, color: '#18181b' }}>{ra.descripcion}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card style={{ padding: 16 }}>
          <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#52525b', fontWeight: 600, marginBottom: 12 }}>
            Conocimientos · {s.conocimientos.length}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {s.conocimientos.length === 0 && <div style={{ fontSize: 12, color: '#71717a' }}>Ninguno</div>}
            {s.conocimientos.map(c => (
              <div key={c.id} style={{ display: 'flex', gap: 8 }}>
                <Ic n="check" s={13} style={{ color: '#15803d', flexShrink: 0, marginTop: 2 }}/>
                <div style={{ fontSize: 12.5, color: '#18181b' }}>{c.descripcion}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card style={{ padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#52525b', fontWeight: 600, marginBottom: 12 }}>
          Criterios confirmados · {s.criterios.length}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {s.criterios.length === 0 && <div style={{ fontSize: 12, color: '#71717a' }}>Ninguno</div>}
          {s.criterios.map(c => (
            <div key={c.id} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Ic n="checkCircle" s={14} style={{ color: '#15803d', flexShrink: 0 }}/>
              <div style={{ flex: 1, fontSize: 12.5, color: '#18181b' }}>{c.descripcion}</div>
            </div>
          ))}
        </div>
      </Card>

      {s.materiales && s.materiales.length > 0 && (
        <Card style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#52525b', fontWeight: 600, marginBottom: 12 }}>
            Materiales de formación · {s.materiales.length}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {s.materiales.map(m => {
              const t = MAT_TIPO[m.tipo] ?? { label: m.tipo, bg: '#f1f1f3', fg: '#52525b' }
              return (
                <div key={m.id ?? m.nombre} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ flexShrink: 0, fontSize: 9.5, fontWeight: 700, fontFamily: '"JetBrains Mono", monospace', background: t.bg, color: t.fg, padding: '2px 7px', borderRadius: 4 }}>{t.label}</span>
                  <span style={{ flex: 1, fontSize: 12.5, color: '#18181b' }}>{m.nombre}</span>
                  {(m.cantidad != null || m.unidad) && (
                    <span style={{ fontSize: 12, color: '#52525b', fontFamily: '"JetBrains Mono", monospace' }}>{m.cantidad ?? ''} {m.unidad ?? ''}</span>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {s.observaciones && (
        <Card style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#52525b', fontWeight: 600, marginBottom: 8 }}>Observaciones</div>
          <div style={{ fontSize: 12.5, color: '#27272a', lineHeight: 1.6 }}>{s.observaciones}</div>
        </Card>
      )}

      <EvidenciasSection sesionId={s.id} validada={s.estado_sesion === 'VALIDADA'}/>
    </div>
  )
}

// ─── Evidencias de la sesión ─────────────────────────────────────────────────────

const TIPO_EVID: Record<string, string> = { CONOCIMIENTO: 'Conocimiento', DESEMPENO: 'Desempeño', PRODUCTO: 'Producto' }

function EvidenciasSection({ sesionId, validada }: { sesionId: number; validada: boolean }) {
  "use no memo"
  const [items, setItems]   = useState<Evidencia[] | null>(null)
  const [open, setOpen]     = useState(false)
  const [tipo, setTipo]     = useState<'CONOCIMIENTO' | 'DESEMPENO' | 'PRODUCTO'>('PRODUCTO')
  const [medio, setMedio]   = useState<'ENLACE' | 'ARCHIVO'>('ARCHIVO')
  const [titulo, setTitulo] = useState('')
  const [desc, setDesc]     = useState('')
  const [enlace, setEnlace] = useState('')
  const [file, setFile]     = useState<File | null>(null)
  const [busy, setBusy]     = useState(false)
  const [err, setErr]       = useState<string | null>(null)

  function load() {
    api.get<Evidencia[]>(`/evidencias?sesion_id=${sesionId}`).then(r => setItems(r.data)).catch(() => setItems([]))
  }
  useEffect(() => { load() }, [sesionId])

  function reset() { setTitulo(''); setDesc(''); setEnlace(''); setFile(null); setOpen(false); setErr(null) }

  async function submit() {
    if (!titulo.trim()) { setErr('Ponle un título a la evidencia.'); return }
    if (medio === 'ENLACE' && !/^https?:\/\//i.test(enlace.trim())) { setErr('El enlace debe empezar con http:// o https://'); return }
    if (medio === 'ARCHIVO' && !file) { setErr('Selecciona un archivo.'); return }
    setBusy(true); setErr(null)
    try {
      if (medio === 'ARCHIVO') {
        const fd = new FormData()
        fd.append('sesion_id', String(sesionId))
        fd.append('medio', 'ARCHIVO')
        fd.append('tipo_evidencia', tipo)
        fd.append('titulo', titulo.trim())
        if (desc.trim()) fd.append('descripcion', desc.trim())
        fd.append('archivo', file as File)
        await api.post('/evidencias', fd)
      } else {
        await api.post('/evidencias', {
          sesion_id: sesionId, medio: 'ENLACE', tipo_evidencia: tipo,
          titulo: titulo.trim(), descripcion: desc.trim() || undefined, enlace_url: enlace.trim(),
        })
      }
      reset(); load()
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? 'No se pudo guardar la evidencia.')
    } finally { setBusy(false) }
  }

  async function descargar(ev: Evidencia) {
    try {
      const r = await api.get(`/evidencias/${ev.id}/archivo`, { responseType: 'blob' })
      const url = URL.createObjectURL(r.data as Blob)
      const a = document.createElement('a')
      a.href = url; a.download = ev.nombre_archivo ?? 'evidencia'
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
    } catch { setErr('No se pudo descargar el archivo.') }
  }

  async function eliminar(ev: Evidencia) {
    if (!window.confirm(`¿Eliminar la evidencia "${ev.titulo}"?`)) return
    try { await api.delete(`/evidencias/${ev.id}`); load() }
    catch (e: any) { setErr(e?.response?.data?.message ?? 'No se pudo eliminar.') }
  }

  const n = items?.length ?? 0

  return (
    <Card style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: n > 0 || open ? 12 : 0 }}>
        <div>
          <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#52525b', fontWeight: 600 }}>
            Evidencias · {n}
          </div>
          {n === 0 && !open && (
            <div style={{ fontSize: 12, color: '#71717a', marginTop: 4 }}>
              Adjunta enlaces o archivos que respalden la sesión. No se revisan: quedan como soporte.
            </div>
          )}
        </div>
        {!open && <Btn variant="accent" size="sm" icon="plus" onClick={() => setOpen(true)}>Agregar evidencia</Btn>}
      </div>

      {items && items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: open ? 14 : 0 }}>
          {items.map(ev => (
            <div key={ev.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', border: '1px solid #e4e4e7', borderRadius: 8 }}>
              <span style={{ flexShrink: 0, fontSize: 9.5, fontWeight: 700, fontFamily: '"JetBrains Mono", monospace', background: '#eef2ff', color: '#4f46e5', padding: '2px 6px', borderRadius: 4, marginTop: 1 }}>
                {TIPO_EVID[ev.tipo_evidencia] ?? ev.tipo_evidencia}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: '#18181b', fontWeight: 500 }}>{ev.titulo}</div>
                {ev.descripcion && <div style={{ fontSize: 12, color: '#52525b', marginTop: 2 }}>{ev.descripcion}</div>}
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 6 }}>
                  {ev.medio === 'ENLACE'
                    ? <a href={ev.enlace_url ?? '#'} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: '#4f46e5', display: 'flex', alignItems: 'center', gap: 4 }}><Ic n="external" s={12}/>Abrir enlace</a>
                    : <button onClick={() => descargar(ev)} style={{ fontSize: 11.5, color: '#4f46e5', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit', padding: 0 }}><Ic n="download" s={12}/>{ev.nombre_archivo ?? 'Descargar'}</button>}
                  {!validada && (
                    <button onClick={() => eliminar(ev)} style={{ fontSize: 11.5, color: '#b91c1c', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>Eliminar</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div style={{ border: '1px solid #c7d2fe', borderRadius: 8, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <label style={{ fontSize: 12, color: '#27272a' }}>
              Tipo
              <select value={tipo} onChange={e => setTipo(e.target.value as any)} className="nx-input" style={{ marginTop: 4, minWidth: 150 }}>
                <option value="CONOCIMIENTO">Conocimiento</option>
                <option value="DESEMPENO">Desempeño</option>
                <option value="PRODUCTO">Producto</option>
              </select>
            </label>
            <label style={{ fontSize: 12, color: '#27272a' }}>
              Medio
              <select value={medio} onChange={e => setMedio(e.target.value as any)} className="nx-input" style={{ marginTop: 4, minWidth: 130 }}>
                <option value="ARCHIVO">Archivo</option>
                <option value="ENLACE">Enlace</option>
              </select>
            </label>
          </div>
          <input className="nx-input" placeholder="Título de la evidencia" value={titulo} onChange={e => setTitulo(e.target.value)}/>
          <textarea className="nx-input" style={{ resize: 'vertical' }} rows={2} placeholder="Descripción (opcional)" value={desc} onChange={e => setDesc(e.target.value)}/>
          {medio === 'ENLACE'
            ? <input className="nx-input" placeholder="https://… (Drive, repositorio, video)" value={enlace} onChange={e => setEnlace(e.target.value)}/>
            : <input type="file" onChange={e => setFile(e.target.files?.[0] ?? null)} style={{ fontSize: 12.5 }}/>}
          {medio === 'ARCHIVO' && <div style={{ fontSize: 11, color: '#71717a' }}>Máx. 20 MB · PDF, imágenes, Office o ZIP.</div>}
          {err && <div style={{ fontSize: 12, color: '#b91c1c' }}>{err}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Btn variant="ghost" size="sm" onClick={reset} disabled={busy}>Cancelar</Btn>
            <Btn variant="accent" size="sm" icon="check" onClick={submit} disabled={busy}>{busy ? 'Guardando…' : 'Guardar evidencia'}</Btn>
          </div>
        </div>
      )}

      {err && !open && <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 8 }}>{err}</div>}
    </Card>
  )
}
