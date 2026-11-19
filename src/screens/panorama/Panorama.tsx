// Panorama (PLAN_REDISENO, Fase 9): una sola pantalla para los tres niveles.
//   Regional:     los 4 centros lado a lado.
//   Centro:       sus coordinaciones lado a lado, con la capacidad del centro.
//   Coordinación: lo que viene por instructor, la tabla de instructores y las
//                 fichas por entrar sin instructor.
// Se baja de nivel con un clic y se sube con la ruta de arriba. Lo que se ve
// lo acota el backend al alcance de quien entra.
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../lib/api'
import { useAuthStore } from '../../store/auth'
import { Lienzo, Frase, Estado, Panel, Boton } from '../../ui'
import { fdia } from '../../ui/estados'
import type { Tono } from '../../ui/estados'
import { Medidor, MesesCapacidad } from './comun'
import { miles } from './formato'
import type { Mes } from './formato'
import './panorama.css'

interface Ind {
  aprendices: number; atrasados: number; le_toca: number; urgentes: number; esta_semana: number
  momentos_hechos: number; momentos_en_plazo: number; con_ubicacion: number; en_sitio: number
  bitacoras_esperadas: number; bitacoras_entregadas: number; bitacoras_al_dia: number
  bitacoras_leidas: number; bitacoras_sin_leer: number; sin_leer_viejas: number
}
interface Proximo {
  id: string; grupo: 'URGENTE' | 'TE_TOCA'; categoria: string; texto: string; fecha: string | null
  etapa_id: number | null; ficha_id: number | null; numero_ficha: string | null; tab: string | null; aprendiz: string
}
interface InstructorP {
  id: string; nombre: string; coordinacion_id: number | null; coordinacion: string | null; centro_id: number | null
  cupo: number | null; carga: number; ind: Ind; proximos: Proximo[]
}
interface Grupo {
  id: number; nombre: string; centro_id?: number; ind: Ind; frase: string
  instructores: number; cupos: number; carga: number; fichas_sin_instructor: number; fichas_pronto: number
}
interface Datos {
  hoy: string; total: Ind
  capacidad: {
    cupos: number; meses: Mes[]; fichas_sin_instructor: number; fichas_pronto: number
    ya_en_practica_sin_instructor: number; primer_mes_sin_cupo: Mes | null
    proximas: { id: number; numero_ficha: string; programa: string | null; inicio: string; dias: number; aprendices: number }[]
  }
  instructores: InstructorP[]; coordinaciones: Grupo[]; centros: Grupo[]
}

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : null)

