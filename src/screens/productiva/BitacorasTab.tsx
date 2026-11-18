import { useEffect, useState } from 'react'
import { useSoloLectura } from './soloLectura'
import { Ic, Btn, Bdg } from '../../components/ui'
import { fd, LoadingBlock } from '../shared/parts'
import api from '../../lib/api'
import { ESTADO_BITACORA_META, fdia, mensajeError } from './cronograma'
import type { Bitacora, Cronograma, DocumentoBitacora, ResumenBitacoras } from './cronograma'
import { BitacoraDocumentoModal } from './BitacoraDocumento'
import './cronograma.css'

// ─── Tab: Bitácoras ─────────────────────────────────────────────────────────────
// El aprendiz las llena cada 15 días desde el portal público (/bitacoras): entra
// con su documento + un código que le llega al correo, y puede descargar
// cualquier bitácora habilitada cuando quiera. El instructor las revisa:
// aprobar agrega su firma al documento; devolver le pide correcciones.

export function BitacorasTab({ etapaId, crono, aprendizNombre, onChanged }: {
  etapaId: number
  crono: Cronograma
  aprendizNombre: string
  onChanged: () => void
}) {
  const [bitacoras, setBitacoras] = useState<Bitacora[] | null>(null)
  const [resumen, setResumen] = useState<ResumenBitacoras>(crono.resumen_bitacoras)
  const [sel, setSel] = useState<number | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    api.get<{ bitacoras: Bitacora[]; resumen: ResumenBitacoras }>(`/etapas-productivas/${etapaId}/bitacoras`)
      .then(r => {
        if (!vivo) return
        setBitacoras(r.data.bitacoras)
        setResumen(r.data.resumen)
        // Abre de una la primera por revisar, que es lo que el instructor viene a hacer.
        const porRevisar = r.data.bitacoras.find(b => b.estado === 'ENTREGADA')
        if (porRevisar) setSel(porRevisar.numero)
      })
      .catch(e => { if (vivo) setErr(mensajeError(e, 'No se pudieron cargar las bitácoras.')) })
    return () => { vivo = false }
  }, [etapaId])

  const actual = bitacoras?.find(b => b.numero === sel) ?? null

  return (
    <div className="cron">
      <AccesoAprendiz crono={crono} aprendizNombre={aprendizNombre}/>

      <section className="cron-card">
        <div className="cron-card__head">
          <span className="cron-card__titulo"><Ic n="fileText" s={14}/> Bitácoras quincenales</span>
          <span className="cron-card__hint">Una cada 15 días desde el inicio de la etapa. Las firmas se toman de la planeación.</span>
        </div>
        <div className="bit-resumen">
          <div className="bit-resumen__item"><strong>{resumen.aprobadas}/{resumen.total}</strong><span>Aprobadas</span></div>
          <div className="bit-resumen__item"><strong style={{ color: resumen.por_revisar ? '#2563eb' : undefined }}>{resumen.por_revisar}</strong><span>Por revisar</span></div>
          <div className="bit-resumen__item"><strong style={{ color: resumen.devueltas ? '#ca8a04' : undefined }}>{resumen.devueltas}</strong><span>Devueltas</span></div>
          <div className="bit-resumen__item"><strong style={{ color: resumen.vencidas ? '#dc2626' : undefined }}>{resumen.vencidas}</strong><span>Vencidas sin entregar</span></div>
        </div>

        {err && <div className="cron-aviso cron-aviso--err" style={{ margin: '0 16px 16px', width: 'auto' }}>{err}</div>}
        {!bitacoras && !err && <div style={{ padding: 16 }}><LoadingBlock/></div>}

        {bitacoras && (
          <div className="bit-grid">
            {bitacoras.map(b => {
              const meta = ESTADO_BITACORA_META[b.estado]
              return (
                <button
                  key={b.numero}
                  className={`bit-celda${sel === b.numero ? ' bit-celda--sel' : ''}${b.vencida ? ' bit-celda--vencida' : ''}`}
                  style={{ borderLeftColor: b.vencida ? '#dc2626' : meta.color }}
                  onClick={() => setSel(sel === b.numero ? null : b.numero)}
                >
                  <span className="bit-celda__n">
                    N.º {b.numero}
                    {b.total_actividades > 0 && <span style={{ fontSize: 10.5, color: '#a1a1aa', fontWeight: 500 }}>{b.total_actividades} act.</span>}
                  </span>
                  <span className="bit-celda__p">{fdia(b.periodo_inicio, false)} – {fdia(b.periodo_fin, false)}</span>
                  <Bdg tone={b.vencida ? 'err' : meta.tone}>{b.vencida ? 'Vencida' : meta.label}</Bdg>
                </button>
              )
            })}
          </div>
        )}

        {actual && (
          <DetalleBitacora
            key={actual.numero}
            etapaId={etapaId}
            b={actual}
            onRevisada={(lista, res) => { setBitacoras(lista); setResumen(res); onChanged() }}
          />
        )}
      </section>
    </div>
  )
}

