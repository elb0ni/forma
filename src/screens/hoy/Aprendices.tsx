// "Aprendices" del instructor: los que faltan por registrar, y una sola lista
// agrupada por ficha con la línea mini de cada aprendiz (3 momentos y sus
// bitácoras) y su próximo paso. "Terminados" muestra las etapas cerradas.
import { useEffect, useMemo, useState } from 'react'
import api from '../../lib/api'
import { useAuthStore } from '../../store/auth'
import { Lienzo, Frase, Estado, Boton, LineaMini } from '../../ui'
import { fdia } from '../../ui/estados'
import type { EstadoAprendiz, PendientesInstructor, TabEtapa } from '../instructor/types'
import type { EtapaProductiva } from '../productiva/types'
import { FILTROS, SITUACION, lineaMiniDe, plural, resumenBitacoras } from './comun'
import type { Filtro } from './comun'
import { PorRegistrar } from './PorRegistrar'
import { PedirFicha } from './PedirFicha'
import './hoy.css'


const porLeer = (a: EstadoAprendiz) => (a.bitacoras ?? []).some((b) => b.estado === 'SIN_LEER')
const cumple = (a: EstadoAprendiz, f: Filtro) =>
  f === 'TODOS' ? true
    : f === 'POR_LEER' ? porLeer(a)
    : f === 'AL_DIA' ? a.situacion === 'AL_DIA' || a.situacion === 'COMPLETO'
    : a.situacion === f

