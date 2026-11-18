import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Ic, Card } from '../../components/ui'
import { useAuthStore } from '../../store/auth'
import api from '../../lib/api'
import { LoadingBlock, CenterState } from '../shared/parts'
import type { FichaInstructor, PendientesInstructor, TabEtapa } from './types'
import { AgendaPendientes } from './AgendaPendientes'
import { AgendaCalendario } from './AgendaCalendario'
import './instructor.css'

// ─── Agenda del instructor ───────────────────────────────────────────────────
// Es el asistente del instructor ("Pendientes" en el menú): por defecto
// muestra lo que tiene por hacer o vigilar, agrupado por ficha, y como segunda
// vista el CALENDARIO: un navegador con sus aprendices, el mes con cada cosa
// en su día y el ciclo de cada aprendiz (AgendaCalendario.tsx). La vista va en
// la URL (?vista=calendario) para que volver atrás deje donde estaba.

export function InstAgenda({ onVerEtapaProductiva, onVerFicha }: {
  onVerEtapaProductiva: (etapaId: number, tab?: TabEtapa | null) => void
  onVerFicha: (fichaId: number) => void
}) {
  "use no memo"
  const user = useAuthStore(s => s.user)
  const [params, setParams] = useSearchParams()
  const vista = params.get('vista') === 'calendario' ? 'calendario' : 'pendientes'
  const [pend, setPend] = useState<PendientesInstructor | null>(null)
  const [fichas, setFichas] = useState<FichaInstructor[]>([])
  const [cargando, setCargando] = useState(true)

  // Las fichas solo ponen nombre de programa y fase a cada tarjeta: si
  // fallan, los pendientes se muestran igual (agrupados por número de ficha).
  useEffect(() => {
    if (!user) return
    let live = true
    void Promise.allSettled([
      api.get<PendientesInstructor>('/instructores/mi/pendientes').then(r => { if (live) setPend(r.data) }),
      api.get<FichaInstructor[]>('/instructores/mi/fichas').then(r => { if (live) setFichas(r.data) }),
    ]).then(() => { if (live) setCargando(false) })
    return () => { live = false }
  }, [user])

  function cambiar(v: 'pendientes' | 'calendario') {
    setParams(v === 'calendario' ? { vista: v } : {}, { replace: true })
  }

  const hoyTxt = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
  const hoy = hoyTxt.charAt(0).toUpperCase() + hoyTxt.slice(1)
  const c = pend?.conteos
  const partes = c ? [
    c.urgente > 0 && `${c.urgente} urgente${c.urgente === 1 ? '' : 's'}`,
    c.te_toca > 0 && `${c.te_toca} por hacer`,
    c.vigilar > 0 && `${c.vigilar} para vigilar`,
  ].filter((x): x is string => !!x) : []
  const resumen = partes.length === 0 ? 'no tienes pendientes.'
    : partes.length === 1 ? `tienes ${partes[0]}.`
    : `tienes ${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}.`

  return (
    // El calendario usa tres columnas y todo el ancho disponible (celdas más
    // anchas = más texto legible); las tarjetas de Pendientes van acotadas.
    <div style={{ maxWidth: vista === 'calendario' ? undefined : 1180 }}>
      <div className="agenda-head">
        <div style={{ fontSize: 13.5, color: '#52525b' }}>
          <span>{hoy}</span>
          {pend && <>: {resumen}</>}
        </div>
        <div className="agenda-vistas" role="tablist">
          <button role="tab" aria-selected={vista === 'pendientes'} className={vista === 'pendientes' ? 'sel' : ''} onClick={() => cambiar('pendientes')}>
            <Ic n="list" s={13}/>Pendientes
          </button>
          <button role="tab" aria-selected={vista === 'calendario'} className={vista === 'calendario' ? 'sel' : ''} onClick={() => cambiar('calendario')}>
            <Ic n="calendar" s={13}/>Calendario
          </button>
        </div>
      </div>

      {cargando ? (
        <LoadingBlock minHeight={400}/>
      ) : !pend ? (
        <Card style={{ padding: 24 }}>
          <CenterState icon="alert" title="No se pudieron cargar tus pendientes" sub="Verifica la conexión con el servidor."/>
        </Card>
      ) : vista === 'calendario' ? (
        <AgendaCalendario data={pend} onVerEtapa={onVerEtapaProductiva} onVerFicha={onVerFicha} onIrPendientes={() => cambiar('pendientes')}/>
      ) : (
        <AgendaPendientes data={pend} fichas={fichas} onVerEtapa={onVerEtapaProductiva} onVerFicha={onVerFicha}/>
      )}
    </div>
  )
}
