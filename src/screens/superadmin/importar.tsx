import { useState, useEffect, useRef, useCallback } from 'react'
import axios from 'axios'
import { Ic, Btn, Bdg, Card } from '../../components/ui'
import type { Programa, Competencia, Conocimiento, Criterio, RA } from '../../types'
import api from '../../lib/api'
import './importar.css'

const API_PYTHON = import.meta.env.VITE_API_PYTHON as string

const STEPS = [
  'Leyendo documento PDF',
  'Detectando formato curricular',
  'Extrayendo encabezado del programa',
  'Identificando bloques de competencia',
  'Extrayendo resultados de aprendizaje (RAs)',
  'Extrayendo conocimientos CP y CS',
  'Extrayendo criterios de evaluación (CE)',
  'Generando alertas de validación',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mkConoc = (tipo: 'PROCESO' | 'SABER', ra: string | null, orden: number): Conocimiento => ({
  descripcion: '', tipo, ra_numero: ra, requiere_revision_ra: false, confianza_nli: null, orden,
})
const mkCrit = (ra: string | null, orden: number): Criterio => ({ descripcion: '', ra_numero: ra, orden })

export async function saveProgramaToDB(prog: Programa): Promise<number> {
  try {
    const { data } = await api.post<{ id: number }>('/programas/importar', prog)
    return data.id
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const msg = err.response?.data?.message
      throw new Error(Array.isArray(msg) ? msg.join(', ') : (msg ?? err.message))
    }
    throw err
  }
}

// ─── AutoTxt ─────────────────────────────────────────────────────────────────

function AutoTxt({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const resize = () => {
    if (!ref.current) return
    ref.current.style.height = 'auto'
    ref.current.style.height = Math.max(30, ref.current.scrollHeight) + 'px'
  }
  useEffect(() => { resize() }, [value])
  return (
    <textarea ref={ref} value={value} rows={1} placeholder={placeholder}
      onChange={e => { onChange(e.target.value); resize() }}
      className="autotxt"
      onFocus={e  => { e.target.style.borderColor = '#a5b4fc' }}
      onBlur={e   => { e.target.style.borderColor = '#e4e4e7' }}
    />
  )
}

function AddBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="add-btn">
      <Ic n="plus" s={11}/>{label}
    </button>
  )
}

// ─── Upload Screen ────────────────────────────────────────────────────────────

export function UploadScreen({ onFile, error }: { onFile: (f: File) => void; error: string | null }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handle = useCallback((f: File | null | undefined) => {
    if (!f) return
    if (!f.name.toLowerCase().endsWith('.pdf')) { alert('Solo se aceptan archivos PDF'); return }
    onFile(f)
  }, [onFile])

  return (
    <div className="upload-screen">
      <div className="upload-screen__header">
        <h2 className="upload-screen__title">Cargar diseño curricular</h2>
        <p className="upload-screen__sub">
          Sube el PDF oficial SENA. Python extrae competencias, RAs, conocimientos y criterios automáticamente.
        </p>
      </div>

      <Card style={{ overflow: 'hidden' }}>
        <div
          onDragOver={e  => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e      => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files[0]) }}
          onClick={() => inputRef.current?.click()}
          className={`upload-zone${dragging ? ' upload-zone--dragging' : ' upload-zone--default'}`}
        >
          <div className="upload-zone__icon">
            <Ic n="upload" s={22}/>
          </div>
          <div className="upload-zone__title">Arrastra el PDF aquí</div>
          <div className="upload-zone__sub">o haz clic para seleccionar</div>
          <div className="upload-zone__cta">
            <Btn variant="accent" icon="upload">Seleccionar archivo</Btn>
          </div>
          <div className="upload-zone__hint">
            PDF · máx. 50 MB · Diseño curricular oficial SENA
          </div>
          <input ref={inputRef} type="file" accept=".pdf" style={{ display: 'none' }}
            onChange={e => handle(e.target.files?.[0])}/>
        </div>

        {error && (
          <div className="upload-error">
            <Ic n="alert" s={15} style={{ flexShrink: 0, marginTop: 1 }}/>
            <span>{error}</span>
          </div>
        )}
      </Card>

      <div className="upload-footer">
        <Ic n="info" s={12} style={{ verticalAlign: 'text-bottom', marginRight: 4 }}/>
        Requiere servidor Python en{' '}
        <code>{API_PYTHON}</code>
      </div>
    </div>
  )
}

// ─── Processing Screen ────────────────────────────────────────────────────────

