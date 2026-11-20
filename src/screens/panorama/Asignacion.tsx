// Asignación de instructores con capacidad (PLAN_REDISENO, Fase 8).
// Una pantalla para coordinación, subdirección y dirección regional: cuántos
// aprendices habrá en práctica los próximos 3 meses contra los cupos, qué
// fichas no tienen instructor y, para cada una, a quién conviene asignarla.
// v3 (Fase 15): el panel Asignar (ficha, aprendices sueltos o repartir), las
// solicitudes de los instructores y liberar a un instructor.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../lib/api'
import { useAuthStore } from '../../store/auth'
import { useAmbito } from '../../store/ambito'
import { Lienzo, Frase, Estado, Panel, Boton, PanelLateral } from '../../ui'
import { fdia } from '../../ui/estados'
import { MesesCapacidad, Medidor } from './comun'
import { AsignarPanel } from './AsignarPanel'
import { miles } from './formato'
import type { Mes } from './formato'
import './panorama.css'

interface InstructorCap {
  id: string; nombre: string; coordinacion_id: number | null; coordinacion: string | null
  cupo: number; cupo_propio: boolean; etapas: number; por_iniciar: number; carga: number; libre: number
  programas: number; municipios: string[]
}
interface FichaCola {
  id: number; numero_ficha: string; programa: string | null; coordinacion: string | null; municipio: string | null
  inicio: string; fin: string | null; aprendices: number; individuales: number; sin_asignar: number
  dias: number; habilitados: number | null
}
interface Alerta { tipo: 'SOBRE_CUPO' | 'FICHA_SIN_INSTRUCTOR' | 'MES_SIN_CUPO'; texto: string; ref: string }
interface Resumen {
  hoy: string; cupo_defecto: number | null; capacidad: number
  instructores: InstructorCap[]; meses: Mes[]; cola: FichaCola[]; alertas: Alerta[]
}
interface Opcion { id: number; nombre: string }


