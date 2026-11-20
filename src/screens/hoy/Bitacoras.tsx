// "Bitácoras" del instructor: una bandeja para leerlas una tras otra. Abrir
// una ya cuenta como leída (LecturaBitacora); "Siguiente" pasa a la próxima
// por leer sin volver a la lista. Nadie aprueba: se lee, se comenta o se pide
// corrección. La selección va en la URL (?etapa=&n=) para que "atrás" funcione.
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../../lib/api'
import { Lienzo, Frase, Panel, Estado, Boton } from '../../ui'
import { diasEntre, fdia } from '../../ui/estados'
import type { BitacoraVista } from '../../ui/estados'
import type { CasillaBitacora, EstadoAprendiz, PendientesInstructor, TabEtapa } from '../instructor/types'
import { LecturaBitacora } from '../expediente/LecturaBitacora'
import { plural } from './comun'
import '../expediente/expediente.css'
import './hoy.css'

interface Item { a: EstadoAprendiz; c: CasillaBitacora }

const DIAS_LEIDAS = 14

function separar(d: PendientesInstructor) {
  const porLeer: Item[] = []
  const correccion: Item[] = []
  const leidas: Item[] = []
  const atrasadas: { a: EstadoAprendiz; nums: number[] }[] = []
  for (const a of d.aprendices) {
    const nums: number[] = []
    for (const c of a.bitacoras ?? []) {
      if (c.estado === 'SIN_LEER') porLeer.push({ a, c })
      else if (c.estado === 'CORRECCION') correccion.push({ a, c })
      else if (c.estado === 'ATRASADA') nums.push(c.numero)
      else if (c.estado === 'LEIDA' && c.leida && diasEntre(c.leida.slice(0, 10), d.hoy) <= DIAS_LEIDAS) leidas.push({ a, c })
    }
    if (nums.length) atrasadas.push({ a, nums })
  }
  porLeer.sort((x, y) => (x.c.entregada ?? '').localeCompare(y.c.entregada ?? ''))
  leidas.sort((x, y) => (y.c.leida ?? '').localeCompare(x.c.leida ?? ''))
  atrasadas.sort((x, y) => y.nums.length - x.nums.length || x.a.aprendiz_nombre.localeCompare(y.a.aprendiz_nombre))
  return { porLeer, correccion, leidas, atrasadas }
}

// Lo que devuelve el back al leer/comentar se pasa a las casillas de la bandeja.
function aplicarLectura(d: PendientesInstructor, etapaId: number, lista: BitacoraVista[]): PendientesInstructor {
  return {
    ...d,
    aprendices: d.aprendices.map((a) => a.etapa_id !== etapaId ? a : {
      ...a,
      bitacoras: (a.bitacoras ?? []).map((c) => {
        const b = lista.find((x) => x.numero === c.numero)
        if (!b) return c
        if (b.leida_at || b.estado === 'APROBADA') return { ...c, estado: 'LEIDA', leida: c.leida ?? b.leida_at ?? d.hoy }
        if (b.estado === 'DEVUELTA') return { ...c, estado: 'CORRECCION' }
        return c
      }),
    }),
  }
}