export function ProcessingScreen({ file, onDone, onError }: {
  file: File; onDone: (p: Programa) => void; onError: (m: string) => void
}) {
  const [completed, setCompleted] = useState<Set<number>>(new Set())
  const [progress,  setProgress]  = useState(0)

  useEffect(() => {
    const ctrl = new AbortController()
    let done = false, elapsed = 0

    const timer = setInterval(() => {
      if (done) { clearInterval(timer); return }
      elapsed += 400
      setProgress(85 * (1 - Math.exp(-elapsed / 16000)))
      const step = Math.min(Math.floor(elapsed / 3500), STEPS.length - 2)
      setCompleted(prev => { const n = new Set(prev); for (let i = 0; i <= step; i++) n.add(i); return n })
    }, 400)

    const form = new FormData()
    form.append('file', file)

    axios.post<Programa>(`${API_PYTHON}/api/extract`, form, { signal: ctrl.signal })
      .then(({ data }) => {
        if (done) return
        done = true; clearInterval(timer); setProgress(100)
        STEPS.forEach((_, i) => setTimeout(() => {
          setCompleted(prev => { const n = new Set(prev); n.add(i); return n })
          if (i === STEPS.length - 1) setTimeout(() => onDone(data), 350)
        }, i * 60))
      })
      .catch(err => {
        if (done || axios.isCancel(err)) return
        done = true; clearInterval(timer)
        const msg = axios.isAxiosError(err)
          ? (err.response?.data?.detail ?? err.message)
          : 'No se pudo conectar con el servidor. ¿Está corriendo uvicorn en :8000?'
        onError(String(msg))
      })

    return () => { done = true; ctrl.abort(); clearInterval(timer) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="processing-screen">
      <Card style={{ padding: 28 }}>
        <div className="processing-file">
          <div className="processing-file__icon">
            <Ic n="fileText" s={18}/>
          </div>
          <div className="processing-file__info">
            <div className="processing-file__name">{file.name}</div>
            <div className="processing-file__size">{(file.size / 1048576).toFixed(1)} MB</div>
          </div>
          <Bdg tone="accent">PROCESANDO</Bdg>
        </div>

        <div className="processing-progress">
          <div className="processing-progress__header">
            <span className="processing-progress__label">Extracción curricular</span>
            <span className="processing-progress__pct">{Math.round(progress)}%</span>
          </div>
          <div className="processing-progress__track">
            <div className="processing-progress__fill" style={{ width: `${progress}%` }}/>
          </div>
        </div>

        <div className="processing-steps__label">Detección en tiempo real</div>
        <div className="processing-steps__list">
          {STEPS.map((step, i) => {
            const done = completed.has(i)
            const cur  = !done && completed.size === i
            return (
              <div key={i} className="processing-step" style={{ opacity: done || cur ? 1 : 0.3 }}>
                {done
                  ? <div className="processing-step__check"><Ic n="check" s={11}/></div>
                  : cur
                  ? <div className="processing-step__spinner spin"/>
                  : <div className="processing-step__circle"/>
                }
                <span className="processing-step__text">{step}</span>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}

// ─── Resumen Modal ────────────────────────────────────────────────────────────

export function ResumenModal({ prog, confirmed, onClose, onConfirm, saving = false, saveError = null }: {
  prog: Programa; confirmed: Set<number>; onClose: () => void; onConfirm: () => void
  saving?: boolean; saveError?: string | null
}) {
  const totalRAs = prog.competencias.reduce((a, c) => a + c.resultados_aprendizaje.length, 0)
  const totalCP  = prog.competencias.reduce((a, c) => a + c.conocimientos.filter(k => k.tipo === 'PROCESO').length, 0)
  const totalCS  = prog.competencias.reduce((a, c) => a + c.conocimientos.filter(k => k.tipo === 'SABER').length, 0)
  const totalCE  = prog.competencias.reduce((a, c) => a + c.criterios.length, 0)
  const tecnicas     = prog.competencias.filter(c => c.tipo === 'TÉCNICA').length
  const transversales = prog.competencias.filter(c => c.tipo === 'TRANSVERSAL').length
  const porPDF   = prog.competencias.filter(c => c.tipo_agrupacion === 'AGRUPADA_POR_RA').length
  const porNLI   = prog.competencias.filter(c => c.tipo_agrupacion !== 'AGRUPADA_POR_RA' && c.conocimientos.some(k => k.ra_numero !== null)).length
  const sinAgrup = prog.competencias.length - porPDF - porNLI
  const nliItems = prog.competencias.flatMap(c => c.conocimientos.filter(k => k.origen_asignacion_ra === 'NLI' || k.origen_asignacion_ra === 'INFERIDO_NLI'))
  const avgConf  = nliItems.length > 0 ? nliItems.reduce((a, k) => a + (k.confianza_nli ?? 0), 0) / nliItems.length : 0
  const bajaConf = nliItems.filter(k => (k.confianza_nli ?? 1) < 0.52).length
  const totalRevision = prog.competencias.reduce((a, c) => a + c.conocimientos.filter(k => k.requiere_revision_ra).length, 0)
  const sinConfirmar  = prog.competencias.filter((_, i) => !confirmed.has(i))
  const alertasWarn   = prog.alertas.filter(a => a.startsWith('⚠'))

  const Divider = () => <div className="resumen-divider"/>

  const StatBox = ({ label, value, sub }: { label: string; value: number | string; sub?: string }) => (
    <div className="resumen-stat-box">
      <div className="resumen-stat-box__value">{value}</div>
      <div className="resumen-stat-box__label">{label}</div>
      {sub && <div className="resumen-stat-box__sub">{sub}</div>}
    </div>
  )

  const Bar = ({ label, value, total, color }: { label: string; value: number; total: number; color: string }) => {
    const pct = total > 0 ? Math.round(value / total * 100) : 0
    return (
      <div className="resumen-bar">
        <div className="resumen-bar__header">
          <span className="resumen-bar__label">{label}</span>
          <span className="resumen-bar__value">
            {value} <span className="resumen-bar__secondary">({pct}%)</span>
          </span>
        </div>
        <div className="resumen-bar__track">
          <div className="resumen-bar__fill" style={{ width: `${pct}%`, background: color }}/>
        </div>
      </div>
    )
  }

  return (
    <div
      className="resumen-overlay"
      onClick={e => { if (e.target === e.currentTarget && !saving) onClose() }}
    >
      <div className="resumen-modal">
        {/* Cabecera */}
        <div className="resumen-header">
          <div className="resumen-header__info">
            <div className="resumen-header__label">
              Resumen de extracción — confirmar antes de enviar a base de datos
            </div>
            <div className="resumen-header__title">{prog.nombre}</div>
            <div className="resumen-header__meta">
              <span>{prog.codigo}</span><span>·</span>
              <span>V{prog.version}</span><span>·</span>
              <span style={{ fontFamily: 'Inter, sans-serif' }}>{prog.nivel_formacion}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="resumen-header__close"
            style={{ cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.4 : 1 }}
          >
            <Ic n="x" s={14}/>
          </button>
        </div>

        {/* Cuerpo */}
        <div className="resumen-body">
          <div className="resumen-section-label">Información del programa</div>
          <div className="resumen-stat-grid-4">
            <StatBox label="Horas lectivas"    value={prog.horas_lectivas.toLocaleString('es-CO')}/>
            <StatBox label="Horas productivas" value={prog.horas_productivas.toLocaleString('es-CO')}/>
            <div className="resumen-titulo-box">
              <div className="resumen-titulo-label">Título que otorga</div>
              <div className="resumen-titulo-value">{prog.titulo_otorga || '—'}</div>
            </div>
          </div>
          <Divider/>
          <div className="resumen-section-label">Contenido extraído</div>
          <div className="resumen-stat-grid-5">
            <StatBox label="Competencias" value={prog.competencias.length} sub={`${tecnicas} técnicas · ${transversales} transv.`}/>
            <StatBox label="RAs" value={totalRAs}/>
            <StatBox label="CP" value={totalCP} sub="De Proceso"/>
            <StatBox label="CS" value={totalCS} sub="Del Saber"/>
            <StatBox label="CE" value={totalCE} sub="Criterios"/>
          </div>
          <Divider/>
          <div className="resumen-section-label">Tipo de agrupación</div>
          <div style={{ marginTop: 12 }}>
            <Bar label="Agrupada por RA (extraída del PDF)" value={porPDF} total={prog.competencias.length} color="#4f46e5"/>
            <Bar label="Agrupada por NLI (inferida por el modelo)" value={porNLI} total={prog.competencias.length} color="#7c3aed"/>
            <Bar label="Sin agrupación" value={sinAgrup} total={prog.competencias.length} color="#d4d4d8"/>
          </div>
          {nliItems.length > 0 && (
            <>
              <Divider/>
              <div className="resumen-section-label">Asignación NLI</div>
              <div className="resumen-stat-grid-3">
                <StatBox label="Ítems asignados por NLI" value={nliItems.length}/>
                <StatBox label="Confianza promedio" value={avgConf.toFixed(2)} sub="umbral: 0.52"/>
                <div style={{ background: bajaConf > 0 ? '#fef9c3' : '#f0fdf4', borderRadius: 8, padding: '12px 16px', border: `1px solid ${bajaConf > 0 ? '#fde68a' : '#bbf7d0'}` }}>
                  <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 24, fontWeight: 700, color: bajaConf > 0 ? '#a16207' : '#15803d', lineHeight: 1 }}>{bajaConf}</div>
                  <div style={{ fontSize: 10.5, marginTop: 4, color: bajaConf > 0 ? '#a16207' : '#15803d' }}>
                    Con baja confianza {bajaConf > 0 ? '— revisar' : '— todo OK'}
                  </div>
                </div>
              </div>
            </>
          )}
          <Divider/>
          <div className="resumen-section-label">Validación humana</div>
          <div className="resumen-validacion">
            <div className="resumen-validacion__box" style={{ border: '1px solid #e4e4e7', background: sinConfirmar.length === 0 ? '#f0fdf4' : '#fff' }}>
              <div className="resumen-validacion__values">
                <span className="resumen-validacion__num" style={{ color: sinConfirmar.length === 0 ? '#15803d' : '#0a0a0b' }}>
                  {confirmed.size}
                </span>
                <span className="resumen-validacion__desc">/ {prog.competencias.length} competencias confirmadas</span>
              </div>
              <Bar label="Progreso de validación" value={confirmed.size} total={prog.competencias.length} color={sinConfirmar.length === 0 ? '#16a34a' : '#4f46e5'}/>
            </div>
            {totalRevision > 0 && (
              <div className="resumen-revision-box">
                <div className="resumen-revision-num">{totalRevision}</div>
                <div className="resumen-revision-label">ítems con revisión pendiente</div>
              </div>
            )}
          </div>
          {alertasWarn.length > 0 && (
            <>
              <Divider/>
              <div className="resumen-section-label">Alertas del extractor ({alertasWarn.length})</div>
              <div className="resumen-alertas-list">
                {alertasWarn.map((a, i) => (
                  <div key={i} className="resumen-alerta-item">
                    <span style={{ flexShrink: 0 }}>⚠</span>
                    <span>{a.replace(/^⚠\s*/, '')}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="resumen-footer">
          <div className="resumen-footer__info">
            {saveError
              ? <div className="resumen-footer__error">✗ {saveError}</div>
              : <div className="resumen-footer__status">
                  {saving
                    ? 'Guardando en la base de datos...'
                    : sinConfirmar.length > 0
                      ? `⚠ ${sinConfirmar.length} competencia(s) sin confirmar — confírmalas todas para poder enviar`
                      : '✓ Todas las competencias confirmadas — listo para enviar'
                  }
                </div>
            }
          </div>
          <div className="resumen-footer__btns">
            <Btn variant="secondary" onClick={onClose} disabled={saving}>Volver a revisar</Btn>
            <Btn variant="accent" onClick={onConfirm} disabled={saving || sinConfirmar.length > 0}>
              {saving
                ? <><div className="spin resumen-saving-spinner"/> Guardando...</>
                : <><Ic n="check" s={14}/>Confirmar y enviar a DB</>
              }
            </Btn>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Review Screen ────────────────────────────────────────────────────────────

type ReviewTab = 'competencias' | 'programa' | 'alertas'

export function ReviewScreen({ programa: initProg, pdfUrl, onBack, onSaved }: {
  programa: Programa; pdfUrl: string; onBack: () => void; onSaved?: () => void
}) {
  const [prog,        setProg]        = useState(initProg)
  const [tab,         setTab]         = useState<ReviewTab>('competencias')
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
  const [confirmed,   setConfirmed]   = useState<Set<number>>(new Set())
  const [savedOk,     setSavedOk]     = useState(false)
  const [showResumen, setShowResumen] = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [saveError,   setSaveError]   = useState<string | null>(null)

  const totalRAs   = prog.competencias.reduce((a, c) => a + c.resultados_aprendizaje.length, 0)
  const totalCP    = prog.competencias.reduce((a, c) => a + c.conocimientos.filter(k => k.tipo === 'PROCESO').length, 0)
  const totalCS    = prog.competencias.reduce((a, c) => a + c.conocimientos.filter(k => k.tipo === 'SABER').length, 0)
  const totalCE    = prog.competencias.reduce((a, c) => a + c.criterios.length, 0)
  const needsRev   = prog.competencias.reduce((a, c) => a + c.conocimientos.filter(k => k.requiere_revision_ra).length, 0)
  const warnCount  = prog.alertas.filter(a => a.startsWith('⚠')).length

  const handleConfirmFinal = async () => {
    setSaving(true); setSaveError(null)
    try {
      await saveProgramaToDB(prog)
      setSavedOk(true); setShowResumen(false)
      onSaved?.()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Error al guardar en la base de datos')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="review-screen">
      <header className="review-header">
        <button onClick={onBack} className="review-header__back">
          <Ic n="arrowLeft" s={13}/>Otro PDF
        </button>
        <div className="review-header__divider"/>
        <div className="review-header__info">
          <div className="review-header__title">{prog.nombre}</div>
          <div className="review-header__meta">
            <span>{prog.codigo}</span><span>V{prog.version}</span><span>·</span>
            <span style={{ fontFamily: 'Inter, sans-serif' }}>{prog.nivel_formacion}</span>
          </div>
        </div>
        {([['Comp.', prog.competencias.length], ['RAs', totalRAs], ['CP', totalCP], ['CS', totalCS], ['CE', totalCE]] as [string, number][]).map(([l, v]) => (
          <div key={l} className="review-header__stat">
            <span className="review-header__stat-num">{v}</span>
            <span className="review-header__stat-label">{l}</span>
          </div>
        ))}
        {needsRev > 0  && <Bdg tone="warn">{needsRev} rev.</Bdg>}
        {warnCount > 0 && <Bdg tone="err">{warnCount} alertas</Bdg>}
        <div className="review-header__divider"/>
        {savedOk
          ? <Bdg tone="ok">CONFIRMADO ✓</Bdg>
          : <>
              {confirmed.size < prog.competencias.length && (
                <Bdg tone="warn">{confirmed.size}/{prog.competencias.length} confirmadas</Bdg>
              )}
              <Btn
                variant="accent"
                onClick={() => setShowResumen(true)}
                disabled={confirmed.size < prog.competencias.length}
              >
                <Ic n="check" s={14}/>Confirmar extracción
              </Btn>
            </>
        }
      </header>

      {showResumen && (
        <ResumenModal
          prog={prog} confirmed={confirmed}
          onClose={() => { if (!saving) setShowResumen(false) }}
          onConfirm={handleConfirmFinal}
          saving={saving} saveError={saveError}
        />
      )}

      <div className="review-body">
        <div className="review-pdf">
          <div className="review-pdf__bar">
            <Ic n="fileText" s={13} style={{ color: '#a1a1aa' }}/>
            <span className="review-pdf__label">Documento PDF</span>
          </div>
          <iframe src={pdfUrl} className="review-pdf__iframe" title="Vista previa del PDF"/>
        </div>

        <div className="review-panel">
          <div className="review-tabs">
            {(['competencias', 'programa', 'alertas'] as ReviewTab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`review-tab-btn${tab === t ? ' review-tab-btn--active' : ' review-tab-btn--inactive'}`}
              >
                {t === 'alertas' ? `Alertas${warnCount > 0 ? ` (${warnCount})` : ''}` : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <div className="review-content">
            {tab === 'programa'     && <ProgramaTab prog={prog} onChange={setProg}/>}
            {tab === 'competencias' && (
              <CompetenciasTab
                competencias={prog.competencias}
                expandedIdx={expandedIdx}
                onExpand={setExpandedIdx}
                confirmed={confirmed}
                isLocked={savedOk}
                onConfirm={idx => { setConfirmed(s => { const n = new Set(s); n.add(idx); return n }); setExpandedIdx(null) }}
                onUnconfirm={idx => { setConfirmed(s => { const n = new Set(s); n.delete(idx); return n }); setExpandedIdx(idx) }}
                onChange={(idx, comp) => { const cs = [...prog.competencias]; cs[idx] = comp; setProg({ ...prog, competencias: cs }) }}
              />
            )}
            {tab === 'alertas' && <AlertasTab alertas={prog.alertas}/>}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Programa Tab ─────────────────────────────────────────────────────────────

function ProgramaTab({ prog, onChange }: { prog: Programa; onChange: (p: Programa) => void }) {
  const fields: [string, keyof Programa, boolean?][] = [
    ['Nombre del programa', 'nombre'], ['Código', 'codigo', true], ['Versión', 'version', true],
    ['Nivel de formación', 'nivel_formacion'], ['Título que otorga', 'titulo_otorga'],
    ['Fecha de inicio', 'fecha_inicio', true], ['Horas lectivas', 'horas_lectivas', true], ['Horas productivas', 'horas_productivas', true],
  ]
  return (
    <Card style={{ padding: 22 }}>
      <div className="prog-tab__title">Información del programa</div>
      <div className="prog-tab__grid">
        {fields.map(([label, key, mono]) => (
          <div key={key} style={{ gridColumn: key === 'nombre' ? '1/-1' : undefined }}>
            <div className="prog-tab__field-label">{label}</div>
            <input
              value={String(prog[key] ?? '')}
              onChange={e => onChange({ ...prog, [key]: e.target.value })}
              className="prog-tab__input"
              style={{ fontFamily: mono ? '"JetBrains Mono", monospace' : 'Inter, sans-serif' }}
            />
          </div>
        ))}
      </div>
    </Card>
  )
}

// ─── Competencias Tab ─────────────────────────────────────────────────────────

function CompetenciasTab({ competencias, expandedIdx, onExpand, confirmed, isLocked, onConfirm, onUnconfirm, onChange }: {
  competencias: Competencia[]; expandedIdx: number | null; onExpand: (i: number | null) => void
  confirmed: Set<number>; isLocked: boolean; onConfirm: (i: number) => void
  onUnconfirm: (i: number) => void; onChange: (i: number, c: Competencia) => void
}) {
  return (
    <div className="comp-tab-list">
      {competencias.map((comp, idx) => {
        const isOpen   = expandedIdx === idx
        const isDone   = confirmed.has(idx)
        const porPDF   = comp.tipo_agrupacion === 'AGRUPADA_POR_RA'
        const porNLI   = !porPDF && comp.conocimientos.some(k => k.ra_numero !== null)
        const isGrp    = porPDF || porNLI
        const cps      = comp.conocimientos.filter(k => k.tipo === 'PROCESO').length
        const css      = comp.conocimientos.filter(k => k.tipo === 'SABER').length
        const revCount = comp.conocimientos.filter(k => k.requiere_revision_ra).length
        const sinRA    = comp.conocimientos.filter(k => !k.ra_numero).length
        const canExpand = !isDone && !isLocked

        return (
          <Card key={idx} style={{ overflow: 'hidden', opacity: isLocked && !isDone ? 0.6 : 1 }}>
            <div
              onClick={() => canExpand && onExpand(isOpen ? null : idx)}
              className="comp-item__header"
              style={{
                cursor: canExpand ? 'pointer' : 'default',
                background: isDone ? '#f0fdf4' : isOpen ? '#fafafa' : '#fff',
                borderBottom: isOpen ? '1px solid #e4e4e7' : 'none',
              }}
            >
              <Ic n={isOpen ? 'chevronDown' : 'chevronRight'} s={14} style={{ color: '#71717a', flexShrink: 0 }}/>
              <div className="comp-item__num">
                {String(comp.orden).padStart(2, '0')}
              </div>
              <div className="comp-item__info">
                <div className="comp-item__name">{comp.nombre || '(sin nombre)'}</div>
                <div className="comp-item__sub">
                  <span className="comp-item__codigo">{comp.codigo_norma}</span>
                  <span className="comp-item__tipo">· {comp.tipo} · {comp.horas_maximas}h</span>
                </div>
              </div>
              {!isDone && (
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 5, flexShrink: 0,
                  fontFamily: '"JetBrains Mono", monospace', letterSpacing: '.04em',
                  background: porNLI ? '#f3e8ff' : isGrp ? '#dbeafe' : '#f1f1f3',
                  color:      porNLI ? '#6b21a8' : isGrp ? '#1d4ed8' : '#52525b',
                  border:     `1px solid ${porNLI ? '#d8b4fe' : isGrp ? '#bfdbfe' : '#e4e4e7'}`,
                }}>
                  {porNLI ? 'AGRUPADA POR NLI' : isGrp ? 'AGRUPADA POR RA' : 'SIN AGRUPACIÓN'}
                </span>
              )}
              <div className="comp-item__counts">
                {!isDone && ([[comp.resultados_aprendizaje.length, 'RA'], [cps, 'CP'], [css, 'CS'], [comp.criterios.length, 'CE']] as [number, string][]).map(([n, l]) => (
                  <span key={l} className="comp-item__count-badge">{n} {l}</span>
                ))}
                {revCount > 0 && !isDone && <Bdg tone="warn">{revCount} rev.</Bdg>}
                {sinRA > 0 && isGrp && !isDone && <Bdg tone="err">{sinRA} sin RA</Bdg>}
                {isDone && <Bdg tone="ok">✓ VALIDADA</Bdg>}
                {isDone && !isLocked && (
                  <button
                    onClick={e => { e.stopPropagation(); onUnconfirm(idx) }}
                    className="comp-item__edit-btn"
                  >
                    Editar
                  </button>
                )}
              </div>
            </div>
            {isOpen && (
              <div className="comp-item__detail">
                <CompetenciaDetail comp={comp} onChange={c => onChange(idx, c)} onConfirm={() => onConfirm(idx)} isDone={isDone}/>
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}

// ─── Competencia Detail ───────────────────────────────────────────────────────

function CompetenciaDetail({ comp, onChange, onConfirm, isDone }: {
  comp: Competencia; onChange: (c: Competencia) => void; onConfirm: () => void; isDone: boolean
}) {
  const isGrp = comp.tipo_agrupacion === 'AGRUPADA_POR_RA' || comp.conocimientos.some(k => k.ra_numero !== null)
  return (
    <>
      <div className="comp-detail__grid">
        {([['Nombre', 'nombre', false], ['Código norma', 'codigo_norma', true], ['Horas', 'horas_maximas', true]] as [string, keyof Competencia, boolean][]).map(([lbl, key, mono]) => (
          <div key={key}>
            <div className="comp-detail__field-label">{lbl}</div>
            <input
              type={key === 'horas_maximas' ? 'number' : 'text'}
              value={String(comp[key] ?? '')}
              onChange={e => onChange({ ...comp, [key]: key === 'horas_maximas' ? Number(e.target.value) : e.target.value })}
              className="comp-detail__input"
              style={{ fontFamily: mono ? '"JetBrains Mono", monospace' : 'Inter, sans-serif' }}
            />
          </div>
        ))}
      </div>
      <RAsEditor ras={comp.resultados_aprendizaje} onChange={ras => onChange({ ...comp, resultados_aprendizaje: ras })}/>
      <div className="comp-detail__divider"/>
      {isGrp ? <GroupedEditor comp={comp} onChange={onChange}/> : <FlatEditor comp={comp} onChange={onChange}/>}
      <div className="comp-detail__confirm">
        <Btn variant={isDone ? 'secondary' : 'accent'} onClick={onConfirm}>
          <Ic n="check" s={14}/>{isDone ? 'Confirmada ✓' : 'Confirmar competencia'}
        </Btn>
      </div>
    </>
  )
}

// ─── RAs Editor ──────────────────────────────────────────────────────────────

function RAsEditor({ ras, onChange }: { ras: RA[]; onChange: (r: RA[]) => void }) {
  const upd = (i: number, desc: string) => { const a = [...ras]; a[i] = { ...a[i], descripcion: desc }; onChange(a) }
  const del = (i: number) => onChange(ras.filter((_, j) => j !== i))
  const add = () => onChange([...ras, { numero: String(ras.length + 1).padStart(2, '0'), descripcion: '', orden: ras.length + 1 }])
  return (
    <div className="ras-editor">
      <div className="ras-editor__title">
        Resultados de Aprendizaje · {ras.length}
      </div>
      <div className="ras-editor__list">
        {ras.map((ra, i) => (
          <div key={i} className="ras-editor__row">
            <span className="ras-editor__num">RA {ra.numero}</span>
            <AutoTxt value={ra.descripcion} onChange={d => upd(i, d)} placeholder="Descripción del resultado de aprendizaje..."/>
            <button onClick={() => del(i)} title="Eliminar RA" className="ras-editor__del-btn">
              <Ic n="trash" s={12}/>
            </button>
          </div>
        ))}
        <AddBtn label="+ RA" onClick={add}/>
      </div>
    </div>
  )
}

// ─── Grouped Editor ───────────────────────────────────────────────────────────

function GroupedEditor({ comp, onChange }: { comp: Competencia; onChange: (c: Competencia) => void }) {
  const ras    = comp.resultados_aprendizaje
  const raNums = ras.map(r => r.numero)

  const updConoc = (i: number, patch: Partial<Conocimiento>) => { const a = [...comp.conocimientos]; a[i] = { ...a[i], ...patch }; onChange({ ...comp, conocimientos: a }) }
  const delConoc = (i: number) => onChange({ ...comp, conocimientos: comp.conocimientos.filter((_, j) => j !== i) })
  const addConoc = (ra: string | null, tipo: 'PROCESO' | 'SABER') => onChange({ ...comp, conocimientos: [...comp.conocimientos, mkConoc(tipo, ra, comp.conocimientos.length + 1)] })
  const updCrit  = (i: number, patch: Partial<Criterio>) => { const a = [...comp.criterios]; a[i] = { ...a[i], ...patch }; onChange({ ...comp, criterios: a }) }
  const delCrit  = (i: number) => onChange({ ...comp, criterios: comp.criterios.filter((_, j) => j !== i) })
  const addCrit  = (ra: string | null) => onChange({ ...comp, criterios: [...comp.criterios, mkCrit(ra, comp.criterios.length + 1)] })

  const sinRAConoc = comp.conocimientos.map((k, i) => ({ ...k, _i: i })).filter(k => !k.ra_numero)
  const sinRACrit  = comp.criterios.map((c, i) => ({ ...c, _i: i })).filter(c => !c.ra_numero)

  return (
    <div className="grouped-editor">
      {ras.map(ra => {
        const raConoc = comp.conocimientos.map((k, i) => ({ ...k, _i: i })).filter(k => k.ra_numero === ra.numero)
        const raCrit  = comp.criterios.map((c, i) => ({ ...c, _i: i })).filter(c => c.ra_numero === ra.numero)
        return (
          <div key={ra.numero} className="grouped-ra-block">
            <div className="grouped-ra-header">
              <span className="grouped-ra-num">RA {ra.numero}</span>
              <span className="grouped-ra-desc">
                {ra.descripcion || <em style={{ opacity: 0.5 }}>Sin descripción</em>}
              </span>
            </div>
            <div className="grouped-ra-body">
              {raConoc.map(k => (
                <ItemRow key={k._i} tipo={k.tipo === 'PROCESO' ? 'CP' : 'CS'} text={k.descripcion}
                  ra={k.ra_numero} raOptions={raNums} rev={k.requiere_revision_ra}
                  onChangeText={t => updConoc(k._i, { descripcion: t })}
                  onChangeRA={r => updConoc(k._i, { ra_numero: r || null })}
                  onDelete={() => delConoc(k._i)}/>
              ))}
              {raCrit.map(c => (
                <ItemRow key={'ce' + c._i} tipo="CE" text={c.descripcion}
                  ra={c.ra_numero} raOptions={raNums} rev={false}
                  onChangeText={t => updCrit(c._i, { descripcion: t })}
                  onChangeRA={r => updCrit(c._i, { ra_numero: r || null })}
                  onDelete={() => delCrit(c._i)}/>
              ))}
              <div className="grouped-ra-actions">
                <AddBtn label="+ CP" onClick={() => addConoc(ra.numero, 'PROCESO')}/>
                <AddBtn label="+ CS" onClick={() => addConoc(ra.numero, 'SABER')}/>
                <AddBtn label="+ CE" onClick={() => addCrit(ra.numero)}/>
              </div>
            </div>
          </div>
        )
      })}
      {(sinRAConoc.length > 0 || sinRACrit.length > 0) && (
        <div className="grouped-sin-ra">
          <div className="grouped-sin-ra-header">
            <Bdg tone="warn">SIN RA</Bdg>
            <span className="grouped-sin-ra-msg">Estos ítems no tienen RA asignado — reasígnalos usando el selector</span>
          </div>
          <div className="grouped-sin-ra-body">
            {sinRAConoc.map(k => (
              <ItemRow key={k._i} tipo={k.tipo === 'PROCESO' ? 'CP' : 'CS'} text={k.descripcion}
                ra={null} raOptions={raNums} rev={true}
                onChangeText={t => updConoc(k._i, { descripcion: t })}
                onChangeRA={r => updConoc(k._i, { ra_numero: r || null })}
                onDelete={() => delConoc(k._i)}/>
            ))}
            {sinRACrit.map(c => (
              <ItemRow key={'ce' + c._i} tipo="CE" text={c.descripcion}
                ra={null} raOptions={raNums} rev={false}
                onChangeText={t => updCrit(c._i, { descripcion: t })}
                onChangeRA={r => updCrit(c._i, { ra_numero: r || null })}
                onDelete={() => delCrit(c._i)}/>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Flat Editor ──────────────────────────────────────────────────────────────

function FlatEditor({ comp, onChange }: { comp: Competencia; onChange: (c: Competencia) => void }) {
  const updConoc = (i: number, patch: Partial<Conocimiento>) => { const a = [...comp.conocimientos]; a[i] = { ...a[i], ...patch }; onChange({ ...comp, conocimientos: a }) }
  const delConoc = (i: number) => onChange({ ...comp, conocimientos: comp.conocimientos.filter((_, j) => j !== i) })
  const addConoc = (tipo: 'PROCESO' | 'SABER') => onChange({ ...comp, conocimientos: [...comp.conocimientos, mkConoc(tipo, null, comp.conocimientos.length + 1)] })
  const updCrit  = (i: number, patch: Partial<Criterio>) => { const a = [...comp.criterios]; a[i] = { ...a[i], ...patch }; onChange({ ...comp, criterios: a }) }
  const delCrit  = (i: number) => onChange({ ...comp, criterios: comp.criterios.filter((_, j) => j !== i) })
  const addCrit  = () => onChange({ ...comp, criterios: [...comp.criterios, mkCrit(null, comp.criterios.length + 1)] })
  const cps = comp.conocimientos.map((k, i) => ({ ...k, _i: i })).filter(k => k.tipo === 'PROCESO')
  const css = comp.conocimientos.map((k, i) => ({ ...k, _i: i })).filter(k => k.tipo === 'SABER')

  const FlatSection = ({ title, color, items, onAdd }: { title: string; color: string; items: typeof cps; onAdd: () => void }) => (
    <div className="flat-section">
      <div className="flat-section__header">
        <span className="flat-section__title" style={{ color }}>{title}</span>
        <span className="flat-section__count">· {items.length}</span>
      </div>
      <div className="flat-section__items">
        {items.map(k => (
          <div key={k._i} className="flat-section__row">
            <AutoTxt value={k.descripcion} onChange={t => updConoc(k._i, { descripcion: t })} placeholder="Descripción..."/>
            <button onClick={() => delConoc(k._i)} className="flat-section__del-btn">
              <Ic n="trash" s={12}/>
            </button>
          </div>
        ))}
        <AddBtn label={`+ ${title}`} onClick={onAdd}/>
      </div>
    </div>
  )

  return (
    <div>
      <FlatSection title="De Proceso" color="#1d4ed8" items={cps} onAdd={() => addConoc('PROCESO')}/>
      <FlatSection title="Del Saber"  color="#065f46" items={css} onAdd={() => addConoc('SABER')}/>
      <div className="flat-section">
        <div className="flat-section__header">
          <span className="flat-section__title" style={{ color: '#6b21a8' }}>Criterios de Evaluación</span>
          <span className="flat-section__count">· {comp.criterios.length}</span>
        </div>
        <div className="flat-section__items">
          {comp.criterios.map((c, i) => (
            <div key={i} className="flat-section__row">
              <AutoTxt value={c.descripcion} onChange={t => updCrit(i, { descripcion: t })} placeholder="Criterio de evaluación..."/>
              <button onClick={() => delCrit(i)} className="flat-section__del-btn">
                <Ic n="trash" s={12}/>
              </button>
            </div>
          ))}
          <AddBtn label="+ CE" onClick={addCrit}/>
        </div>
      </div>
    </div>
  )
}

// ─── Item Row ─────────────────────────────────────────────────────────────────

function ItemRow({ tipo, text, ra, raOptions, rev, onChangeText, onChangeRA, onDelete }: {
  tipo: string; text: string; ra: string | null; raOptions: string[]; rev: boolean
  onChangeText: (t: string) => void; onChangeRA: (r: string) => void; onDelete: () => void
}) {
  const TIPO: Record<string, [string, string]> = {
    CP: ['#dbeafe', '#1d4ed8'], CS: ['#d1fae5', '#065f46'], CE: ['#f3e8ff', '#6b21a8'],
  }
  const [bg, fg] = TIPO[tipo] ?? ['#f1f1f3', '#52525b']
  return (
    <div className="item-row">
      {rev && <Ic n="alert" s={12} style={{ color: '#ca8a04', flexShrink: 0, marginTop: 7 }}/>}
      <span className="item-row__tipo" style={{ background: bg, color: fg }}>{tipo}</span>
      <AutoTxt value={text} onChange={onChangeText} placeholder="Descripción..."/>
      <select value={ra ?? ''} onChange={e => onChangeRA(e.target.value)} className="item-row__ra-select">
        <option value="">Sin RA</option>
        {raOptions.map(r => <option key={r} value={r}>RA {r}</option>)}
      </select>
      <button onClick={onDelete} className="item-row__del-btn">
        <Ic n="trash" s={12}/>
      </button>
    </div>
  )
}

// ─── Alertas Tab ──────────────────────────────────────────────────────────────

function AlertasTab({ alertas }: { alertas: string[] }) {
  const warns = alertas.filter(a => a.startsWith('⚠'))
  const oks   = alertas.filter(a => a.startsWith('✓'))
  return (
    <div className="alertas-tab">
      {warns.length > 0 && (
        <Card style={{ padding: 16 }}>
          <div className="alertas-section-label alertas-warn-label">
            Advertencias · {warns.length}
          </div>
          <div className="alertas-warn-list">
            {warns.map((a, i) => (
              <div key={i} className="alerta-warn-item">
                <span style={{ flexShrink: 0 }}>⚠</span><span>{a.replace(/^⚠\s*/, '')}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
      {oks.length > 0 && (
        <Card style={{ padding: 16 }}>
          <div className="alertas-section-label alertas-ok-label">
            Competencias OK · {oks.length}
          </div>
          <div className="alertas-ok-list">
            {oks.map((a, i) => (
              <div key={i} className="alerta-ok-item">
                <span style={{ flexShrink: 0 }}>✓</span><span>{a.replace(/^✓\s*/, '')}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