// ─── Acceso del aprendiz: código por correo ─────────────────────────────────────
// El aprendiz entra al portal con su documento y FORMA le manda un código al
// correo registrado (vale 5 minutos). El instructor no tiene que generar nada;
// solo compartir el enlace y asegurarse de que el aprendiz tenga correo.

function AccesoAprendiz({ crono, aprendizNombre }: { crono: Cronograma; aprendizNombre: string }) {
  const [copiado, setCopiado] = useState(false)
  const url = `${window.location.origin}/bitacoras`
  const acceso = crono.acceso
  const correos = crono.correos_aprendiz

  async function copiar() {
    const nombre = aprendizNombre.split(' ')[0] ?? ''
    const msg =
      `Hola ${nombre}, tus bitácoras de etapa productiva se diligencian en ${url}. ` +
      `Entra con tu número de documento y te llegará un código a tu correo. ` +
      `Debes diligenciar una bitácora cada 15 días.`
    try {
      await navigator.clipboard.writeText(msg)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch { /* sin portapapeles */ }
  }

  return (
    <section className="cron-card">
      <div className="cron-card__head">
        <span className="cron-card__titulo"><Ic n="key" s={14}/> Acceso del aprendiz</span>
        <span className="cron-card__hint">Sin cuenta: documento + código que llega al correo</span>
        <Btn variant="secondary" size="sm" icon={copiado ? 'check' : 'copy'} onClick={() => void copiar()}>
          {copiado ? 'Mensaje copiado' : 'Copiar mensaje para el aprendiz'}
        </Btn>
      </div>
      <div className="bit-acceso">
        <div className="bit-acceso__txt">
          <span>
            El aprendiz entra en <strong>{url}</strong> con su número de documento. FORMA le envía un código
            de 6 dígitos {correos.length ? <>a <strong>{correos.join(' y ')}</strong></> : 'a su correo'} que vale 5 minutos.
          </span>
          {correos.length === 0 && (
            <div className="cron-aviso cron-aviso--err">
              El aprendiz no tiene correo registrado y no podrá entrar. Agrégalo en "Información general" → Datos del aprendiz.
            </div>
          )}
          <span className="bit-acceso__meta">
            {acceso?.ultimo_ingreso_at
              ? `Último ingreso: ${fd(acceso.ultimo_ingreso_at)}`
              : acceso ? `Pidió un código el ${fd(acceso.generado_at)}, pero aún no ha ingresado.` : 'El aprendiz aún no ha ingresado.'}
          </span>
        </div>
      </div>
    </section>
  )
}

// ─── Detalle + revisión de una bitácora ─────────────────────────────────────────

function DetalleBitacora({ etapaId, b, onRevisada }: {
  etapaId: number
  b: Bitacora
  onRevisada: (lista: Bitacora[], resumen: ResumenBitacoras) => void
}) {
  const soloLectura = useSoloLectura()
  const [obs, setObs] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [doc, setDoc] = useState<DocumentoBitacora | null>(null)
  const actividades = b.actividades ?? []

  async function revisar(decision: 'APROBAR' | 'DEVOLVER') {
    if (decision === 'DEVOLVER' && !obs.trim()) { setErr('Escribe qué debe corregir el aprendiz.'); return }
    setBusy(true); setErr(null)
    try {
      const r = await api.post<{ bitacoras: Bitacora[]; resumen: ResumenBitacoras }>(
        `/etapas-productivas/${etapaId}/bitacoras/${b.numero}/revisar`,
        { decision, observacion: obs.trim() || undefined },
      )
      onRevisada(r.data.bitacoras, r.data.resumen)
    } catch (e) {
      setErr(mensajeError(e, 'No se pudo guardar la revisión.'))
    } finally { setBusy(false) }
  }

  async function verDocumento() {
    setErr(null)
    try {
      const r = await api.get<DocumentoBitacora>(`/etapas-productivas/${etapaId}/bitacoras/${b.numero}/documento`)
      setDoc(r.data)
    } catch (e) {
      setErr(mensajeError(e, 'No se pudo abrir la bitácora.'))
    }
  }

  return (
    <div className="bit-detalle">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: '#18181b' }}>
            Bitácora N.º {b.numero} · {fdia(b.periodo_inicio)} – {fdia(b.periodo_fin)}
          </div>
          <div style={{ fontSize: 11.5, color: '#71717a' }}>
            Plazo de entrega: {fdia(b.fecha_limite)}
            {b.entregada_at && <> · entregada {fd(b.entregada_at)}</>}
            {b.revisada_at && <> · revisada {fd(b.revisada_at)}</>}
          </div>
        </div>
        {b.estado !== 'FUTURA' && (
          <Btn variant="secondary" size="sm" icon="download" onClick={() => void verDocumento()}>Descargar</Btn>
        )}
      </div>

      {actividades.length === 0 ? (
        <div style={{ fontSize: 12, color: '#a1a1aa' }}>
          {b.estado === 'FUTURA' ? 'Esta quincena aún no empieza.' : 'El aprendiz todavía no ha registrado actividades.'}
        </div>
      ) : (
        <div className="bit-tabla-wrap">
          <table className="bit-tabla">
            <thead>
              <tr><th>Actividad</th><th>Fechas</th><th>Evidencia</th><th>Observaciones</th></tr>
            </thead>
            <tbody>
              {actividades.map((a, i) => (
                <tr key={i}>
                  <td>{a.descripcion}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{fdia(a.fecha_inicio, false)} – {fdia(a.fecha_fin, false)}</td>
                  <td>{a.evidencia || '—'}</td>
                  <td>{a.observaciones || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {b.observacion_instructor && b.estado !== 'ENTREGADA' && (
        <div className="cron-aviso" style={{ color: '#3f3f46', background: '#f7f7f9', borderColor: '#e4e4e7' }}>
          <strong>Tu observación:</strong> {b.observacion_instructor}
        </div>
      )}

      {b.estado === 'ENTREGADA' && !soloLectura && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <textarea
            className="nx-input"
            rows={2}
            value={obs}
            onChange={e => setObs(e.target.value)}
            placeholder="Observación (obligatoria si la devuelves)"
            style={{ resize: 'vertical', minHeight: 56, paddingTop: 8 }}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Btn variant="secondary" size="sm" icon="arrowLeft" onClick={() => void revisar('DEVOLVER')} disabled={busy}>Devolver para corregir</Btn>
            <Btn variant="accent" size="sm" icon="check" onClick={() => void revisar('APROBAR')} disabled={busy}>Aprobar</Btn>
          </div>
        </div>
      )}
      {err && <div className="cron-aviso cron-aviso--err">{err}</div>}

      {doc && <BitacoraDocumentoModal doc={doc} onClose={() => setDoc(null)}/>}
    </div>
  )
}
