import { useState, useEffect } from 'react'
import { Ic, Card } from '../../components/ui'
import type { IcName } from '../../components/ui'
import { useAuthStore } from '../../store/auth'
import api from '../../lib/api'
import { fd, LoadingBlock, CenterState } from '../shared/parts'
import type { FichaInstructor, InstructorResumen, InstructorAgenda, AgendaItem, ProyeccionInstructor, InstructorHistorial, HistorialEvento } from './types'
import type { AprendizPractica } from '../shared/AprendicesPractica'
import { FichaFolderCards } from './FichaFolderCards'
import { CalendarioMini } from './CalendarioMini'
import { ActividadReciente } from './ActividadReciente'
import './instructor.css'

const linkBtn: React.CSSProperties = {
  fontSize: 12, color: '#4f46e5', background: 'none', border: 'none', cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit',
}

function saludo(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

function KpiTile({ label, value, icon, color }: { label: string; value: number; icon: IcName; color: string }) {
  return (
    <Card style={{ padding: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#52525b', fontWeight: 600 }}>{label}</div>
        <Ic n={icon} s={15} style={{ color }}/>
      </div>
      <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 28, fontWeight: 600, color: '#0a0a0b', marginTop: 10 }}>{value}</div>
    </Card>
  )
}

function AgendaRow({ item, atrasado, onClick, last }: {
  item: AgendaItem; atrasado: boolean; onClick: () => void; last: boolean
}) {
  return (
    <div
      onClick={onClick}
      className="nx-row"
      style={{
        padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer',
        borderBottom: last ? 'none' : '1px solid #f1f1f3',
      }}
    >
      <span style={{
        width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
        background: atrasado ? '#dc2626' : '#c2410c',
      }}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#18181b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.aprendiz_nombre}
        </div>
        <div style={{ fontSize: 11.5, color: '#71717a', marginTop: 3 }}>
          <span style={{ fontFamily: '"JetBrains Mono", monospace' }}># {item.numero_ficha}</span>
          {item.empresa_nombre ? ` · ${item.empresa_nombre}` : ''} · {item.motivo}
        </div>
      </div>
      <span style={{
        fontFamily: '"JetBrains Mono", monospace', fontSize: 11.5, whiteSpace: 'nowrap',
        color: atrasado ? '#dc2626' : '#52525b',
      }}>
        {fd(item.fecha)}
      </span>
      <Ic n="chevronRight" s={14} style={{ color: '#d4d4d8', flexShrink: 0 }}/>
    </div>
  )
}

const RECIENTES = 5

export function InstructorHome({ onOpenFicha, onVerFichas, onVerEtapaProductiva, onVerAgenda, onVerHistorial }: {
  onOpenFicha: (f: FichaInstructor) => void
  onVerFichas: () => void
  onVerEtapaProductiva: (etapaId: number) => void
  onVerAgenda: () => void
  onVerHistorial: () => void
}) {
  "use no memo"
  const user = useAuthStore(s => s.user)
  const [resumen, setResumen] = useState<InstructorResumen | null>(null)
  const [fichas, setFichas] = useState<FichaInstructor[]>([])
  const [agenda, setAgenda] = useState<InstructorAgenda | null>(null)
  const [proyeccion, setProyeccion] = useState<ProyeccionInstructor | null>(null)
  const [recientes, setRecientes] = useState<HistorialEvento[] | null>(null)
  const [rosters, setRosters] = useState<Record<number, AprendizPractica[]>>({})
  const [fallos, setFallos] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  // Cada bloque del Home carga por su cuenta: si un endpoint falla, se cae
  // solo esa sección y el resto sigue sirviendo. Con Promise.all una sola
  // falla dejaba el dashboard entero en ceros, que es indistinguible de un
  // instructor sin fichas -- el peor modo de fallo posible.
  useEffect(() => {
    if (!user) return
    let live = true
    const fallidos: string[] = []

    const pedir = <T,>(url: string, set: (v: T) => void, nombre: string) =>
      api.get<T>(url)
        .then(r => { if (live) set(r.data) })
        .catch(() => { fallidos.push(nombre) })

    void Promise.allSettled([
      pedir<InstructorResumen>('/instructores/mi/resumen', setResumen, 'resumen'),
      pedir<FichaInstructor[]>('/instructores/mi/fichas', setFichas, 'fichas'),
      pedir<InstructorAgenda>('/instructores/mi/agenda', setAgenda, 'agenda'),
      pedir<ProyeccionInstructor>('/instructores/mi/proyeccion', setProyeccion, 'agenda proyectada'),
      // El slice cubre un backend sin soporte de ?limite (devuelve hasta 500).
      pedir<InstructorHistorial>(`/instructores/mi/historial?limite=${RECIENTES}`,
        h => setRecientes(h.eventos.slice(0, RECIENTES)), 'actividad reciente'),
    ]).then(() => {
      if (!live) return
      setFallos(fallidos)
      setLoading(false)
    })

    return () => { live = false }
  }, [user])

  // Los aprendices con su caso viven en el detalle de cada ficha. Se piden
  // después del primer render: las carpetas ya se ven y se van poblando, para
  // no retrasar el Home por seis peticiones.
  useEffect(() => {
    const visibles = fichas.slice(0, 6)
    if (visibles.length === 0) return
    let live = true
    Promise.all(visibles.map(f =>
      api.get<{ aprendices: AprendizPractica[] }>(`/fichas/${f.id}/detalle`)
        .then(r => [f.id, r.data.aprendices ?? []] as const)
        .catch(() => [f.id, []] as const),
    )).then(pares => {
      if (live) setRosters(Object.fromEntries(pares))
    })
    return () => { live = false }
  }, [fichas])

  if (loading) return <LoadingBlock minHeight={400}/>

  const nombre = user?.nombre_completo?.split(' ')[0] ?? 'Instructor'
  const today = new Date()
  const r = resumen
  const atrasados = agenda?.atrasados ?? []
  const proximos = agenda?.proximos ?? []
  const enSeguimiento = r?.aprendices_en_seguimiento ?? agenda?.total_en_seguimiento ?? 0
  const fichasVisibles = fichas.slice(0, 6)

  return (
    <div style={{ maxWidth: 1200 }}>
      {/* Encabezado */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 12, color: '#52525b', textTransform: 'capitalize' }}>
          {today.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
        <div style={{ fontSize: 24, fontWeight: 600, color: '#0a0a0b', marginTop: 4 }}>{saludo()}, {nombre}.</div>
        <div style={{ fontSize: 13.5, color: '#52525b', marginTop: 4 }}>
          Haces seguimiento a <strong style={{ color: '#18181b' }}>{enSeguimiento} aprendiz{enSeguimiento === 1 ? '' : 'es'}</strong> en etapa productiva
          {fichas.length > 0 && <> en <strong style={{ color: '#18181b' }}>{fichas.length} ficha{fichas.length === 1 ? '' : 's'}</strong></>}.
        </div>
      </div>

      {fallos.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 18,
          padding: '10px 13px', borderRadius: 10,
          border: '1px solid #fde68a', background: '#fffbeb',
          fontSize: 12, color: '#854d0e', lineHeight: 1.45,
        }}>
          <Ic n="alert" s={14} style={{ color: '#a16207', flexShrink: 0, marginTop: 1 }}/>
          <span>
            No se pudo cargar: <strong>{fallos.join(', ')}</strong>. Lo que ves abajo está
            incompleto — no significa que no tengas aprendices.
          </span>
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
        {/* Iconos ligados al proceso: maletín = está en la empresa, documento
            = lo que falta es el juicio cargado en Sofia, no una gestión del
            instructor. */}
        <KpiTile label="En curso" value={r?.en_curso ?? 0} icon="briefcase" color="#4f46e5"/>
        <KpiTile label="Falta juicio Sofia" value={r?.sin_juicio ?? 0} icon="fileText" color="#a16207"/>
        <KpiTile label="Aprobadas" value={r?.aprobadas ?? 0} icon="checkCircle" color="#16a34a"/>
        <KpiTile label="No aprobadas" value={r?.no_aprobadas ?? 0} icon="x" color="#dc2626"/>
      </div>

      {/* Tira de los próximos 14 días -- lleva a la Agenda completa */}
      {proyeccion && (
        <div style={{ marginBottom: 28 }}>
          <CalendarioMini
            momentos={proyeccion.momentos}
            hoy={proyeccion.hoy}
            onVerAgenda={onVerAgenda}
          />
        </div>
      )}

      {/* Necesita tu atención */}
      {atrasados.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Ic n="alert" s={15} style={{ color: '#dc2626' }}/>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#0a0a0b' }}>Necesita tu atención</span>
            <span style={{
              fontSize: 10.5, fontWeight: 700, fontFamily: '"JetBrains Mono", monospace',
              background: '#dc2626', color: '#fff', padding: '1px 7px', borderRadius: 10,
            }}>{atrasados.length}</span>
          </div>
          <Card style={{ overflow: 'hidden' }}>
            {atrasados.map((it, i) => (
              <AgendaRow key={it.etapa_id} item={it} atrasado onClick={() => onVerEtapaProductiva(it.etapa_id)} last={i === atrasados.length - 1}/>
            ))}
          </Card>
        </div>
      )}

      {/* Esta semana */}
      {proximos.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0a0a0b', marginBottom: 12 }}>Esta semana</div>
          <Card style={{ overflow: 'hidden' }}>
            {proximos.map((it, i) => (
              <AgendaRow key={it.etapa_id} item={it} atrasado={false} onClick={() => onVerEtapaProductiva(it.etapa_id)} last={i === proximos.length - 1}/>
            ))}
          </Card>
        </div>
      )}

      {/* Mis fichas */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#0a0a0b' }}>Mis fichas</div>
        {fichas.length > fichasVisibles.length && (
          <button onClick={onVerFichas} style={linkBtn}>Ver todas <Ic n="arrowRight" s={12}/></button>
        )}
      </div>
      {fichas.length === 0 ? (
        <Card style={{ marginBottom: 28 }}>
          <CenterState icon="folder" title="Sin fichas asignadas"
            sub="Todavía no eres instructor de práctica de ninguna ficha. Pide a tu coordinador que te asigne una."/>
        </Card>
      ) : (
        <div style={{ marginBottom: 24 }}>
          <FichaFolderCards fichas={fichasVisibles} rosters={rosters} atrasados={atrasados} onOpen={onOpenFicha}/>
        </div>
      )}

      {/* Actividad reciente -- lleva al Historial completo */}
      {recientes && (
        <ActividadReciente
          eventos={recientes}
          resumen={r}
          onOpenEtapa={onVerEtapaProductiva}
          onVerHistorial={onVerHistorial}
        />
      )}
    </div>
  )
}
