// Panel "Asignar" (PLAN_REDISENO v3, Fase 15). El mismo desde la cola de
// Asignación y desde la página de la ficha. Tres formas sobre una ficha:
//   · Toda la ficha        → un instructor para todos (lo normal)
//   · Aprendices sueltos   → se marcan y se eligen; mandan sobre la ficha
//   · Repartir             → FORMA propone dividirla según los cupos libres
// (La cuarta, liberar a un instructor, está en la tabla de instructores.)
// Siempre se ve el efecto en los cupos antes de confirmar.
import { useCallback, useEffect, useMemo, useState } from 'react'
import api from '../../lib/api'
import { Estado, Boton } from '../../ui'
import { fdia } from '../../ui/estados'
import { Medidor } from './comun'

interface Persona { id: string; nombre: string }
interface AprendizQ {
  numero_documento: string; nombre: string; aprendiz_id: number | null; estado_sofia: string | null
  individual: { asignacion_id: number; desde: string | null } | null
  instructor: Persona | null
  etapa: { id: number; estado: string; instructor: string | null } | null
}
interface Quien {
  ficha: { id: number; numero_ficha: string; programa: string | null }
  instructor_ficha: (Persona & { desde: string | null }) | null
  aprendices: AprendizQ[]
  historial: { tipo: 'FICHA' | 'APRENDIZ'; aprendiz: string | null; instructor: string; desde: string | null; hasta: string | null; activa: boolean; por: string | null }[]
  solicitudes: { id: number; instructor_id: string; instructor: string; nota: string | null; fecha: string | null }[]
}
interface Sugerencia { id: string; nombre: string; coordinacion: string | null; cupo: number; carga: number; libre: number; razones: string[]; avisos: string[] }
interface Reparto {
  aprendices: number; alcanza: boolean
  grupos: { instructor_id: string; instructor: string; libre: number; aprendices: { numero_documento: string; aprendiz_nombre: string; aprendiz_id: number | null }[] }[]
}
type Modo = 'FICHA' | 'SUELTOS' | 'REPARTIR'