export function Aprendices({ onAbrir, onRegistrar, onFicha, fichaFoco, filtroInicial }: {
  onAbrir: (etapaId: number, tab?: TabEtapa | null) => void
  onFicha?: (fichaId: number) => void
  onRegistrar: (aprendizId: number) => void
  fichaFoco?: number | null
  filtroInicial?: Filtro
}) {
  const user = useAuthStore((s) => s.user)
  const [d, setD] = useState<PendientesInstructor | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<Filtro>(filtroInicial ?? 'TODOS')
  const [buscar, setBuscar] = useState('')
  const [pedir, setPedir] = useState(false)
  const [terminadas, setTerminadas] = useState<EtapaProductiva[] | null>(null)

  useEffect(() => {
    let vivo = true
    api.get<PendientesInstructor>('/instructores/mi/pendientes')
      .then((r) => { if (vivo) setD(r.data) })
      .catch((e) => { if (vivo) setErr(e?.response?.data?.message ?? 'No se pudieron cargar tus aprendices.') })
    return () => { vivo = false }
  }, [])

  // Las etapas terminadas no vienen en los pendientes: se piden al abrir el filtro.
  useEffect(() => {
    if (filtro !== 'TERMINADOS' || terminadas || !user) return
    api.get<EtapaProductiva[]>(`/etapas-productivas?instructor_id=${user.id}`)
      .then((r) => setTerminadas(r.data.filter((e) => e.estado === 'TERMINADA')))
      .catch(() => setTerminadas([]))
  }, [filtro, terminadas, user])

  // Si se llegó desde un aviso de Hoy, se baja a la ficha de ese aviso.
  useEffect(() => {
    if (!d || !fichaFoco) return
    document.getElementById(`por-registrar-${fichaFoco}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [d, fichaFoco])

  const lista = useMemo(() => {
    const q = buscar.trim().toLowerCase()
    return (d?.aprendices ?? []).filter((a) => cumple(a, filtro) && (!q
      || a.aprendiz_nombre.toLowerCase().includes(q)
      || a.numero_ficha.includes(q)
      || (a.empresa_nombre ?? '').toLowerCase().includes(q)))
  }, [d, filtro, buscar])

  const fichas = useMemo(() => {
    const m = new Map<string, EstadoAprendiz[]>()
    for (const a of lista) m.set(a.numero_ficha, [...(m.get(a.numero_ficha) ?? []), a])
    return [...m].sort(([x], [y]) => x.localeCompare(y))
  }, [lista])

  if (err) return <Lienzo><Frase tono="atraso">{err}</Frase></Lienzo>
  if (!d) return <Lienzo><p className="fx-texto-3">Cargando tus aprendices…</p></Lienzo>

  const todos = d.aprendices
  const nFichas = new Set(todos.map((a) => a.numero_ficha)).size
  const atrasados = todos.filter((a) => a.situacion === 'ATRASADO').length
  const leTocan = todos.filter((a) => a.situacion === 'LE_TOCA').length
  const conLectura = todos.filter(porLeer).length

  const partes = [
    atrasados && plural(atrasados, 'está atrasado', 'están atrasados'),
    leTocan && `a ${plural(leTocan, 'le toca', 'les toca')} algo ya`,
    conLectura && `${plural(conLectura, 'tiene', 'tienen')} bitácoras por leer`,
  ].filter(Boolean) as string[]

  return (
    <Lienzo className="apr">
      <header className="hoy-cab">
        <div>
          <div className="fx-eyebrow">{plural(todos.length, 'aprendiz', 'aprendices')} en etapa productiva · {plural(nFichas, 'ficha', 'fichas')}</div>
          <h1 className="fx-titulo">Aprendices</h1>
        </div>
        <div className="hoy-acciones">
          <Boton onClick={() => setPedir(true)}>Pedir una ficha</Boton>
        </div>
      </header>

      {todos.length > 0 && (
        <Frase tono={atrasados ? 'atraso' : partes.length ? undefined : 'ok'}>
          {partes.length ? `De tus ${todos.length}: ${partes.join(', ').replace(/, ([^,]*)$/, ' y $1')}.` : 'Todos tus aprendices están al día.'}
        </Frase>
      )}
      <PorRegistrar
        listos={d.por_registrar ?? []} sinHabilitar={d.sin_habilitar ?? []}
        fichaFoco={fichaFoco ?? null} onRegistrar={onRegistrar}
      />
      <PedirFicha abierto={pedir} onCerrar={() => setPedir(false)}/>

      <div className="apr-filtros">
        <div className="apr-chips" role="tablist">
          {FILTROS.map((f) => (
            <button
              key={f.id} type="button" role="tab" aria-selected={filtro === f.id}
              className="apr-chip" data-activo={filtro === f.id || undefined}
              onClick={() => setFiltro(f.id)}
            >
              {f.texto}
              {f.id !== 'TERMINADOS' && <span className="fx-num">{todos.filter((a) => cumple(a, f.id)).length}</span>}
            </button>
          ))}
        </div>
        <input
          className="apr-buscar" type="search" placeholder="Buscar aprendiz, ficha o empresa"
          value={buscar} onChange={(e) => setBuscar(e.target.value)}
        />
      </div>

      {filtro === 'TERMINADOS' ? <Terminados etapas={terminadas} buscar={buscar} onAbrir={onAbrir}/> : (
      <div className="fx-panel">
        <div className="fx-tabla-envoltura">
          <table className="fx-tabla apr-tabla">
            <thead>
              <tr><th>Aprendiz</th><th>Momentos y bitácoras</th><th>Próximo paso</th><th>Bitácoras</th><th>Termina</th></tr>
            </thead>
            <tbody>
              {fichas.length === 0 && (
                <tr><td colSpan={5} className="fx-texto-3" style={{ padding: 20 }}>
                  {todos.length ? 'Nadie cumple ese filtro.' : 'Aún no tienes aprendices en etapa productiva.'}
                </td></tr>
              )}
              {fichas.map(([ficha, l]) => [
                <tr key={`g-${ficha}`} className="fx-grupo">
                  <td colSpan={5}>
                    Ficha {ficha}{l[0].programa_nombre ? ` · ${l[0].programa_nombre}` : ''} · {plural(l.length, 'aprendiz', 'aprendices')}
                    {onFicha && l[0].ficha_id != null && (
                      <> · <button type="button" className="hoy-enlace" onClick={() => onFicha(l[0].ficha_id!)}>ver la ficha</button></>
                    )}
                  </td>
                </tr>,
                ...l.map((a) => {
                  const s = SITUACION[a.situacion]
                  const b = resumenBitacoras(a)
                  const mini = lineaMiniDe(a)
                  return (
                    <tr key={a.etapa_id} className="fx-fila" onClick={() => onAbrir(a.etapa_id, a.tab)} tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter') onAbrir(a.etapa_id, a.tab) }}>
                      <td>
                        <div className="apr-nombre">{a.aprendiz_nombre}</div>
                        {a.empresa_nombre && <div className="fx-texto-3">{a.empresa_nombre}</div>}
                      </td>
                      <td><LineaMini momentos={mini.momentos} bitacoras={mini.bitacoras}/></td>
                      <td><Estado tono={s.tono}>{a.resumen}</Estado></td>
                      <td>{b.tono === 'neutro' ? <span className="fx-texto-3">{b.texto}</span> : <Estado tono={b.tono}>{b.texto}</Estado>}</td>
                      <td className="fx-num fx-texto-2">{fdia(a.fin)}</td>
                    </tr>
                  )
                }),
              ])}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </Lienzo>
  )
}

const RESULTADO = {
  APROBADO: { tono: 'hecho', texto: 'Aprobó' },
  NO_APROBADO: { tono: 'atraso', texto: 'No aprobó' },
} as const

function Terminados({ etapas, buscar, onAbrir }: {
  etapas: EtapaProductiva[] | null; buscar: string; onAbrir: (etapaId: number, tab?: TabEtapa | null) => void
}) {
  if (!etapas) return <p className="fx-texto-3">Cargando las etapas terminadas…</p>
  const q = buscar.trim().toLowerCase()
  const lista = etapas
    .filter((e) => !q || (e.aprendiz_nombre ?? '').toLowerCase().includes(q) || (e.numero_ficha ?? '').includes(q)
      || (e.empresa_nombre ?? '').toLowerCase().includes(q))
    .sort((a, b) => (b.fecha_fin_real ?? b.fecha_fin_estimada).localeCompare(a.fecha_fin_real ?? a.fecha_fin_estimada))
  return (
    <div className="fx-panel">
      <div className="fx-tabla-envoltura">
        <table className="fx-tabla apr-tabla">
          <thead><tr><th>Aprendiz</th><th>Ficha</th><th>Resultado</th><th>Terminó</th></tr></thead>
          <tbody>
            {lista.length === 0 && (
              <tr><td colSpan={4} className="fx-texto-3" style={{ padding: 20 }}>
                {etapas.length ? 'Nadie cumple esa búsqueda.' : 'Todavía no tienes etapas terminadas.'}
              </td></tr>
            )}
            {lista.map((e) => {
              const r = e.resultado_final ? RESULTADO[e.resultado_final] : null
              return (
                <tr key={e.id} className="fx-fila" tabIndex={0}
                  onClick={() => onAbrir(e.id, r ? null : 'evaluacion')}
                  onKeyDown={(ev) => { if (ev.key === 'Enter') onAbrir(e.id, r ? null : 'evaluacion') }}>
                  <td>
                    <div className="apr-nombre">{e.aprendiz_nombre}</div>
                    {e.empresa_nombre && <div className="fx-texto-3">{e.empresa_nombre}</div>}
                  </td>
                  <td className="fx-num fx-texto-2">{e.numero_ficha}</td>
                  <td>{r ? <Estado tono={r.tono}>{r.texto}</Estado> : <Estado tono="aviso">Falta el resultado</Estado>}</td>
                  <td className="fx-num fx-texto-2">{fdia(e.fecha_fin_real ?? e.fecha_fin_estimada)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
