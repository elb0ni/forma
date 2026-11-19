// Asignación de instructores con capacidad (PLAN_REDISENO, Fase 8).
// Una pantalla para coordinación, subdirección y dirección regional: cuántos
// aprendices habrá en práctica los próximos 3 meses contra los cupos, qué
// fichas no tienen instructor y, para cada una, a quién conviene asignarla.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../lib/api'
import { useAuthStore } from '../../store/auth'
import { Lienzo, Frase, Estado, Panel, Boton, PanelLateral } from '../../ui'
import { fdia } from '../../ui/estados'
import { MesesCapacidad, Medidor } from './comun'
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
interface Sugerencia { id: string; nombre: string; coordinacion: string | null; cupo: number; carga: number; libre: number; razones: string[]; avisos: string[] }
interface Sugerencias { ficha: { id: number; numero_ficha: string; programa: string | null; aprendices: number }; sugerencias: Sugerencia[] }
interface Opcion { id: number; nombre: string }


const msg = (e: unknown, d: string) => (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? d

export function Asignacion({ rutaFicha }: { rutaFicha: (fichaId: number) => string }) {
  const user = useAuthStore((s) => s.user)
  const rol = user?.rol
  const [centro, setCentro] = useState<string>('')
  const [coord, setCoord] = useState<string>('')
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
          {rol === 'SUPER_ADMIN' && (
            <select value={centro} onChange={(e) => { setCentro(e.target.value); setCoord('') }} aria-label="Centro">
              <option value="">Los 4 centros</option>
              {centros.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          )}
          {(rol === 'SUBDIRECTOR' || (rol === 'SUPER_ADMIN' && centro)) && coords.length > 0 && (
            <select value={coord} onChange={(e) => setCoord(e.target.value)} aria-label="Coordinación">
              <option value="">Todas las coordinaciones</option>
              {coords.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          )}
        </div>
      </header>

      <Frase tono={peor || pronto ? 'atraso' : 'ok'}>{frase}</Frase>

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
        titulo={ficha ? `Asignar la ficha ${ficha.numero_ficha}` : ''}
        sub={ficha ? `${ficha.programa ?? ''} · ${ficha.sin_asignar} aprendices sin instructor` : undefined}
      >
        {ficha && (
          <Asistente
            ficha={ficha} hoy={d.hoy} rutaFicha={rutaFicha(ficha.id)}
            onAsignada={() => { setFicha(null); cargar() }}
          />
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
        <thead><tr><th>Instructor</th><th>Lleva</th><th/><th>Libres</th><th>Cupo</th></tr></thead>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Asistente({ ficha, hoy, rutaFicha, onAsignada }: { ficha: FichaCola; hoy: string; rutaFicha: string; onAsignada: () => void }) {
  const [s, setS] = useState<Sugerencias | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    api.get<Sugerencias>(`/capacidad/sugerencias?ficha_id=${ficha.id}`)
      .then((r) => { if (vivo) setS(r.data) })
      .catch((e) => { if (vivo) setErr(msg(e, 'No se pudieron calcular las sugerencias.')) })
    return () => { vivo = false }
  }, [ficha.id])

  async function asignar(id: string) {
    setOcupado(id); setErr(null)
    try {
      await api.post('/asignaciones-practica', { ficha_id: ficha.id, instructor_id: id, fecha_inicio: ficha.inicio > hoy ? ficha.inicio : hoy })
      onAsignada()
    } catch (e) {
      setErr(msg(e, 'No se pudo asignar.'))
      setOcupado(null)
    }
  }

  if (!s) return <p className="fx-texto-3">{err ?? 'Buscando a quién conviene…'}</p>
  return (
    <div className="pan-asistente">
      <p className="fx-texto-2" style={{ margin: 0 }}>
        Ordenados por: cupo libre, misma coordinación, experiencia en el programa y municipio.
      </p>
      {err && <p className="pan-error">{err}</p>}
      {s.sugerencias.length === 0 && <p className="fx-texto-3">No hay instructores con cupo en este ámbito.</p>}
      {s.sugerencias.map((x, k) => (
        <div key={x.id} className="pan-sug" data-primera={k === 0 || undefined}>
          <div className="pan-sug-cab">
            <div>
              <div className="pan-prog">{x.nombre}</div>
              {x.coordinacion && <div className="fx-texto-3">{x.coordinacion}</div>}
            </div>
            <div className="pan-sug-carga fx-num">
              <Medidor carga={x.carga} cupo={x.cupo}/>
              <span className="fx-texto-3">{x.carga} de {x.cupo}</span>
            </div>
          </div>
          <ul className="pan-razones">
            {x.razones.map((r) => <li key={r} data-tipo="si">{r}</li>)}
            {x.avisos.map((r) => <li key={r} data-tipo="ojo">{r}</li>)}
          </ul>
          <Boton tipo={k === 0 ? 'principal' : undefined} disabled={!!ocupado} onClick={() => void asignar(x.id)}>
            {ocupado === x.id ? 'Asignando…' : `Asignar a ${x.nombre.split(' ')[0]}`}
          </Boton>
        </div>
      ))}
      <p className="fx-texto-3 pan-nota">
        ¿Nadie tiene cupo para todos? Reparte la ficha entre varios instructores, aprendiz por aprendiz, desde{' '}
        <Link to={rutaFicha}>el detalle de la ficha</Link>.
      </p>
    </div>
  )
}
