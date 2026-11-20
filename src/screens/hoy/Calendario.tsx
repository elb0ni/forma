// "Calendario" del instructor: arriba, las visitas que hay que agendar
// (agrupadas por empresa, para armar recorridos); abajo, el calendario del mes
// con cada cosa en su día (AgendaCalendario, el navegador de 3 columnas).
import { useCallback, useEffect, useMemo, useState } from 'react'
import api from '../../lib/api'
import { Lienzo, Frase, Panel, Estado, Boton } from '../../ui'
import { fdia, NOMBRE_MOMENTO } from '../../ui/estados'
import type { EstadoAprendiz, MomentoAprendiz, PendientesInstructor, TabEtapa } from '../instructor/types'
import { AgendaCalendario } from '../instructor/AgendaCalendario'
import { mensajeError } from '../productiva/cronograma'
import { plural } from './comun'
import './hoy.css'

// Cuántos días antes de que se abra la ventana ya conviene agendar.
const DIAS_ANTES = 15

interface PorAgendar { a: EstadoAprendiz; m: MomentoAprendiz }

function sumar(iso: string, dias: number) {
  const t = Date.parse(`${iso}T00:00:00Z`)
  return new Date(t + dias * 86400000).toISOString().slice(0, 10)
}

function porAgendar(d: PendientesInstructor): PorAgendar[] {
  const tope = sumar(d.hoy, DIAS_ANTES)
  const out: PorAgendar[] = []
  for (const a of d.aprendices) {
    for (const m of a.momentos) {
      if (m.visita || m.estado === 'HECHO' || m.estado === 'AGENDADO') continue
      if (m.estado === 'VENCIDO' || m.estado === 'ABIERTO' || (m.estado === 'PROXIMO' && m.desde && m.desde <= tope)) {
        out.push({ a, m })
      }
    }
  }
  return out.sort((x, y) => (x.m.hasta ?? '').localeCompare(y.m.hasta ?? ''))
}

export function Calendario({ onAbrir, onFicha, onHoy }: {
  onAbrir: (etapaId: number, tab?: TabEtapa | null) => void
  onFicha: (fichaId: number) => void
  onHoy: () => void
}) {
  const [d, setD] = useState<PendientesInstructor | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  const cargar = useCallback(() => {
    api.get<PendientesInstructor>('/instructores/mi/pendientes')
      .then((r) => { setD(r.data); setVersion((v) => v + 1) })
      .catch((e) => setErr(e?.response?.data?.message ?? 'No se pudo cargar tu calendario.'))
  }, [])
  useEffect(() => { cargar() }, [cargar])

  if (err) return <Lienzo><Frase tono="atraso">{err}</Frase></Lienzo>
  if (!d) return <Lienzo><p className="fx-texto-3">Cargando tu calendario…</p></Lienzo>

  return (
    <div className="cal">
      <PorAgendarPanel d={d} onAgendada={cargar} onAbrir={onAbrir}/>
      <AgendaCalendario key={version} data={d} onVerEtapa={onAbrir} onVerFicha={onFicha} onIrPendientes={onHoy}/>
    </div>
  )
}

function PorAgendarPanel({ d, onAgendada, onAbrir }: {
  d: PendientesInstructor; onAgendada: () => void; onAbrir: (etapaId: number, tab?: TabEtapa | null) => void
}) {
  const lista = useMemo(() => porAgendar(d), [d])
  const [abierto, setAbierto] = useState(false)

  // Por empresa: varios aprendices en la misma empresa se visitan el mismo día.
  const grupos = useMemo(() => {
    const m = new Map<string, PorAgendar[]>()
    for (const x of lista) {
      const k = x.a.empresa_nombre?.trim() || 'Sin empresa registrada'
      m.set(k, [...(m.get(k) ?? []), x])
    }
    return [...m].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
  }, [lista])

  if (!lista.length) {
    return <p className="fx-texto-3 cal-nada">No tienes visitas por agendar en los próximos {DIAS_ANTES} días.</p>
  }
  const vencidas = lista.filter((x) => x.m.estado === 'VENCIDO').length

  return (
    <Panel
      className="cal-agendar"
      titulo={`Por agendar · ${lista.length}`}
      accion={<Boton tipo={abierto ? 'suave' : 'principal'} onClick={() => setAbierto(!abierto)}>{abierto ? 'Ocultar' : 'Agendarlas'}</Boton>}
    >
      <p className="fx-texto-2 cal-intro">
        {plural(lista.length, 'visita no tiene', 'visitas no tienen')} fecha
        {vencidas ? `, ${plural(vencidas, 'ya venció', 'ya vencieron')}` : ''}.
        {grupos.some(([, l]) => l.length > 1) ? ' Las agrupamos por empresa para que hagas una sola salida.' : ''}
      </p>
      {abierto && grupos.map(([empresa, l]) => (
        <div key={empresa} className="cal-empresa">
          <div className="fx-eyebrow">
            {empresa}{l.length > 1 ? ` · ${plural(l.length, 'visita', 'visitas')}: agéndalas el mismo día` : ''}
          </div>
          {l.map((x) => <FilaAgendar key={`${x.a.etapa_id}-${x.m.tipo}`} x={x} hoy={d.hoy} onAgendada={onAgendada} onAbrir={onAbrir}/>)}
        </div>
      ))}
    </Panel>
  )
}

function FilaAgendar({ x, hoy, onAgendada, onAbrir }: {
  x: PorAgendar; hoy: string; onAgendada: () => void; onAbrir: (etapaId: number, tab?: TabEtapa | null) => void
}) {
  const { a, m } = x
  const sugerida = m.desde && m.desde > hoy ? m.desde : hoy
  const [fecha, setFecha] = useState(sugerida)
  const [modalidad, setModalidad] = useState<'PRESENCIAL' | 'VIRTUAL'>('PRESENCIAL')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function agendar() {
    setBusy(true); setErr(null)
    try {
      await api.post(`/etapas-productivas/${a.etapa_id}/visitas`, { tipo_momento: m.tipo, fecha, modalidad })
      onAgendada()
    } catch (e) {
      setErr(mensajeError(e, 'No se pudo agendar.'))
      setBusy(false)
    }
  }

  return (
    <div className="cal-fila">
      <button type="button" className="cal-quien" onClick={() => onAbrir(a.etapa_id, 'cronograma')}>
        <strong>{a.aprendiz_nombre}</strong>
        <span className="fx-texto-3">
          {NOMBRE_MOMENTO[m.tipo]} · {m.desde && m.hasta ? `entre el ${fdia(m.desde)} y el ${fdia(m.hasta)}` : m.texto}
        </span>
      </button>
      {m.estado === 'VENCIDO' ? <Estado tono="atraso">Venció</Estado> : m.estado === 'ABIERTO' ? <Estado tono="toca">Ya se puede</Estado> : <Estado tono="futuro">Se abre pronto</Estado>}
      <div className="cal-form">
        <input type="date" value={fecha} min={hoy} onChange={(e) => setFecha(e.target.value)} aria-label="Fecha de la visita"/>
        <select value={modalidad} onChange={(e) => setModalidad(e.target.value as 'PRESENCIAL' | 'VIRTUAL')} aria-label="Modalidad">
          <option value="PRESENCIAL">Presencial</option>
          <option value="VIRTUAL">Virtual</option>
        </select>
        <Boton tipo="suave" disabled={busy || !fecha} onClick={() => void agendar()}>{busy ? 'Agendando…' : 'Agendar'}</Boton>
      </div>
      {err && <p className="cal-error">{err}</p>}
    </div>
  )
}