export function Bitacoras({ onAbrir }: { onAbrir: (etapaId: number, tab?: TabEtapa | null) => void }) {
  const [d, setD] = useState<PendientesInstructor | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [params, setParams] = useSearchParams()
  const sel = params.get('etapa') && params.get('n')
    ? { etapa: Number(params.get('etapa')), n: Number(params.get('n')) } : null

  useEffect(() => {
    let vivo = true
    api.get<PendientesInstructor>('/instructores/mi/pendientes')
      .then((r) => { if (vivo) setD(r.data) })
      .catch((e) => { if (vivo) setErr(e?.response?.data?.message ?? 'No se pudieron cargar tus bitácoras.') })
    return () => { vivo = false }
  }, [])

  const grupos = useMemo(() => (d ? separar(d) : null), [d])

  if (err) return <Lienzo><Frase tono="atraso">{err}</Frase></Lienzo>
  if (!d || !grupos) return <Lienzo><p className="fx-texto-3">Cargando tus bitácoras…</p></Lienzo>

  const abrir = (etapa: number, n: number) => setParams({ etapa: String(etapa), n: String(n) })
  const cerrar = () => setParams({})
  const { porLeer, correccion, leidas, atrasadas } = grupos
  const siguiente = porLeer.find((x) => !sel || x.a.etapa_id !== sel.etapa || x.c.numero !== sel.n)
  const actual = sel ? d.aprendices.find((a) => a.etapa_id === sel.etapa) : null

  const conDif = porLeer.filter((x) => x.c.dificultades > 0).length
  const frase = porLeer.length
    ? `Tienes ${plural(porLeer.length, 'bitácora por leer', 'bitácoras por leer')}${conDif ? `; ${plural(conDif, 'reporta', 'reportan')} dificultades` : ''}. Empieza por la más vieja.`
    : 'Leíste todas las bitácoras que te entregaron.'

  return (
    <Lienzo className={`bit${sel ? ' bit--leyendo' : ''}`}>
      <header className="hoy-cab">
        <div>
          <div className="fx-eyebrow">{plural(d.aprendices.length, 'aprendiz', 'aprendices')} en etapa productiva</div>
          <h1 className="fx-titulo">Bitácoras</h1>
        </div>
        {siguiente && !sel && (
          <div className="hoy-acciones">
            <Boton tipo="principal" onClick={() => abrir(siguiente.a.etapa_id, siguiente.c.numero)}>Leer la más vieja</Boton>
          </div>
        )}
      </header>
      <Frase tono={porLeer.length ? undefined : 'ok'}>{frase}</Frase>

      <div className="bit-rejilla">
        <div className="bit-lista">
          <Grupo titulo="Por leer" n={porLeer.length} vacio="Nada por leer.">
            {porLeer.map((x) => (
              <Fila key={`${x.a.etapa_id}-${x.c.numero}`} x={x} activo={sel?.etapa === x.a.etapa_id && sel.n === x.c.numero}
                onClick={() => abrir(x.a.etapa_id, x.c.numero)}
                nota={`Entregada el ${fdia(x.c.entregada)}${x.c.dificultades ? ' · reportó dificultades' : ''}`}
                tono={x.c.dificultades ? 'aviso' : 'info'} estado={x.c.dificultades ? 'Dificultades' : 'Leer'}/>
            ))}
          </Grupo>

          {atrasadas.length > 0 && (
            <Grupo titulo="Atrasadas" n={atrasadas.length} vacio="">
              <p className="fx-texto-3 bit-ayuda">El aprendiz no la entregó y ya pasó el plazo. Escríbele o revisa su expediente.</p>
              {atrasadas.map(({ a, nums }) => (
                <button key={a.etapa_id} type="button" className="bit-fila" onClick={() => onAbrir(a.etapa_id, 'bitacoras')}>
                  <Estado tono="atraso">{plural(nums.length, 'atrasada', 'atrasadas')}</Estado>
                  <span className="hoy-item-txt">
                    <strong>{a.aprendiz_nombre}</strong>
                    <span className="fx-texto-2">{nums.length === 1 ? `Bitácora ${nums[0]}` : `Bitácoras ${nums.join(', ')}`} · ficha {a.numero_ficha}</span>
                  </span>
                </button>
              ))}
            </Grupo>
          )}

          {correccion.length > 0 && (
            <Grupo titulo="Pediste corrección" n={correccion.length} vacio="">
              {correccion.map((x) => (
                <Fila key={`${x.a.etapa_id}-${x.c.numero}`} x={x} activo={sel?.etapa === x.a.etapa_id && sel.n === x.c.numero}
                  onClick={() => abrir(x.a.etapa_id, x.c.numero)} nota="Esperando a que el aprendiz la corrija" tono="aviso" estado="Corrección"/>
              ))}
            </Grupo>
          )}

          {leidas.length > 0 && (
            <Grupo titulo={`Leídas en las últimas ${DIAS_LEIDAS / 7} semanas`} n={leidas.length} vacio="" plegado>
              {leidas.map((x) => (
                <Fila key={`${x.a.etapa_id}-${x.c.numero}`} x={x} activo={sel?.etapa === x.a.etapa_id && sel.n === x.c.numero}
                  onClick={() => abrir(x.a.etapa_id, x.c.numero)} nota={`Leída el ${fdia(x.c.leida)}`} tono="hecho" estado="Leída"/>
              ))}
            </Grupo>
          )}
        </div>

        <div className="bit-lectura">
          {sel && actual ? (
            <Panel
              titulo={<span className="bit-quien"><strong>{actual.aprendiz_nombre}</strong><span className="fx-texto-3"> · bitácora {sel.n} · ficha {actual.numero_ficha}</span></span>}
              accion={<Boton tipo="suave" onClick={cerrar}>Cerrar</Boton>}
            >
              <LecturaBitacora
                key={`${sel.etapa}-${sel.n}`}
                etapaId={sel.etapa} numero={sel.n} hoy={d.hoy} total={(actual.bitacoras ?? []).length || 12}
                onCambio={(lista) => setD((prev) => (prev ? aplicarLectura(prev, sel.etapa, lista) : prev))}
                onNavegar={(n) => abrir(sel.etapa, n)}
              />
              <div className="bit-siguiente">
                <button type="button" className="hoy-enlace" onClick={() => onAbrir(actual.etapa_id, 'bitacoras')}>Ver su expediente</button>
                {siguiente
                  ? <Boton tipo="principal" onClick={() => abrir(siguiente.a.etapa_id, siguiente.c.numero)}>Siguiente por leer: {siguiente.a.aprendiz_nombre.split(' ')[0]} →</Boton>
                  : <span className="fx-texto-3">No quedan bitácoras por leer.</span>}
              </div>
            </Panel>
          ) : sel ? (
            <p className="fx-texto-3">Esa bitácora no es de un aprendiz tuyo en curso.</p>
          ) : (
            <p className="fx-texto-3 bit-vacio">Elige una bitácora de la lista para leerla aquí.</p>
          )}
        </div>
      </div>
    </Lienzo>
  )
}

function Grupo({ titulo, n, vacio, plegado, children }: {
  titulo: string; n: number; vacio: string; plegado?: boolean; children: ReactNode
}) {
  const [abierto, setAbierto] = useState(!plegado)
  return (
    <section className="bit-grupo">
      <div className="bit-grupo-cab">
        <span className="fx-eyebrow">{titulo} · {n}</span>
        {plegado && <button type="button" className="hoy-enlace" onClick={() => setAbierto(!abierto)}>{abierto ? 'Ocultar' : 'Ver'}</button>}
      </div>
      {abierto && (n === 0 ? <p className="fx-texto-3 bit-ayuda">{vacio}</p> : children)}
    </section>
  )
}

function Fila({ x, activo, onClick, nota, tono, estado }: {
  x: Item; activo: boolean; onClick: () => void; nota: string
  tono: 'info' | 'aviso' | 'hecho'; estado: string
}) {
  return (
    <button type="button" className="bit-fila" data-activo={activo || undefined} onClick={onClick}>
      <Estado tono={tono}>{estado}</Estado>
      <span className="hoy-item-txt">
        <strong>{x.a.aprendiz_nombre}</strong>
        <span className="fx-texto-2">Bitácora {x.c.numero} · {nota}</span>
      </span>
    </button>
  )
}
