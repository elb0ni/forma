// Una bitácora abierta en el panel lateral. El instructor la lee (abrirla ya
// cuenta como leída), puede dejar un comentario o pedir una corrección. Nadie
// la aprueba: la bitácora es del aprendiz.
import { useEffect, useState } from 'react'
import api from '../../lib/api'
import { Boton, Estado } from '../../ui'
import { estadoBitacora, fdia } from '../../ui/estados'
import type { BitacoraVista } from '../../ui/estados'
import { useSoloLectura } from '../productiva/soloLectura'
import { mensajeError } from '../productiva/cronograma'
import type { DocumentoBitacora, ResumenBitacoras } from '../productiva/cronograma'
import { BitacoraDocumentoModal } from '../productiva/BitacoraDocumento'

type Respuesta = { bitacoras: BitacoraVista[]; resumen: ResumenBitacoras }

export function LecturaBitacora({ etapaId, numero, hoy, total, onCambio, onNavegar }: {
  etapaId: number
  numero: number
  hoy: string
  total: number
  onCambio: (lista: BitacoraVista[], resumen: ResumenBitacoras) => void
  onNavegar: (n: number) => void
}) {
  const soloLectura = useSoloLectura()
  const [b, setB] = useState<BitacoraVista | null>(null)
  const [texto, setTexto] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [hecho, setHecho] = useState<string | null>(null)
  const [doc, setDoc] = useState<DocumentoBitacora | null>(null)

  const aplicar = (r: Respuesta) => {
    setB(r.bitacoras.find((x) => x.numero === numero) ?? null)
    onCambio(r.bitacoras, r.resumen)
  }

  // Abrirla es leerla: el backend solo la marca si quien la abre es el
  // instructor de la etapa; para los demás devuelve la lista sin tocarla.
  useEffect(() => {
    let vivo = true
    api.post<Respuesta>(`/etapas-productivas/${etapaId}/bitacoras/${numero}/leer`)
      .then((r) => { if (vivo) aplicar(r.data) })
      .catch(() => api.get<Respuesta>(`/etapas-productivas/${etapaId}/bitacoras`).then((r) => { if (vivo) aplicar(r.data) }))
      .catch((e) => { if (vivo) setErr(mensajeError(e, 'No se pudo abrir la bitácora.')) })
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etapaId, numero])

  async function enviar(accion: 'comentar' | 'pedir-correccion') {
    if (!texto.trim()) { setErr(accion === 'comentar' ? 'Escribe el comentario.' : 'Escribe qué debe corregir el aprendiz.'); return }
    setOcupado(true); setErr(null); setHecho(null)
    try {
      const r = await api.post<Respuesta>(`/etapas-productivas/${etapaId}/bitacoras/${numero}/${accion}`, { observacion: texto.trim() })
      aplicar(r.data)
      setTexto('')
      setHecho(accion === 'comentar' ? 'Comentario guardado. El aprendiz lo ve en "Mi etapa".' : 'Se la devolvimos al aprendiz con un correo para que la corrija.')
    } catch (e) {
      setErr(mensajeError(e, 'No se pudo guardar.'))
    } finally { setOcupado(false) }
  }

  async function verDocumento() {
    try {
      const r = await api.get<DocumentoBitacora>(`/etapas-productivas/${etapaId}/bitacoras/${numero}/documento`)
      setDoc(r.data)
    } catch (e) { setErr(mensajeError(e, 'No se pudo abrir el documento.')) }
  }

  if (!b) return <p className="fx-texto-3">{err ?? 'Abriendo…'}</p>
  const est = estadoBitacora(b, hoy)
  const actividades = b.actividades ?? []
  const puedeEscribir = !soloLectura && (b.estado === 'ENTREGADA' || b.estado === 'APROBADA' || !!b.leida_at)

  return (
    <div className="ex-bitacora">
      <div className="ex-bitacora-cab">
        <Estado tono={est.tono}>{est.texto}</Estado>
        {b.entregada_tarde ? <Estado tono="aviso">Entregada tarde</Estado> : null}
        {b.estado !== 'FUTURA' && <Boton tipo="suave" onClick={() => void verDocumento()}>Formato GFPI-F-147</Boton>}
      </div>

      {actividades.length === 0 ? (
        <p className="fx-texto-3">{b.estado === 'FUTURA' ? 'Esta quincena aún no empieza.' : 'El aprendiz todavía no ha registrado actividades.'}</p>
      ) : (
        <ol className="ex-actividades">
          {actividades.map((a, i) => (
            <li key={i}>
              <div className="ex-act-desc">{a.descripcion}</div>
              <div className="fx-texto-3 fx-num">{fdia(a.fecha_inicio)} – {fdia(a.fecha_fin)}</div>
              {a.evidencia && <div className="ex-act-dato"><span>Evidencia</span>{a.evidencia}</div>}
              {a.observaciones && <div className="ex-act-dato ex-act-dificultad"><span>Dificultades u observaciones</span>{a.observaciones}</div>}
            </li>
          ))}
        </ol>
      )}

      {b.observacion_instructor && (
        <div className="ex-comentario">
          <span className="fx-eyebrow">Comentario del instructor</span>
          <p>{b.observacion_instructor}</p>
        </div>
      )}

      {puedeEscribir && (
        <div className="ex-escribir">
          <textarea
            rows={3} value={texto} onChange={(e) => setTexto(e.target.value)}
            placeholder="Un comentario para el aprendiz, o qué debe corregir."
          />
          <div className="ex-escribir-botones">
            <Boton tipo="suave" disabled={ocupado} onClick={() => void enviar('pedir-correccion')}>Pedir corrección</Boton>
            <Boton tipo="principal" disabled={ocupado} onClick={() => void enviar('comentar')}>Comentar</Boton>
          </div>
        </div>
      )}
      {hecho && <p className="ex-ok">{hecho}</p>}
      {err && <p className="ex-error">{err}</p>}

      <div className="ex-navegar">
        <Boton tipo="suave" disabled={numero <= 1} onClick={() => onNavegar(numero - 1)}>← Bitácora {numero - 1 || ''}</Boton>
        <Boton tipo="suave" disabled={numero >= total} onClick={() => onNavegar(numero + 1)}>Bitácora {numero < total ? numero + 1 : ''} →</Boton>
      </div>

      {doc && <BitacoraDocumentoModal doc={doc} onClose={() => setDoc(null)}/>}
    </div>
  )
}
