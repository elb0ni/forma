// Inicio (PLAN_REDISENO v3, Fase 14): la única pantalla con cifras. Une el
// Dashboard (las fichas por fase y cuándo cierran) y el Panorama (el
// seguimiento, la comparación y la capacidad). El ámbito se elige arriba
// (centro y coordinación) y un clic en una fila de la comparación lo acota.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../lib/api'
import { useAuthStore } from '../../store/auth'
import { useAmbito } from '../../store/ambito'
import type { FichaRow } from '../shared/FichasAdmin'
import { ResumenFichas } from '../superadmin/DashboardHome'
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


export function Panorama({ rutaEtapa, rutaAsignacion, rutaAlertas, onOpenFicha }: {
  rutaEtapa: (fichaId: number, etapaId: number, tab?: string | null) => string
  rutaAsignacion: string
  rutaAlertas?: string
  onOpenFicha?: (id: number) => void
}) {
  const user = useAuthStore((s) => s.user)
  const rol = user?.rol
  const amb = useAmbito()
  // El coordinador no elige: el backend lo acota a su coordinación.
  const centroId = rol === 'SUPER_ADMIN' ? amb.centroId : null
  const coordId = rol === 'SUPER_ADMIN' || rol === 'SUBDIRECTOR' ? amb.coordId : null
  const [d, setD] = useState<Datos | null>(null)
  const [fichas, setFichas] = useState<FichaRow[] | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const cargar = useCallback(() => {
    const q = new URLSearchParams()
    if (centroId) q.set('centro_id', String(centroId))
    if (coordId) q.set('coordinacion_id', String(coordId))
    api.get<Datos>(`/panorama?${q}`)
      .then((r) => { setD(r.data); setErr(null) })
      .catch((e) => setErr(e?.response?.data?.message ?? 'No se pudo armar el inicio.'))
  }, [centroId, coordId])
  useEffect(cargar, [cargar])
  useEffect(() => {
    api.get<FichaRow[]>('/fichas').then((r) => setFichas(r.data)).catch(() => setFichas([]))
  }, [])

  const fichasAmbito = useMemo(() => (fichas ?? []).filter((f) =>
    (!centroId || f.centro_formacion_id === centroId) && (!coordId || f.coordinacion_academica_id === coordId)), [fichas, centroId, coordId])

  if (err) return <Lienzo><Frase tono="atraso">{err}</Frase></Lienzo>
  if (!d) return <Lienzo><p className="fx-texto-3">Armando el inicio…</p></Lienzo>

  const nivel: 'REGIONAL' | 'CENTRO' | 'COORDINACION' =
    rol === 'COORD_ACADEMICO' || coordId ? 'COORDINACION' : rol === 'SUBDIRECTOR' || centroId ? 'CENTRO' : 'REGIONAL'
  const titulo = nivel === 'COORDINACION'
    ? (d.coordinaciones.find((c) => c.id === coordId)?.nombre ?? d.coordinaciones[0]?.nombre ?? 'Mi coordinación')
    : nivel === 'CENTRO' ? (d.centros[0]?.nombre ?? 'Mi centro')
    : 'Regional Atlántico'

  const t = d.total
  const cap = d.capacidad
  const frase = [
    t.aprendices
      ? `${miles(t.aprendices)} aprendices en etapa productiva con FORMA${t.atrasados ? `; ${t.atrasados} van atrasados` : ', todos al día en sus momentos'}.`
      : 'Todavía no hay etapas productivas registradas en FORMA.',
    t.bitacoras_sin_leer ? `${t.bitacoras_sin_leer} bitácoras esperan lectura.` : '',
    cap.fichas_sin_instructor ? `${miles(cap.ya_en_practica_sin_instructor)} fichas ya en etapa productiva y ${miles(cap.fichas_sin_instructor - cap.ya_en_practica_sin_instructor)} por entrar no tienen instructor.` : '',
    cap.primer_mes_sin_cupo ? cap.primer_mes_sin_cupo.frase : '',
  ].filter(Boolean).join(' ')

  const filas = nivel === 'REGIONAL' ? d.centros : nivel === 'CENTRO' ? d.coordinaciones : []
  const bajar = (g: Grupo) => {
    if (nivel === 'REGIONAL') amb.setCentro(g.id)
    else if (nivel === 'CENTRO') amb.setCoord(g.id)
  }

  return (
    <Lienzo className="pan">
      <header className="pan-cab">
        <div>
          <div className="fx-eyebrow">{nivel === 'COORDINACION' ? 'Coordinación' : nivel === 'CENTRO' ? 'Centro de formación' : 'Dirección regional'} · {fdia(d.hoy)}</div>
          <h1 className="fx-titulo">{titulo}</h1>
        </div>
        <div className="pan-filtros">
          {rutaAlertas && <Link className="fx-boton" data-tipo="suave" to={rutaAlertas}>Alertas</Link>}
          <Link className="fx-boton" data-tipo="principal" to={rutaAsignacion}>Asignar instructores</Link>
        </div>
      </header>

      <Frase tono={t.atrasados || cap.fichas_pronto ? 'atraso' : undefined}>{frase}</Frase>

      <Cifras t={t} cap={cap}/>

      {fichas && fichasAmbito.length > 0 && (
        <section className="pan-seccion">
          <h2 className="fx-subtitulo">Las fichas</h2>
          <ResumenFichas todas={fichasAmbito} filtradas={fichasAmbito} onOpenFicha={onOpenFicha}/>
        </section>
      )}

      {filas.length > 0 && (
        <Panel titulo={nivel === 'REGIONAL' ? 'Cómo va cada centro' : 'Cómo va cada coordinación'} accion={<span className="fx-texto-3">Clic en una fila para verla</span>}>
          <Comparacion total={t} cap={cap} nombreTotal={titulo} grupos={filas} onElegir={bajar}/>
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

function Comparacion({ total, cap, nombreTotal, grupos, onElegir }: {
  total: Ind; cap: Datos['capacidad']; nombreTotal: string; grupos: Grupo[]; onElegir: (g: Grupo) => void
}) {
  const orden = [...grupos].sort((a, b) => b.ind.atrasados - a.ind.atrasados || b.ind.aprendices - a.ind.aprendices || a.nombre.localeCompare(b.nombre))
  const corto = (n: string) => n.replace(/^Coordinaci[oó]n Acad[eé]mica de /i, '')
  const celdas = (ind: Ind, sinInstr: number, pronto: number, carga: number, cupos: number) => (
    <>
      <td className="fx-num">{miles(ind.aprendices)}</td>
      <td className="fx-num">{ind.atrasados ? <Estado tono="atraso">{ind.atrasados}</Estado> : <span className="fx-texto-3">0</span>}</td>
      <td><Fraccion a={ind.momentos_en_plazo} b={ind.momentos_hechos} bajo={80}/></td>
      <td><Fraccion a={ind.bitacoras_al_dia} b={ind.bitacoras_esperadas} bajo={70}/></td>
      <td className="fx-num" data-tono={ind.sin_leer_viejas ? 'atraso' : undefined}>{ind.bitacoras_sin_leer}</td>
      <td className="fx-num" data-tono={pronto ? 'atraso' : undefined}>{miles(sinInstr)}</td>
      <td><span className="pan-carga"><Medidor carga={carga} cupo={cupos}/><span className="fx-num fx-texto-2">{miles(carga)}/{miles(cupos)}</span></span></td>
    </>
  )
  const cargaTotal = grupos.reduce((s, g) => s + g.carga, 0)
  return (
    <div className="fx-tabla-envoltura">
      <table className="fx-tabla pan-tabla pan-comparacion">
        <thead>
          <tr><th></th><th>Aprendices</th><th>Atrasados</th><th>Momentos en plazo</th><th>Bitácoras al día</th><th>Sin leer</th><th>Fichas sin instructor</th><th>Carga / cupos</th></tr>
        </thead>
        <tbody>
          <tr className="pan-fila-total"><td>{nombreTotal}</td>{celdas(total, cap.fichas_sin_instructor, cap.fichas_pronto, cargaTotal, cap.cupos)}</tr>
          {orden.map((g) => (
            <tr key={g.id} className="pan-fila-clic" tabIndex={0} onClick={() => onElegir(g)} onKeyDown={(e) => { if (e.key === 'Enter') onElegir(g) }}>
              <td className="pan-prog">{corto(g.nombre)}</td>
              {celdas(g.ind, g.fichas_sin_instructor, g.fichas_pronto, g.carga, g.cupos)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
