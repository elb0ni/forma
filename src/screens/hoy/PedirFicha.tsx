// "Pedir una ficha": el instructor no se asigna fichas; las pide y su
// coordinación aprueba desde Asignación (decisión v3, Fase 15). Aquí ve las
// fichas de su coordinación que no tienen instructor y sus solicitudes.
import { useEffect, useMemo, useState } from 'react'
import api from '../../lib/api'
import { PanelLateral, Boton, Estado } from '../../ui'
import { fdia } from '../../ui/estados'

interface FichaLibre {
  id: number
  numero_ficha: string
  programa_nombre?: string | null
  fecha_inicio_productiva?: string | null
  instructor_practica?: string | null
  coordinacion_academica_id: number | null
}
interface Solicitud { id: number; ficha_id: number; numero_ficha: string; programa: string | null; nota: string | null; created_at: string }

const mensaje = (e: unknown, def: string) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? def

export function PedirFicha({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const [fichas, setFichas] = useState<FichaLibre[] | null>(null)
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [eligiendo, setEligiendo] = useState<number | null>(null)
  const [nota, setNota] = useState('')
  const [busy, setBusy] = useState(false)

  const cargarSolicitudes = () =>
    api.get<Solicitud[]>('/asignar/solicitudes').then((r) => setSolicitudes(r.data)).catch(() => {})

  useEffect(() => {
    if (!abierto) return
    let vivo = true
    api.get<FichaLibre[]>('/fichas?estado=EN_EJECUCION')
      .then((r) => { if (vivo) setFichas(r.data.filter((f) => !f.instructor_practica)) })
      .catch(() => { if (vivo) setErr('No se pudieron cargar las fichas de tu coordinación.') })
    api.get<Solicitud[]>('/asignar/solicitudes')
      .then((r) => { if (vivo) setSolicitudes(r.data) })
      .catch(() => {})
    return () => { vivo = false }
  }, [abierto])

  const lista = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return (fichas ?? [])
      .filter((f) => !ql || f.numero_ficha.includes(ql) || (f.programa_nombre ?? '').toLowerCase().includes(ql))
      .sort((a, b) => (a.fecha_inicio_productiva ?? '9999').localeCompare(b.fecha_inicio_productiva ?? '9999'))
      .slice(0, 40)
  }, [fichas, q])

  async function pedir(f: FichaLibre) {
    setBusy(true); setErr(null)
    try {
      await api.post('/asignar/solicitudes', { ficha_id: f.id, nota: nota.trim() || undefined })
      setEligiendo(null); setNota('')
      await cargarSolicitudes()
    } catch (e) {
      setErr(mensaje(e, 'No se pudo enviar la solicitud.'))
    } finally { setBusy(false) }
  }

  async function retirar(s: Solicitud) {
    setBusy(true); setErr(null)
    try {
      await api.delete(`/asignar/solicitudes/${s.id}`)
      await cargarSolicitudes()
    } catch (e) {
      setErr(mensaje(e, 'No se pudo retirar la solicitud.'))
    } finally { setBusy(false) }
  }

  const pedida = (fichaId: number) => solicitudes.some((s) => s.ficha_id === fichaId)

  return (
    <PanelLateral
      abierto={abierto} onCerrar={onCerrar} titulo="Pedir una ficha" ancho={520}
      sub="Fichas de tu coordinación sin instructor de seguimiento. Tu coordinación decide; cuando apruebe, sus aprendices te aparecen en Por registrar."
    >
      <div className="pedir">
        {err && <p className="pedir-error">{err}</p>}

        {solicitudes.length > 0 && (
          <section>
            <div className="fx-eyebrow">Esperando a tu coordinación</div>
            {solicitudes.map((s) => (
              <div key={s.id} className="preg-fila">
                <span className="preg-nombre">
                  <strong>Ficha {s.numero_ficha}</strong>
                  <span className="fx-texto-3">{s.programa ?? ''}{s.nota ? ` · "${s.nota}"` : ''} · pedida el {fdia(s.created_at)}</span>
                </span>
                <Boton tipo="suave" disabled={busy} onClick={() => retirar(s)}>Retirar</Boton>
              </div>
            ))}
          </section>
        )}

        <section>
          <div className="fx-eyebrow">Sin instructor, por fecha de inicio</div>
          <input className="apr-buscar pedir-buscar" type="search" placeholder="Número de ficha o programa" value={q} onChange={(e) => setQ(e.target.value)}/>
          {!fichas && !err && <p className="fx-texto-3">Cargando…</p>}
          {fichas && lista.length === 0 && (
            <p className="fx-texto-3">{q ? `Ninguna ficha coincide con "${q}".` : 'Todas las fichas de tu coordinación tienen instructor.'}</p>
          )}
          {lista.map((f) => (
            <div key={f.id} className="pedir-ficha">
              <div className="preg-fila">
                <span className="preg-nombre">
                  <strong className="fx-num">{f.numero_ficha}</strong>
                  <span className="fx-texto-3">
                    {f.programa_nombre ?? 'Sin programa'}
                    {f.fecha_inicio_productiva ? ` · etapa productiva desde el ${fdia(f.fecha_inicio_productiva)}` : ''}
                  </span>
                </span>
                {pedida(f.id)
                  ? <Estado tono="info">Pedida</Estado>
                  : eligiendo !== f.id && <Boton tipo="suave" disabled={busy} onClick={() => { setEligiendo(f.id); setNota('') }}>Pedir</Boton>}
              </div>
              {eligiendo === f.id && (
                <div className="pedir-nota">
                  <input
                    className="apr-buscar" value={nota} maxLength={300} autoFocus
                    placeholder="Nota para la coordinación (opcional): por ejemplo, la acompañé en la lectiva"
                    onChange={(e) => setNota(e.target.value)}
                  />
                  <div className="pedir-acciones">
                    <Boton tipo="suave" disabled={busy} onClick={() => setEligiendo(null)}>Cancelar</Boton>
                    <Boton tipo="principal" disabled={busy} onClick={() => pedir(f)}>{busy ? 'Enviando…' : 'Enviar solicitud'}</Boton>
                  </div>
                </div>
              )}
            </div>
          ))}
        </section>
      </div>
    </PanelLateral>
  )
}
