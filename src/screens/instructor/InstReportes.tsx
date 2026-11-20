// "Reportes" del instructor: lo que hizo en el mes (momentos, visitas,
// bitácoras leídas, etapas registradas) y lo que entrega: el informe del mes,
// con su firma, y el documento GFPI-F-023 de cada aprendiz.
import { useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '../../store/auth'
import api from '../../lib/api'
import { Lienzo, Frase, Panel, Boton, Estado } from '../../ui'
import { fdia } from '../../ui/estados'
import { momentoLabel } from './types'
import type { HistorialEvento } from './types'
import type { EtapaProductiva } from '../productiva/types'
import '../hoy/hoy.css'
import './reportes.css'

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const mesActual = () => new Date().toISOString().slice(0, 7)
const nombreMes = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]} de ${m.slice(0, 4)}`
const dia = (s: string) => (s.includes('T') ? s : s.replace(' ', 'T')).slice(0, 10)

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

export function InstReportes({ onAbrir, onDocumento }: {
  onAbrir: (etapaId: number) => void
  onDocumento: (etapaId: number) => void
}) {
  const user = useAuthStore(s => s.user)
  const [mes, setMes] = useState(mesActual())
  const [eventos, setEventos] = useState<HistorialEvento[] | null>(null)
  const [etapas, setEtapas] = useState<EtapaProductiva[] | null>(null)
  const [firma, setFirma] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [q, setQ] = useState('')

  useEffect(() => {
    if (!user) return
    let vivo = true
    api.get<{ eventos: HistorialEvento[] }>('/instructores/mi/historial')
      .then(r => { if (vivo) setEventos(r.data.eventos) })
      .catch(() => { if (vivo) setErr('No se pudo cargar lo que has hecho.') })
    api.get<EtapaProductiva[]>(`/etapas-productivas?instructor_id=${user.id}`)
      .then(r => { if (vivo) setEtapas(r.data) })
      .catch(() => { if (vivo) setEtapas([]) })
    api.get<{ firma: string | null }>('/usuarios/me/firma')
      .then(r => { if (vivo) setFirma(r.data.firma) })
      .catch(() => {})
    return () => { vivo = false }
  }, [user])

  const delMes = useMemo(
    () => (eventos ?? []).filter(e => e.registrado_at && dia(e.registrado_at).slice(0, 7) === mes),
    [eventos, mes],
  )
  const cuenta = (c: HistorialEvento['clase']) => delMes.filter(e => e.clase === c).length
  const porDia = useMemo(() => {
    const m = new Map<string, HistorialEvento[]>()
    for (const e of delMes) m.set(dia(e.registrado_at), [...(m.get(dia(e.registrado_at)) ?? []), e])
    return [...m]
  }, [delMes])

  const partes = [
    cuenta('MOMENTO') && `registraste ${plural(cuenta('MOMENTO'), 'momento', 'momentos')}`,
    cuenta('VISITA') && `agendaste ${plural(cuenta('VISITA'), 'visita', 'visitas')}`,
    cuenta('BITACORA_LEIDA') && `leíste ${plural(cuenta('BITACORA_LEIDA'), 'bitácora', 'bitácoras')}`,
    cuenta('ETAPA_REGISTRADA') && `abriste ${plural(cuenta('ETAPA_REGISTRADA'), 'etapa productiva', 'etapas productivas')}`,
  ].filter(Boolean) as string[]
  const frase = partes.length
    ? `En ${nombreMes(mes)} ${partes.join(', ').replace(/, ([^,]*)$/, ' y $1')}.`
    : `No hay registros tuyos en ${nombreMes(mes)}.`

  const docs = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return (etapas ?? [])
      .filter(e => e.estado !== 'CANCELADA')
      .filter(e => !ql || (e.aprendiz_nombre ?? '').toLowerCase().includes(ql) || (e.numero_ficha ?? '').includes(ql))
      .sort((a, b) => (a.aprendiz_nombre ?? '').localeCompare(b.aprendiz_nombre ?? ''))
  }, [etapas, q])

  return (
    <Lienzo className="rep">
      <header className="hoy-cab rep-cab">
        <div>
          <div className="fx-eyebrow">Instructor de seguimiento</div>
          <h1 className="fx-titulo">Reportes</h1>
        </div>
        <div className="hoy-acciones">
          <input type="month" className="rep-mes" value={mes} max={mesActual()} onChange={e => setMes(e.target.value || mesActual())} aria-label="Mes"/>
          <Boton tipo="principal" onClick={() => window.print()} disabled={!eventos}>Descargar el informe del mes</Boton>
        </div>
      </header>

      {err ? <Frase tono="atraso">{err}</Frase> : eventos && <Frase>{frase}</Frase>}

      {/* El informe: es lo único que sale al imprimir (ver reportes.css). */}
      <section className="rep-informe">
        <div className="rep-solo-impresion">
          <div className="fx-eyebrow">FORMA · Seguimiento a la etapa productiva</div>
          <h2>Informe de actividades de {nombreMes(mes)}</h2>
          <p>{user?.nombre_completo} · Instructor de seguimiento{user?.centro_formacion ? ` · ${user.centro_formacion}` : ''}</p>
          <p>{frase}</p>
        </div>

        <Panel titulo={`Lo que hiciste en ${nombreMes(mes)}`} accion={<span className="fx-texto-3 fx-num">{delMes.length}</span>}>
          {!eventos ? <p className="fx-texto-3">Cargando…</p>
            : porDia.length === 0 ? <p className="fx-texto-3">Nada registrado en este mes.</p>
            : porDia.map(([d, l]) => (
              <div key={d} className="rep-dia">
                <div className="fx-eyebrow">{fdia(d)}</div>
                {l.map(e => (
                  <button key={e.key} type="button" className="rep-evento" onClick={() => onAbrir(e.etapa_id)}>
                    <span className="rep-que">{momentoLabel(e)}</span>
                    <span className="hoy-item-txt">
                      <strong>{e.aprendiz_nombre}</strong>
                      <span className="fx-texto-3">Ficha {e.numero_ficha}{e.empresa_nombre ? ` · ${e.empresa_nombre}` : ''}{e.detalle && e.clase !== 'ETAPA_REGISTRADA' ? ` · ${e.detalle}` : ''}</span>
                    </span>
                  </button>
                ))}
              </div>
            ))}
        </Panel>

        <div className="rep-firma">
          {firma
            ? <img src={firma} alt="Firma del instructor"/>
            : <p className="fx-texto-3 rep-sin-impresion">No tienes firma guardada: agrégala en Ajustes › Mi firma para que salga al pie del informe.</p>}
          <div className="rep-linea">{user?.nombre_completo} · Instructor de seguimiento</div>
        </div>
      </section>

      <Panel className="rep-docs" titulo="Documento GFPI-F-023 de cada aprendiz" accion={<span className="fx-texto-3 fx-num">{(etapas ?? []).length}</span>}>
        <input className="apr-buscar rep-buscar" type="search" placeholder="Buscar aprendiz o ficha" value={q} onChange={e => setQ(e.target.value)}/>
        {!etapas ? <p className="fx-texto-3">Cargando…</p>
          : docs.length === 0 ? <p className="fx-texto-3">{q ? 'Nadie coincide con esa búsqueda.' : 'Aún no tienes etapas registradas.'}</p>
          : docs.map(e => (
            <div key={e.id} className="preg-fila">
              <span className="preg-nombre">
                <strong>{e.aprendiz_nombre}</strong>
                <span className="fx-texto-3">Ficha {e.numero_ficha}{e.resultado_final ? '' : ` · desde el ${fdia(e.fecha_inicio)}`}</span>
              </span>
              <span className="rep-doc-acc">
                {e.resultado_final && <Estado tono={e.resultado_final === 'APROBADO' ? 'hecho' : 'atraso'}>{e.resultado_final === 'APROBADO' ? 'Aprobó' : 'No aprobó'}</Estado>}
                <Boton tipo="suave" onClick={() => onDocumento(e.id)}>Ver documento</Boton>
              </span>
            </div>
          ))}
      </Panel>
    </Lienzo>
  )
}