const msg = (e: unknown, d: string) => (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? d

export function Asignacion({ rutaFicha }: { rutaFicha: (fichaId: number) => string }) {
  const user = useAuthStore((s) => s.user)
  const rol = user?.rol
  // El centro y la coordinación salen del ámbito elegido arriba (Fase 14).
  const amb = useAmbito()
  const centro = rol === 'SUPER_ADMIN' && amb.centroId ? String(amb.centroId) : ''
  const coord = (rol === 'SUPER_ADMIN' || rol === 'SUBDIRECTOR') && amb.coordId ? String(amb.coordId) : ''
  const [centros, setCentros] = useState<Opcion[]>([])
  const [coords, setCoords] = useState<Opcion[]>([])
  const [d, setD] = useState<Resumen | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [ficha, setFicha] = useState<FichaCola | null>(null)
  const [verTodas, setVerTodas] = useState(false)

  const cargar = useCallback(() => {
    const q = new URLSearchParams()
    if (centro) q.set('centro_id', centro)
    if (coord) q.set('coordinacion_id', coord)
    api.get<Resumen>(`/capacidad/resumen?${q}`)
      .then((r) => { setD(r.data); setErr(null) })
      .catch((e) => setErr(msg(e, 'No se pudo calcular la capacidad.')))
  }, [centro, coord])
  useEffect(cargar, [cargar])

  useEffect(() => {
    if (rol !== 'SUPER_ADMIN') return
    api.get<Opcion[]>('/centros').then((r) => setCentros(r.data)).catch(() => setCentros([]))
  }, [rol])
  useEffect(() => {
    if (rol === 'COORD_ACADEMICO') return
    const c = rol === 'SUBDIRECTOR' ? user?.centro_formacion_id : centro
    if (!c) return
    api.get<Opcion[]>(`/coordinaciones?centro_id=${c}`).then((r) => setCoords(r.data)).catch(() => setCoords([]))
  }, [rol, centro, user?.centro_formacion_id])

  const cola = useMemo(() => {
    const l = d?.cola ?? []
    return { enCurso: l.filter((f) => f.dias <= 0), porEntrar: l.filter((f) => f.dias > 0) }
  }, [d])

  if (err) return <Lienzo><Frase tono="atraso">{err}</Frase></Lienzo>
  if (!d) return <Lienzo><p className="fx-texto-3">Calculando cupos y demanda…</p></Lienzo>

  const ambito = rol === 'COORD_ACADEMICO' ? 'tu coordinación'
    : coord ? (coords.find((c) => String(c.id) === coord)?.nombre ?? 'la coordinación')
    : rol === 'SUBDIRECTOR' ? 'tu centro'
    : centro ? (centros.find((c) => String(c.id) === centro)?.nombre ?? 'el centro') : 'la regional'
  const peor = d.meses.reduce<Mes | null>((a, m) => (m.faltan && (!a || m.faltan > a.faltan) ? m : a), null)
  const pronto = d.cola.filter((f) => f.dias > 0 && f.dias <= 15).length
  const sobre = d.instructores.filter((i) => i.carga > i.cupo)
  const frase = [
    peor ? `Faltan cupos: ${peor.frase.charAt(0).toLowerCase()}${peor.frase.slice(1)}` : `Los cupos de ${ambito} alcanzan para los próximos 3 meses.`,
    d.cola.length ? `${miles(cola.enCurso.length)} fichas ya en práctica y ${miles(cola.porEntrar.length)} por entrar no tienen instructor${pronto ? ` (${pronto} empiezan en 15 días o menos)` : ''}.` : 'Todas las fichas tienen instructor.',
    sobre.length ? `${sobre.length} ${sobre.length === 1 ? 'instructor está' : 'instructores están'} por encima de su cupo.` : '',
  ].filter(Boolean).join(' ')
  const lista = verTodas ? d.cola : d.cola.slice(0, 25)

  return (
    <Lienzo className="pan">
      <header className="pan-cab">
        <div>
          <div className="fx-eyebrow">Capacidad de seguimiento · {ambito}</div>
          <h1 className="fx-titulo">Asignación de instructores</h1>
        </div>
        <div className="pan-filtros">
        </div>
      </header>

      <Frase tono={peor || pronto ? 'atraso' : 'ok'}>{frase}</Frase>

      <Solicitudes centro={centro} coord={coord} onCambio={cargar} onAbrir={(id, numero) => setFicha(d.cola.find((f) => f.id === id) ?? { id, numero_ficha: numero } as FichaCola)}/>

      <Panel titulo="Los próximos 3 meses" accion={<span className="fx-texto-3">{d.instructores.length} instructores · {miles(d.capacidad)} cupos</span>}>
        <MesesCapacidad meses={d.meses}/>
        <CupoCentro cupo={d.cupo_defecto} centroId={rol === 'SUBDIRECTOR' ? user?.centro_formacion_id ?? null : centro ? Number(centro) : null} onCambio={cargar}/>
      </Panel>

      <Panel titulo="Fichas sin instructor" accion={<span className="fx-texto-3 fx-num">{d.cola.length}</span>}>
        {d.cola.length === 0 ? <p className="fx-texto-3">Todas las fichas en práctica o por entrar tienen instructor.</p> : (
          <div className="fx-tabla-envoltura">
            <table className="fx-tabla pan-tabla">
              <thead><tr><th>Ficha</th><th>Programa</th><th>Municipio</th><th>Práctica</th><th>Aprendices</th><th/></tr></thead>
              <tbody>
                {lista.map((f, i) => {
                  const grupo = i === 0 || (lista[i - 1].dias <= 0) !== (f.dias <= 0)
                  return [
                    grupo && (
                      <tr key={`g${f.id}`} className="fx-grupo"><td colSpan={6}>
                        {f.dias <= 0 ? `Ya en práctica, sin instructor (${cola.enCurso.length})` : `Por entrar en los próximos 3 meses (${cola.porEntrar.length})`}
                      </td></tr>
                    ),
                    <tr key={f.id}>
                      <td className="fx-num">{f.numero_ficha}</td>
                      <td>
                        <div className="pan-prog">{f.programa ?? '—'}</div>
                        {rol !== 'COORD_ACADEMICO' && f.coordinacion && <div className="fx-texto-3">{f.coordinacion}</div>}
                      </td>
                      <td className="fx-texto-2">{f.municipio ?? '—'}</td>
                      <td>
                        <Estado tono={f.dias < 0 ? 'atraso' : f.dias <= 15 ? 'aviso' : 'futuro'}>
                          {f.dias < 0 ? `empezó hace ${-f.dias} días` : f.dias === 0 ? 'empieza hoy' : `en ${f.dias} días`}
                        </Estado>
                        <div className="fx-texto-3 fx-num">{fdia(f.inicio)}</div>
                      </td>
                      <td className="fx-num">
                        {f.sin_asignar}
                        {f.habilitados != null && <div className="fx-texto-3">{f.habilitados} habilitados</div>}
                      </td>
                      <td><Boton tipo="principal" onClick={() => setFicha(f)}>Asignar</Boton></td>
                    </tr>,
                  ]
                })}
              </tbody>
            </table>
          </div>
        )}
        {d.cola.length > 25 && (
          <div style={{ marginTop: 10 }}><Boton tipo="suave" onClick={() => setVerTodas(!verTodas)}>{verTodas ? 'Ver menos' : `Ver las ${d.cola.length}`}</Boton></div>
        )}
      </Panel>

      <Panel titulo="Instructores" accion={<span className="fx-texto-3">Cupo 0 = no hace seguimiento</span>}>
        <Instructores lista={d.instructores} coordVisible={rol !== 'COORD_ACADEMICO'} onCambio={cargar}/>
      </Panel>

      <PanelLateral
        abierto={!!ficha} onCerrar={() => setFicha(null)} ancho={600}
        titulo={ficha ? `Asignar · ficha ${ficha.numero_ficha}` : ''}
        sub={ficha ? `${ficha.programa ?? ''} · ${ficha.sin_asignar} aprendices sin instructor` : undefined}
      >
        {ficha && (
          <>
            <AsignarPanel fichaId={ficha.id} onCambio={cargar}/>
            <p className="fx-texto-3 pan-nota"><Link to={rutaFicha(ficha.id)}>Abrir la ficha</Link></p>
          </>
        )}
      </PanelLateral>
    </Lienzo>
  )
}

function CupoCentro({ cupo, centroId, onCambio }: { cupo: number | null; centroId: number | null; onCambio: () => void }) {
  const rol = useAuthStore((s) => s.user?.rol)
  const [editar, setEditar] = useState(false)
  const [v, setV] = useState('')
  const [err, setErr] = useState<string | null>(null)
  if (cupo == null || centroId == null) {
    return <p className="fx-texto-3 pan-nota">Cada instructor cuenta con el cupo de su centro, salvo que tenga uno propio.</p>
  }
  const puede = rol === 'SUPER_ADMIN' || rol === 'SUBDIRECTOR'
  async function guardar() {
    try {
      await api.patch(`/capacidad/centros/${centroId}/cupo`, { cupo: Number(v) })
      setEditar(false); onCambio()
    } catch (e) { setErr(msg(e, 'No se pudo guardar.')) }
  }
  return (
    <div className="pan-nota fx-texto-3">
      {editar ? (
        <span className="pan-cupo-edit">
          Cupo por defecto del centro:
          <input type="number" min={1} max={500} value={v} onChange={(e) => setV(e.target.value)} autoFocus/>
          <Boton tipo="principal" onClick={() => void guardar()}>Guardar</Boton>
          <Boton tipo="suave" onClick={() => setEditar(false)}>Cancelar</Boton>
          {err && <span className="pan-error">{err}</span>}
        </span>
      ) : (
        <>
          Cada instructor acompaña hasta <strong>{cupo}</strong> aprendices, salvo que tenga un cupo propio.{' '}
          {puede && <Boton tipo="suave" onClick={() => { setV(String(cupo)); setEditar(true) }}>Cambiar</Boton>}
        </>
      )}
    </div>
  )
}

function Instructores({ lista, coordVisible, onCambio }: { lista: InstructorCap[]; coordVisible: boolean; onCambio: () => void }) {
  const [editando, setEditando] = useState<string | null>(null)
  const [v, setV] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const orden = [...lista].sort((a, b) => (b.carga / Math.max(b.cupo, 1)) - (a.carga / Math.max(a.cupo, 1)) || a.nombre.localeCompare(b.nombre))
  async function guardar(id: string, cupo: number | null) {
    setErr(null)
    try {
      await api.patch(`/capacidad/instructores/${id}/cupo`, { cupo })
      setEditando(null); onCambio()
    } catch (e) { setErr(msg(e, 'No se pudo guardar el cupo.')) }
  }
  if (!lista.length) return <p className="fx-texto-3">No hay instructores activos en este ámbito.</p>
  return (
    <div className="fx-tabla-envoltura">
      {err && <p className="pan-error">{err}</p>}
      <table className="fx-tabla pan-tabla">
        <thead><tr><th>Instructor</th><th>Lleva</th><th/><th>Libres</th><th>Cupo</th><th/></tr></thead>
        <tbody>
          {orden.map((i) => (
            <tr key={i.id}>
              <td>
                <div className="pan-prog">{i.nombre}</div>
                {coordVisible && i.coordinacion && <div className="fx-texto-3">{i.coordinacion}</div>}
              </td>
              <td className="fx-num" title={`${i.etapas} con etapa registrada y ${i.por_iniciar} por iniciar en sus fichas`}>
                {i.carga} <span className="fx-texto-3">de {i.cupo}</span>
              </td>
              <td><Medidor carga={i.carga} cupo={i.cupo}/></td>
              <td className="fx-num">{i.cupo === 0 ? <span className="fx-texto-3">no hace seguimiento</span> : i.libre < 0 ? <Estado tono="atraso">{-i.libre} de más</Estado> : i.libre}</td>
              <td>
                {editando === i.id ? (
                  <span className="pan-cupo-edit">
                    <input type="number" min={0} max={500} value={v} onChange={(e) => setV(e.target.value)} autoFocus/>
                    <Boton tipo="principal" onClick={() => void guardar(i.id, v === '' ? null : Number(v))}>Guardar</Boton>
                    {i.cupo_propio && <Boton tipo="suave" onClick={() => void guardar(i.id, null)}>Usar el del centro</Boton>}
                  </span>
                ) : (
                  <Boton tipo="suave" onClick={() => { setV(String(i.cupo)); setEditando(i.id) }}>
                    {i.cupo}{i.cupo_propio ? ' (propio)' : ''} · cambiar
                  </Boton>
                )}
              </td>
              <td><Liberar instructor={i} onCambio={onCambio}/></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}


// Solicitudes de fichas que hicieron los instructores (decisión v3: el
// instructor pide, la coordinación aprueba).
interface SolicitudF { id: number; ficha_id: number; numero_ficha: string; programa: string | null; instructor: string; nota: string | null; fecha: string | null }
function Solicitudes({ centro, coord, onCambio, onAbrir }: { centro: string; coord: string; onCambio: () => void; onAbrir: (fichaId: number, numero: string) => void }) {
  const [l, setL] = useState<SolicitudF[]>([])
  const [n, setN] = useState(0)
  useEffect(() => {
    const q = new URLSearchParams()
    if (centro) q.set('centro_id', centro)
    if (coord) q.set('coordinacion_id', coord)
    let vivo = true
    api.get<SolicitudF[]>(`/asignar/solicitudes?${q}`).then((r) => { if (vivo) setL(r.data) }).catch(() => { if (vivo) setL([]) })
    return () => { vivo = false }
  }, [centro, coord, n])
  if (!l.length) return null
  async function resolver(id: number, accion: 'aprobar' | 'rechazar') {
    await api.post(`/asignar/solicitudes/${id}/${accion}`).catch(() => undefined)
    setN(n + 1); onCambio()
  }
  return (
    <Panel titulo="Instructores que pidieron una ficha" accion={<span className="fx-texto-3 fx-num">{l.length}</span>}>
      <ul className="pan-lista">
        {l.map((x) => (
          <li key={x.id} className="asg-sol-fila">
            <span className="fx-texto-3 fx-num">{fdia(x.fecha)}</span>
            <span>
              <strong>{x.instructor}</strong> pide la ficha{' '}
              <button type="button" className="hoy-enlace" onClick={() => onAbrir(x.ficha_id, x.numero_ficha)}>{x.numero_ficha}</button>
              <span className="fx-texto-3"> · {x.programa ?? ''}</span>
              {x.nota && <span className="fx-texto-2"> · “{x.nota}”</span>}
            </span>
            <span className="asg-acciones">
              <Boton tipo="principal" onClick={() => void resolver(x.id, 'aprobar')}>Aprobar</Boton>
              <Boton tipo="suave" onClick={() => void resolver(x.id, 'rechazar')}>Rechazar</Boton>
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

// La cuarta forma: liberar a un instructor (licencia, retiro, vacaciones).
// Sus fichas vuelven a la cola y sus aprendices sueltos, al instructor de su ficha.
function Liberar({ instructor, onCambio }: { instructor: InstructorCap; onCambio: () => void }) {
  const [paso, setPaso] = useState<null | { fichas: number; individuales: number; etapas: number }>(null)
  const [err, setErr] = useState<string | null>(null)
  if (!instructor.carga) return null
  if (!paso) {
    return <Boton tipo="suave" onClick={() => { api.get(`/asignar/a-cargo/${instructor.id}`).then((r) => setPaso(r.data)).catch((e) => setErr(msg(e, 'No se pudo consultar.'))) }}>Liberar</Boton>
  }
  return (
    <span className="asg-liberar">
      <span className="fx-texto-2">
        {paso.fichas} fichas vuelven a la cola{paso.individuales ? ` y ${paso.individuales} aprendices sueltos a su ficha` : ''}.
      </span>
      <Boton tipo="principal" onClick={() => { api.post('/asignar/liberar', { instructor_id: instructor.id }).then(() => { setPaso(null); onCambio() }).catch((e) => setErr(msg(e, 'No se pudo liberar.'))) }}>Confirmar</Boton>
      <Boton tipo="suave" onClick={() => setPaso(null)}>Cancelar</Boton>
      {err && <span className="pan-error">{err}</span>}
    </span>
  )
}