const msg = (e: unknown, d: string) => (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? d
const pl = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

export function AsignarPanel({ fichaId, onCambio }: { fichaId: number; onCambio?: () => void }) {
  const [q, setQ] = useState<Quien | null>(null)
  const [sug, setSug] = useState<Sugerencia[] | null>(null)
  const [modo, setModo] = useState<Modo>('FICHA')
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [marcados, setMarcados] = useState<Set<string>>(new Set())
  const [destino, setDestino] = useState<string>('')
  const [reparto, setReparto] = useState<Reparto | null>(null)
  const [verHist, setVerHist] = useState(false)

  const cargar = useCallback(() => {
    api.get<Quien>(`/asignar/ficha/${fichaId}`).then((r) => setQ(r.data)).catch((e) => setErr(msg(e, 'No se pudo leer la ficha.')))
    api.get<{ sugerencias: Sugerencia[] }>(`/capacidad/sugerencias?ficha_id=${fichaId}`).then((r) => setSug(r.data.sugerencias)).catch(() => setSug([]))
  }, [fichaId])
  useEffect(cargar, [cargar])
  useEffect(() => {
    if (modo !== 'REPARTIR') return
    let vivo = true
    api.get<Reparto>(`/asignar/repartir/${fichaId}`).then((r) => { if (vivo) setReparto(r.data) }).catch((e) => { if (vivo) setErr(msg(e, 'No se pudo proponer un reparto.')) })
    return () => { vivo = false }
  }, [modo, fichaId])

  const sinIndividual = useMemo(() => q?.aprendices.filter((a) => !a.individual).length ?? 0, [q])

  async function hacer(fn: () => Promise<unknown>, hecho: string) {
    setOcupado(true); setErr(null); setOk(null)
    try {
      await fn()
      setOk(hecho); setMarcados(new Set()); setReparto(null)
      cargar(); onCambio?.()
      if (modo === 'REPARTIR') setModo('FICHA')
    } catch (e) {
      setErr(msg(e, 'No se pudo asignar.'))
    } finally {
      setOcupado(false)
    }
  }

  if (!q) return <p className="fx-texto-3">{err ?? 'Leyendo quién sigue a quién…'}</p>

  const asignarFicha = (s: Sugerencia) => hacer(() => api.post('/asignar/ficha', { ficha_id: fichaId, instructor_id: s.id }),
    `La ficha ${q.ficha.numero_ficha} quedó con ${s.nombre}.`)
  const sueltos = q.aprendices.filter((a) => marcados.has(a.numero_documento))
  const asignarSueltos = () => {
    const s = sug?.find((x) => x.id === destino)
    if (!s || !sueltos.length) return
    void hacer(() => api.post('/asignar/aprendices', {
      ficha_id: fichaId, instructor_id: s.id,
      aprendices: sueltos.map((a) => ({ numero_documento: a.numero_documento, aprendiz_nombre: a.nombre, aprendiz_id: a.aprendiz_id })),
    }), `${pl(sueltos.length, 'aprendiz quedó', 'aprendices quedaron')} con ${s.nombre}.`)
  }
  const aplicarReparto = () => {
    if (!reparto?.grupos.length) return
    const [primero, ...resto] = reparto.grupos
    void hacer(async () => {
      await api.post('/asignar/ficha', { ficha_id: fichaId, instructor_id: primero.instructor_id })
      for (const g of resto) await api.post('/asignar/aprendices', { ficha_id: fichaId, instructor_id: g.instructor_id, aprendices: g.aprendices })
    }, `La ficha quedó repartida entre ${pl(reparto.grupos.length, 'instructor', 'instructores')}.`)
  }
  const destinoSug = sug?.find((x) => x.id === destino)

  return (
    <div className="asg">
      <div className="asg-quien">
        {q.instructor_ficha
          ? <span>Instructor de la ficha: <strong>{q.instructor_ficha.nombre}</strong>{q.instructor_ficha.desde ? <span className="fx-texto-3"> · desde el {fdia(q.instructor_ficha.desde)}</span> : null}</span>
          : <Estado tono="aviso">La ficha no tiene instructor</Estado>}
        <span className="fx-texto-3">
          {pl(q.aprendices.length, 'aprendiz', 'aprendices')}
          {q.aprendices.length - sinIndividual ? ` · ${q.aprendices.length - sinIndividual} con otro instructor` : ''}
        </span>
      </div>

      {q.solicitudes.length > 0 && (
        <div className="asg-solicitudes">
          <h4 className="fx-eyebrow">Lo pidieron</h4>
          {q.solicitudes.map((s) => (
            <div key={s.id} className="asg-solicitud">
              <span><strong>{s.instructor}</strong>{s.nota ? <span className="fx-texto-2"> · “{s.nota}”</span> : null}<span className="fx-texto-3"> · {fdia(s.fecha)}</span></span>
              <span className="asg-acciones">
                <Boton tipo="principal" disabled={ocupado} onClick={() => void hacer(() => api.post(`/asignar/solicitudes/${s.id}/aprobar`), `La ficha quedó con ${s.instructor}.`)}>Aprobar</Boton>
                <Boton tipo="suave" disabled={ocupado} onClick={() => void hacer(() => api.post(`/asignar/solicitudes/${s.id}/rechazar`), 'Solicitud rechazada.')}>Rechazar</Boton>
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="asg-modos" role="tablist" aria-label="Cómo asignar">
        {([['FICHA', 'Toda la ficha'], ['SUELTOS', 'Aprendices sueltos'], ['REPARTIR', 'Repartir']] as [Modo, string][]).map(([k, t]) => (
          <button key={k} type="button" role="tab" aria-selected={modo === k} data-on={modo === k || undefined} onClick={() => { setModo(k); setErr(null); setOk(null) }}>{t}</button>
        ))}
      </div>

      {ok && <p className="asg-ok">{ok}</p>}
      {err && <p className="pan-error">{err}</p>}

      {modo === 'FICHA' && (
        <div className="pan-asistente">
          <p className="fx-texto-2 asg-nota">
            Un instructor para los {pl(sinIndividual, 'aprendiz', 'aprendices')} de la ficha{q.aprendices.length - sinIndividual ? ' (los que tienen otro instructor se quedan con él)' : ''}. Ordenados por cupo libre, coordinación, programa y municipio.
          </p>
          {sug == null && <p className="fx-texto-3">Buscando a quién conviene…</p>}
          {sug?.length === 0 && <p className="fx-texto-3">No hay instructores con cupo en este ámbito.</p>}
          {sug?.map((x, k) => {
            const queda = x.carga + sinIndividual
            const actual = q.instructor_ficha?.id === x.id
            return (
              <div key={x.id} className="pan-sug" data-primera={k === 0 || undefined}>
                <div className="pan-sug-cab">
                  <div>
                    <div className="pan-prog">{x.nombre}</div>
                    {x.coordinacion && <div className="fx-texto-3">{x.coordinacion}</div>}
                  </div>
                  <div className="pan-sug-carga fx-num">
                    <Medidor carga={actual ? x.carga : queda} cupo={x.cupo}/>
                    <span className="fx-texto-3" data-tono={!actual && queda > x.cupo ? 'atraso' : undefined}>
                      {actual ? `${x.carga} de ${x.cupo}` : `quedaría con ${queda} de ${x.cupo}`}
                    </span>
                  </div>
                </div>
                <ul className="pan-razones">
                  {x.razones.map((r) => <li key={r} data-tipo="si">{r}</li>)}
                  {x.avisos.map((r) => <li key={r} data-tipo="ojo">{r}</li>)}
                </ul>
                {actual ? <Estado tono="hecho">Es el instructor de la ficha</Estado> : (
                  <Boton tipo={k === 0 ? 'principal' : undefined} disabled={ocupado} onClick={() => void asignarFicha(x)}>
                    {`Asignar la ficha a ${x.nombre.split(' ')[0]}`}
                  </Boton>
                )}
              </div>
            )
          })}
        </div>
      )}

      {modo === 'SUELTOS' && (
        <div className="asg-sueltos">
          <p className="fx-texto-2 asg-nota">Marca los aprendices y elige quién los sigue. Esto manda sobre el instructor de la ficha; sus etapas en curso pasan al nuevo instructor.</p>
          <div className="asg-destino">
            <select value={destino} onChange={(e) => setDestino(e.target.value)} aria-label="Instructor">
              <option value="">Elige el instructor…</option>
              {sug?.map((x) => <option key={x.id} value={x.id}>{x.nombre} · {x.carga} de {x.cupo}</option>)}
            </select>
            <Boton tipo="principal" disabled={ocupado || !destino || !sueltos.length} onClick={asignarSueltos}>
              Asignar {sueltos.length ? pl(sueltos.length, 'aprendiz', 'aprendices') : ''}
            </Boton>
          </div>
          {destinoSug && sueltos.length > 0 && (
            <p className="fx-texto-3 asg-nota" data-tono={destinoSug.carga + sueltos.length > destinoSug.cupo ? 'atraso' : undefined}>
              {destinoSug.nombre.split(' ')[0]} quedaría con {destinoSug.carga + sueltos.length} de {destinoSug.cupo}.
            </p>
          )}
          <ul className="asg-lista">
            <li className="asg-lista-cab">
              <label><input type="checkbox" checked={marcados.size === q.aprendices.length && q.aprendices.length > 0}
                onChange={(e) => setMarcados(e.target.checked ? new Set(q.aprendices.map((a) => a.numero_documento)) : new Set())}/> Todos</label>
              <span className="fx-texto-3">{marcados.size ? `${marcados.size} marcados` : ''}</span>
            </li>
            {q.aprendices.map((a) => (
              <li key={a.numero_documento}>
                <label>
                  <input type="checkbox" checked={marcados.has(a.numero_documento)} onChange={(e) => {
                    const n = new Set(marcados); if (e.target.checked) n.add(a.numero_documento); else n.delete(a.numero_documento); setMarcados(n)
                  }}/>
                  <span>
                    <span className="pan-prog">{a.nombre}</span>
                    <span className="fx-texto-3"> · {a.instructor ? a.instructor.nombre : 'sin instructor'}{a.etapa ? ' · etapa en curso' : ''}</span>
                  </span>
                </label>
                {a.individual && (
                  <span className="asg-acciones">
                    <Estado tono="info">propio</Estado>
                    <Boton tipo="suave" disabled={ocupado} title="Vuelve al instructor de la ficha"
                      onClick={() => void hacer(() => api.delete(`/asignar/aprendiz/${a.individual!.asignacion_id}`), `${a.nombre} vuelve al instructor de la ficha.`)}>Quitar</Boton>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {modo === 'REPARTIR' && (
        <div className="pan-asistente">
          {!reparto ? <p className="fx-texto-3">Calculando el reparto…</p> : reparto.grupos.length === 0 ? (
            <p className="fx-texto-3">Ningún instructor tiene cupo libre para repartir esta ficha.</p>
          ) : (
            <>
              <p className="fx-texto-2 asg-nota">
                Propuesta para {pl(reparto.aprendices, 'aprendiz', 'aprendices')} según el cupo libre de cada uno.
                El primero queda como instructor de la ficha; los demás, con sus aprendices.
                {!reparto.alcanza && ' Los cupos no alcanzan: el resto queda con el primero.'}
              </p>
              {reparto.grupos.map((g, k) => (
                <div key={g.instructor_id} className="pan-sug" data-primera={k === 0 || undefined}>
                  <div className="pan-sug-cab">
                    <div className="pan-prog">{g.instructor}</div>
                    <span className="fx-texto-3 fx-num">{pl(g.aprendices.length, 'aprendiz', 'aprendices')} · tenía {g.libre} libres</span>
                  </div>
                  <p className="fx-texto-3 asg-nombres">{g.aprendices.map((a) => a.aprendiz_nombre).join(' · ')}</p>
                </div>
              ))}
              <Boton tipo="principal" disabled={ocupado} onClick={aplicarReparto}>Aplicar este reparto</Boton>
            </>
          )}
        </div>
      )}

      {q.historial.length > 0 && (
        <div className="asg-hist">
          <button type="button" className="hoy-enlace" onClick={() => setVerHist(!verHist)}>{verHist ? 'Ocultar el historial' : `Ver el historial (${q.historial.length})`}</button>
          {verHist && (
            <ul className="pan-lista">
              {q.historial.map((h, i) => (
                <li key={i}>
                  <span className="fx-texto-3 fx-num">{fdia(h.desde)}{h.hasta ? ` → ${fdia(h.hasta)}` : ''}</span>
                  <span>{h.tipo === 'FICHA' ? 'Ficha' : h.aprendiz} → <strong>{h.instructor}</strong>{h.por ? <span className="fx-texto-3"> · por {h.por}</span> : null}</span>
                  {h.activa ? <Estado tono="hecho">vigente</Estado> : <span/>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