export function Panorama({ rutaEtapa, rutaAsignacion, rutaAlertas }: {
  rutaEtapa: (fichaId: number, etapaId: number, tab?: string | null) => string
  rutaAsignacion: string
  rutaAlertas?: string
}) {
  const user = useAuthStore((s) => s.user)
  const rol = user?.rol
  const [centro, setCentro] = useState<Grupo | null>(null)
  const [coord, setCoord] = useState<Grupo | null>(null)
  const [d, setD] = useState<Datos | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const cargar = useCallback(() => {
    const q = new URLSearchParams()
    if (centro) q.set('centro_id', String(centro.id))
    if (coord) q.set('coordinacion_id', String(coord.id))
    api.get<Datos>(`/panorama?${q}`)
      .then((r) => { setD(r.data); setErr(null) })
      .catch((e) => setErr(e?.response?.data?.message ?? 'No se pudo armar el panorama.'))
  }, [centro, coord])
  useEffect(cargar, [cargar])

  if (err) return <Lienzo><Frase tono="atraso">{err}</Frase></Lienzo>
  if (!d) return <Lienzo><p className="fx-texto-3">Armando el panorama…</p></Lienzo>

  const nivel: 'REGIONAL' | 'CENTRO' | 'COORDINACION' =
    rol === 'COORD_ACADEMICO' || coord ? 'COORDINACION' : rol === 'SUBDIRECTOR' || centro ? 'CENTRO' : 'REGIONAL'
  const titulo = nivel === 'COORDINACION'
    ? (coord?.nombre ?? d.coordinaciones[0]?.nombre ?? 'Mi coordinación')
    : nivel === 'CENTRO' ? (centro?.nombre ?? d.centros[0]?.nombre ?? 'Mi centro')
    : 'Regional Atlántico'

  const t = d.total
  const cap = d.capacidad
  const frase = [
    t.aprendices
      ? `${miles(t.aprendices)} aprendices en etapa productiva con FORMA${t.atrasados ? `; ${t.atrasados} van atrasados` : ', todos al día en sus momentos'}.`
      : 'Todavía no hay etapas productivas registradas en FORMA.',
    t.bitacoras_sin_leer ? `${t.bitacoras_sin_leer} bitácoras esperan lectura.` : '',
    cap.fichas_sin_instructor ? `${miles(cap.ya_en_practica_sin_instructor)} fichas ya en práctica y ${miles(cap.fichas_sin_instructor - cap.ya_en_practica_sin_instructor)} por entrar no tienen instructor.` : '',
    cap.primer_mes_sin_cupo ? cap.primer_mes_sin_cupo.frase : '',
  ].filter(Boolean).join(' ')

  const migas = (
    <nav className="pan-migas" aria-label="Nivel">
      {rol === 'SUPER_ADMIN' && (
        <button type="button" disabled={!centro && !coord} onClick={() => { setCentro(null); setCoord(null) }}>Regional</button>
      )}
      {(centro || rol === 'SUBDIRECTOR') && rol !== 'COORD_ACADEMICO' && (
        <button type="button" disabled={!coord} onClick={() => setCoord(null)}>{centro?.nombre ?? 'Mi centro'}</button>
      )}
      {coord && <button type="button" disabled>{coord.nombre}</button>}
    </nav>
  )

  return (
    <Lienzo className="pan">
      <header className="pan-cab">
        <div>
          {rol !== 'COORD_ACADEMICO' && migas}
          <div className="fx-eyebrow">{nivel === 'COORDINACION' ? 'Coordinación' : nivel === 'CENTRO' ? 'Centro de formación' : 'Dirección regional'} · {fdia(d.hoy)}</div>
          <h1 className="fx-titulo">{titulo}</h1>
        </div>
        <div className="pan-filtros">
          {rutaAlertas && <Link className="fx-boton" data-tipo="suave" to={rutaAlertas}>Alertas</Link>}
          <Link className="fx-boton" to={rutaAsignacion}>Asignación de instructores</Link>
        </div>
      </header>

      <Frase tono={t.atrasados || cap.fichas_pronto ? 'atraso' : undefined}>{frase}</Frase>

      <Cifras t={t} cap={cap}/>

      {nivel === 'REGIONAL' && (
        <Panel titulo="Los centros" sinCuerpo>
          <Tarjetas grupos={d.centros} onAbrir={(g) => setCentro(g)} que="centro"/>
        </Panel>
      )}
      {nivel === 'CENTRO' && (
        <Panel titulo="Las coordinaciones" sinCuerpo>
          <Tarjetas grupos={d.coordinaciones} onAbrir={(g) => setCoord(g)} que="coordinación"/>
        </Panel>
      )}
      {nivel === 'COORDINACION' && (
        <>
          <Panel titulo="Lo que viene, por instructor" accion={<span className="fx-texto-3">Lo atrasado primero</span>}>
            <LoQueViene instructores={d.instructores} rutaEtapa={rutaEtapa}/>
          </Panel>
          {cap.proximas.length > 0 && (
            <Panel titulo="Fichas por entrar sin instructor" accion={<Link className="fx-boton" data-tipo="suave" to={rutaAsignacion}>Asignar</Link>}>
              <ul className="pan-lista">
                {cap.proximas.map((f) => (
                  <li key={f.id}>
                    <Estado tono={f.dias <= 15 ? 'aviso' : 'futuro'}>{f.dias === 0 ? 'hoy' : `en ${f.dias} días`}</Estado>
                    <span><strong className="fx-num">{f.numero_ficha}</strong> · {f.programa ?? '—'}</span>
                    <span className="fx-texto-3 fx-num">{f.aprendices} aprendices · {fdia(f.inicio)}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </>
      )}

      <Panel titulo="Instructores" accion={<span className="fx-texto-3">Ordenados por lo que tienen pendiente</span>}>
        <TablaInstructores lista={d.instructores} conCoord={nivel !== 'COORDINACION'}/>
      </Panel>

      <Panel titulo="Capacidad los próximos 3 meses" accion={<span className="fx-texto-3">{miles(cap.cupos)} cupos</span>}>
        <MesesCapacidad meses={cap.meses}/>
      </Panel>
    </Lienzo>
  )
}

function Cifras({ t, cap }: { t: Ind; cap: Datos['capacidad'] }) {
  const items: { k: string; v: string; tono?: Tono; nota?: string }[] = [
    { k: 'Aprendices', v: miles(t.aprendices), nota: 'en etapa productiva' },
    { k: 'Atrasados', v: miles(t.atrasados), tono: t.atrasados ? 'atraso' : undefined, nota: 'algún momento vencido' },
    { k: 'Por hacer ya', v: miles(t.esta_semana), nota: 'momentos con ventana abierta' },
    { k: 'Bitácoras sin leer', v: miles(t.bitacoras_sin_leer), tono: t.sin_leer_viejas ? 'atraso' : undefined, nota: t.sin_leer_viejas ? `${t.sin_leer_viejas} aprendices esperan hace más de 5 días` : 'por el instructor' },
    { k: 'Fichas sin instructor', v: miles(cap.fichas_sin_instructor), tono: cap.fichas_pronto ? 'atraso' : undefined, nota: cap.fichas_pronto ? `${cap.fichas_pronto} empiezan en 15 días o menos` : 'en práctica o por entrar' },
  ]
  return (
    <div className="pan-cifras">
      {items.map((i) => (
        <div key={i.k} className="pan-cifra">
          <span className="k">{i.k}</span>
          <span className="v fx-num" data-tono={i.tono}>{i.v}</span>
          {i.nota && <span className="n">{i.nota}</span>}
        </div>
      ))}
    </div>
  )
}

function Tarjetas({ grupos, onAbrir, que }: { grupos: Grupo[]; onAbrir: (g: Grupo) => void; que: string }) {
  if (!grupos.length) return <p className="fx-texto-3" style={{ padding: 16 }}>No hay {que} en este ámbito.</p>
  const orden = [...grupos].sort((a, b) => b.ind.atrasados - a.ind.atrasados || b.fichas_pronto - a.fichas_pronto || b.ind.aprendices - a.ind.aprendices || a.nombre.localeCompare(b.nombre))
  return (
    <div className="pan-tarjetas">
      {orden.map((g) => {
        const leidas = pct(g.ind.bitacoras_leidas, g.ind.bitacoras_entregadas)
        return (
          <button key={g.id} type="button" className="pan-tarjeta" onClick={() => onAbrir(g)}>
            <span className="pan-tarjeta-nombre">{g.nombre}</span>
            <span className="fx-texto-2 pan-tarjeta-frase">{g.frase.replace(`${g.nombre}: `, '').replace(`${g.nombre} `, '')}</span>
            <span className="pan-tarjeta-datos">
              <span><b className="fx-num">{miles(g.ind.aprendices)}</b> aprendices</span>
              <span><b className="fx-num" data-tono={g.ind.atrasados ? 'atraso' : undefined}>{g.ind.atrasados}</b> atrasados</span>
              <span><b className="fx-num">{leidas == null ? '—' : `${leidas}%`}</b> bitácoras leídas</span>
              <span><b className="fx-num" data-tono={g.fichas_pronto ? 'atraso' : undefined}>{g.fichas_sin_instructor}</b> fichas sin instructor</span>
            </span>
            <span className="pan-tarjeta-cap">
              <Medidor carga={g.carga} cupo={g.cupos}/>
              <span className="fx-texto-3 fx-num">{miles(g.carga)} de {miles(g.cupos)} cupos · {g.instructores} instructores</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

function LoQueViene({ instructores, rutaEtapa }: { instructores: InstructorP[]; rutaEtapa: (f: number, e: number, tab?: string | null) => string }) {
  const con = instructores.filter((i) => i.proximos.length).sort((a, b) => b.ind.urgentes - a.ind.urgentes || b.proximos.length - a.proximos.length)
  if (!con.length) return <p className="fx-texto-3">Nada atrasado ni por hacer esta semana.</p>
  return (
    <div className="pan-viene">
      {con.map((i) => (
        <div key={i.id} className="pan-viene-inst">
          <div className="pan-viene-cab">
            <strong>{i.nombre}</strong>
            <span className="fx-texto-3">{i.ind.urgentes ? `${i.ind.urgentes} atrasado${i.ind.urgentes > 1 ? 's' : ''} · ` : ''}{i.ind.aprendices} aprendices</span>
          </div>
          <ul className="pan-lista">
            {i.proximos.map((p) => (
              <li key={p.id}>
                <Estado tono={p.grupo === 'URGENTE' ? 'atraso' : 'toca'}>{p.grupo === 'URGENTE' ? 'Atrasado' : 'Esta semana'}</Estado>
                <span>
                  {p.etapa_id && p.ficha_id
                    ? <Link to={rutaEtapa(p.ficha_id, p.etapa_id, p.tab)}><strong>{p.aprendiz}</strong></Link>
                    : <strong>{p.aprendiz}</strong>}
                  <span className="fx-texto-2"> · {p.texto}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function Fraccion({ a, b, bajo }: { a: number; b: number; bajo?: number }) {
  if (!b) return <span className="fx-texto-3">—</span>
  const p = Math.round((a / b) * 100)
  return <span className="fx-num" data-tono={bajo != null && p < bajo ? 'atraso' : undefined} title={`${a} de ${b}`}>{p}%<span className="fx-texto-3"> · {a}/{b}</span></span>
}

function TablaInstructores({ lista, conCoord }: { lista: InstructorP[]; conCoord: boolean }) {
  const [todos, setTodos] = useState(false)
  const orden = [...lista].sort((a, b) =>
    b.ind.urgentes - a.ind.urgentes || b.ind.bitacoras_sin_leer - a.ind.bitacoras_sin_leer || b.ind.aprendices - a.ind.aprendices || a.nombre.localeCompare(b.nombre))
  const conAlgo = orden.filter((i) => i.ind.aprendices || i.carga)
  const visibles = todos ? orden : conAlgo
  return (
    <>
      <div className="fx-tabla-envoltura">
        <table className="fx-tabla pan-tabla pan-tabla-inst">
          <thead>
            <tr>
              <th>Instructor</th><th>Carga</th><th>Esta semana</th><th>Atrasos</th>
              <th>Momentos en plazo</th><th>Firmas en sitio</th><th>Bitácoras al día</th><th>Leídas</th>
            </tr>
          </thead>
          <tbody>
            {visibles.length === 0 && <tr><td colSpan={8} className="fx-texto-3">Ningún instructor tiene aprendices todavía.</td></tr>}
            {visibles.map((i) => (
              <tr key={i.id}>
                <td>
                  <div className="pan-prog">{i.nombre}</div>
                  {conCoord && i.coordinacion && <div className="fx-texto-3">{i.coordinacion}</div>}
                </td>
                <td>
                  {i.cupo != null ? (
                    <span className="pan-carga"><Medidor carga={i.carga} cupo={i.cupo}/><span className="fx-num fx-texto-2">{i.carga}/{i.cupo}</span></span>
                  ) : <span className="fx-texto-3">otra coordinación</span>}
                </td>
                <td className="fx-num">{i.ind.esta_semana || <span className="fx-texto-3">0</span>}</td>
                <td className="fx-num">{i.ind.urgentes ? <Estado tono="atraso">{i.ind.urgentes}</Estado> : <span className="fx-texto-3">0</span>}</td>
                <td><Fraccion a={i.ind.momentos_en_plazo} b={i.ind.momentos_hechos} bajo={80}/></td>
                <td><Fraccion a={i.ind.en_sitio} b={i.ind.con_ubicacion} bajo={80}/></td>
                <td><Fraccion a={i.ind.bitacoras_al_dia} b={i.ind.bitacoras_esperadas} bajo={70}/></td>
                <td><Fraccion a={i.ind.bitacoras_leidas} b={i.ind.bitacoras_entregadas} bajo={70}/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {orden.length > conAlgo.length && (
        <div style={{ marginTop: 10 }}>
          <Boton tipo="suave" onClick={() => setTodos(!todos)}>
            {todos ? 'Solo los que tienen aprendices' : `Ver también los ${orden.length - conAlgo.length} sin aprendices`}
          </Boton>
        </div>
      )}
    </>
  )
}
